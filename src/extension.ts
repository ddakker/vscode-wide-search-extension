import * as vscode from 'vscode';
import { SearchPanel } from './webviewPanel';
import { HistoryManager } from './historyManager';
import { setOutputChannel } from './searchEngine';
import { initI18n } from './i18n';

export function activate(context: vscode.ExtensionContext) {
  initI18n();
  const historyManager = new HistoryManager(context.globalState);
  const channel = vscode.window.createOutputChannel('Wide Search');
  setOutputChannel(channel);

  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand('wideSearch.open', () => {
      SearchPanel.open(context.extensionUri, historyManager);
    }),
    vscode.commands.registerCommand('wideSearch.openFileSearch', () => {
      SearchPanel.open(context.extensionUri, historyManager, 'files');
    }),
    vscode.commands.registerCommand('wideSearch.openReplace', () => {
      SearchPanel.open(context.extensionUri, historyManager, 'replace');
    }),
    vscode.commands.registerCommand('wideSearch.openInFolder', (uri: vscode.Uri) => {
      if (uri) {
        SearchPanel.open(context.extensionUri, historyManager, undefined, uri.fsPath);
      }
    })
  );
}

export function deactivate() {}
