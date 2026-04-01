import * as vscode from 'vscode';
import { t } from './i18n';

export interface ReplaceOneParams {
  file: string;
  line: number;
  column: number;
  oldText: string;
  newText: string;
  regex: boolean;
}

export interface ReplaceAllParams {
  query: string;
  replace: string;
  caseSensitive: boolean;
  regex: boolean;
  files: string[];
}

function unescapeReplacement(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

export class ReplaceEngine {
  async replaceOne(params: ReplaceOneParams): Promise<{ success: boolean; message: string }> {
    try {
      const uri = vscode.Uri.file(params.file);
      const doc = await vscode.workspace.openTextDocument(uri);

      const lineIdx = params.line - 1;
      if (lineIdx < 0 || lineIdx >= doc.lineCount) {
        return { success: false, message: t('replace.lineNotFound') };
      }

      const lineText = doc.lineAt(lineIdx).text;
      const idx = lineText.indexOf(params.oldText, params.column);
      if (idx === -1) {
        return { success: false, message: t('replace.matchNotFound') };
      }

      const range = new vscode.Range(lineIdx, idx, lineIdx, idx + params.oldText.length);
      const replaceText = params.regex ? unescapeReplacement(params.newText) : params.newText;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, range, replaceText);
      const ok = await vscode.workspace.applyEdit(edit);
      if (ok) {
        await doc.save();
      }

      return ok
        ? { success: true, message: t('replace.done') }
        : { success: false, message: t('replace.failed') };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('replace.failed');
      return { success: false, message: msg };
    }
  }

  async replaceAll(params: ReplaceAllParams): Promise<{ success: boolean; message: string }> {
    try {
      const replaceText = params.regex
        ? unescapeReplacement(params.replace)
        : params.replace;

      const edit = new vscode.WorkspaceEdit();
      let matchCount = 0;
      let fileCount = 0;

      for (const filePath of params.files) {
        const uri = vscode.Uri.file(filePath);
        let doc: vscode.TextDocument;
        try {
          doc = await vscode.workspace.openTextDocument(uri);
        } catch {
          continue;
        }

        const fullText = doc.getText();
        let newText: string;
        let count = 0;

        if (params.regex) {
          const pattern = new RegExp(params.query, params.caseSensitive ? 'g' : 'gi');
          newText = fullText.replace(pattern, (...args) => {
            count++;
            // $1, $2 등 캡처 그룹 지원
            return replaceText.replace(/\$(\d+)/g, (_, n) => args[Number(n)] ?? '');
          });
        } else {
          const flags = params.caseSensitive ? 'g' : 'gi';
          const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = new RegExp(escaped, flags);
          newText = fullText.replace(pattern, () => {
            count++;
            return replaceText;
          });
        }

        if (count > 0) {
          const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(fullText.length)
          );
          edit.replace(uri, fullRange, newText);
          matchCount += count;
          fileCount++;
        }
      }

      if (matchCount === 0) {
        return { success: true, message: t('replace.noMatches') };
      }

      const ok = await vscode.workspace.applyEdit(edit);
      if (ok) {
        await vscode.workspace.saveAll(false);
      }
      return ok
        ? { success: true, message: t('replace.allDone', fileCount, matchCount) }
        : { success: false, message: t('replace.failed') };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('replace.failed');
      return { success: false, message: msg };
    }
  }
}
