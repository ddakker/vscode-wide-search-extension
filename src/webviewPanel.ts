import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SearchEngine } from './searchEngine';
import { HistoryManager } from './historyManager';
import { ReplaceEngine } from './replaceEngine';
import { WebToExtMessage, ExtToWebMessage, SearchOptions } from './types';
import { t, getLang } from './i18n';

export class SearchPanel {
  private static instance: SearchPanel | undefined;
  private panel: vscode.WebviewPanel;
  private searchEngine: SearchEngine;
  private replaceEngine: ReplaceEngine;
  private historyManager: HistoryManager;
  private extensionUri: vscode.Uri;
  private lastActiveEditor: vscode.TextEditor | undefined;
  public pendingMode: 'files' | 'replace' | undefined;
  public scopePath: string | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    historyManager: HistoryManager
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.searchEngine = new SearchEngine();
    this.replaceEngine = new ReplaceEngine();
    this.historyManager = historyManager;

    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    this.panel.onDidDispose(() => {
      this.searchEngine.cancel();
      SearchPanel.instance = undefined;
    });
  }

  static open(
    extensionUri: vscode.Uri,
    historyManager: HistoryManager,
    mode?: 'files' | 'replace',
    scopePath?: string
  ): void {
    const lastEditor = vscode.window.activeTextEditor;

    if (SearchPanel.instance) {
      SearchPanel.instance.lastActiveEditor = lastEditor;
      SearchPanel.instance.panel.reveal(vscode.ViewColumn.Active);
      if (scopePath) {
        SearchPanel.instance.scopePath = scopePath;
        SearchPanel.instance.postMessage({ type: 'setScope', path: scopePath });
      } else {
        SearchPanel.instance.postMessage({
          type: 'setMode',
          mode: mode === 'replace' ? 'replace' : 'search',
        });
      }
      SearchPanel.instance.postMessage({ type: 'focusInput' });
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'wideSearch',
      t('panel.title'),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview'),
        ],
      }
    );

    const instance = new SearchPanel(panel, extensionUri, historyManager);
    instance.lastActiveEditor = lastEditor;
    instance.pendingMode = mode;
    instance.scopePath = scopePath;
    SearchPanel.instance = instance;
  }

  private postMessage(msg: ExtToWebMessage): void {
    this.panel.webview.postMessage(msg);
  }

  private async handleMessage(msg: WebToExtMessage): Promise<void> {
    switch (msg.type) {
      case 'ready': {
        const theme = this.detectTheme();
        this.postMessage({ type: 'config', theme, lang: getLang() });
        this.postMessage({
          type: 'historyList',
          data: this.historyManager.getHistory(),
        });
        if (this.scopePath) {
          this.postMessage({ type: 'setScope', path: this.scopePath });
          this.scopePath = undefined;
        } else if (this.pendingMode) {
          this.postMessage({
            type: 'setMode',
            mode: this.pendingMode === 'replace' ? 'replace' : 'search',
          });
          this.pendingMode = undefined;
        }
        break;
      }

      case 'search': {
        const options = msg.options;
        console.log('[WideSearch] search request:', JSON.stringify(options));
        const folders = this.getWorkspaceFolders();
        if (folders.length === 0) {
          this.postMessage({
            type: 'searchProgress',
            data: { type: 'error', error: t('error.noFolder') },
          });
          return;
        }

        options.folders = options.scopePath ? [options.scopePath] : folders;
        await vscode.workspace.saveAll(false);
        await this.historyManager.addQuery(options.query);

        try {
          this.searchEngine.search(options, (progress) => {
            this.postMessage({ type: 'searchProgress', data: progress });
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : t('error.searchEngine');
          this.postMessage({
            type: 'searchProgress',
            data: { type: 'error', error: msg },
          });
        }
        break;
      }

      case 'cancel':
        this.searchEngine.cancel();
        break;

      case 'openFile': {
        const uri = vscode.Uri.file(msg.file);
        const doc = await vscode.workspace.openTextDocument(uri);
        // 패널과 같은 viewColumn에 열어서 패널을 숨김 (dispose하지 않음)
        const column = this.panel.viewColumn ?? vscode.ViewColumn.Active;
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: column,
          preserveFocus: false,
        });
        const pos = new vscode.Position(msg.line - 1, msg.column);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
        break;
      }

      case 'replace': {
        const result = await this.replaceEngine.replaceOne({
          file: msg.file,
          line: msg.line,
          column: msg.column,
          oldText: msg.oldText,
          newText: msg.newText,
          regex: msg.regex,
        });
        this.postMessage({ type: 'replaceResult', ...result });
        break;
      }

      case 'replaceAll': {
        const result = await this.replaceEngine.replaceAll({
          query: msg.query,
          replace: msg.replace,
          caseSensitive: msg.caseSensitive,
          regex: msg.regex,
          files: msg.files,
        });
        this.postMessage({ type: 'replaceResult', ...result });
        break;
      }

      case 'getHistory':
        this.postMessage({
          type: 'historyList',
          data: this.historyManager.getHistory(),
        });
        break;

      case 'requestFileContent': {
        try {
          const uri = vscode.Uri.file(msg.file);
          const doc = await vscode.workspace.openTextDocument(uri);
          const totalLines = doc.lineCount;
          const center = msg.matchLine - 1;
          const startLine = Math.max(0, center - 100);
          const endLine = Math.min(totalLines, center + 100);

          const lines: string[] = [];
          for (let i = startLine; i < endLine; i++) {
            lines.push(doc.lineAt(i).text);
          }

          this.postMessage({
            type: 'fileContent',
            file: msg.file,
            content: lines.join('\n'),
            startLine: startLine + 1,
          });
        } catch {
          this.postMessage({
            type: 'fileContent',
            file: msg.file,
            content: '',
            startLine: 1,
          });
        }
        break;
      }

      case 'saveFile': {
        try {
          const uri = vscode.Uri.file(msg.file);
          const doc = await vscode.workspace.openTextDocument(uri);
          const newLines = msg.content.split('\n');
          const startIdx = msg.startLine - 1;
          const endIdx = Math.min(startIdx + newLines.length, doc.lineCount);

          const edit = new vscode.WorkspaceEdit();
          const range = new vscode.Range(
            startIdx, 0,
            endIdx - 1, doc.lineAt(endIdx - 1).text.length
          );
          edit.replace(uri, range, newLines.join('\n'));
          const ok = await vscode.workspace.applyEdit(edit);

          if (ok) {
            await doc.save();
            this.postMessage({ type: 'saveResult', success: true, message: t('msg.saved') });
          } else {
            this.postMessage({ type: 'saveResult', success: false, message: t('msg.saveFailed') });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : t('msg.saveFailed');
          this.postMessage({ type: 'saveResult', success: false, message: errMsg });
        }
        break;
      }

      case 'openLastEditor': {
        if (this.lastActiveEditor?.document) {
          const column = this.lastActiveEditor.viewColumn ?? vscode.ViewColumn.One;
          await vscode.window.showTextDocument(this.lastActiveEditor.document, column);
        } else {
          // 이전 에디터가 없으면 패널 닫기
          this.panel.dispose();
        }
        break;
      }

      case 'closePanel':
        this.panel.dispose();
        break;
    }
  }

  private getWorkspaceFolders(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
  }

  private detectTheme(): 'dark' | 'light' {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Light ||
           kind === vscode.ColorThemeKind.HighContrastLight
      ? 'light'
      : 'dark';
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'app.js')
    );
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${stylesUri}">
  <title>${t('panel.title')}</title>
</head>
<body>
  <div id="search-container">
    <div id="toolbar">
      <div id="search-row">
        <input type="text" id="search-input" placeholder="${t('search.placeholder')}"
          spellcheck="false" autocomplete="off" />
        <textarea id="search-input-multi" placeholder="${t('search.multilinePlaceholder')}"
          spellcheck="false" rows="3" style="display:none"></textarea>
        <button id="btn-case" class="toggle-btn" title="${t('btn.caseSensitive')}">Cc</button>
        <button id="btn-word" class="toggle-btn" title="${t('btn.wholeWord')}">W</button>
        <button id="btn-regex" class="toggle-btn" title="${t('btn.regex')}">.*</button>
        <button id="btn-multiline" class="toggle-btn" title="${t('btn.multiline')}">M</button>
      </div>
      <div id="filter-row">
        <label for="file-mask">File mask:</label>
        <input type="text" id="file-mask" placeholder="ex) *.ts, *.java" spellcheck="false" />
      </div>
      <div id="scope-row" style="display:none">
        <span id="scope-label"></span>
        <button id="btn-clear-scope" title="${t('btn.clearScope')}">X</button>
      </div>
    </div>
    <div id="main-content">
      <div id="results-panel">
        <div id="results-list"></div>
      </div>
      <div id="preview-panel">
        <div id="preview-header"></div>
        <div id="preview-content"><span class="placeholder">${t('preview.empty')}</span></div>
      </div>
    </div>
    <div id="replace-row" style="display:none">
      <input type="text" id="replace-input" placeholder="${t('replace.placeholder')}" spellcheck="false" />
      <textarea id="replace-input-multi" placeholder="${t('replace.multilinePlaceholder')}"
        spellcheck="false" rows="3" style="display:none"></textarea>
      <button id="btn-replace" title="${t('btn.replace')}">${t('btn.replace')}</button>
      <button id="btn-replace-all" title="${t('btn.replaceAll')}">${t('btn.replaceAll')}</button>
    </div>
    <div id="status-bar">
      <span id="status-text"></span>
      <span id="status-toggle">
        <button id="btn-toggle-replace" title="${t('btn.toggleReplace')}">${t('btn.replace')} ▼</button>
      </span>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
