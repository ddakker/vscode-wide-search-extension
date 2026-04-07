export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  contextBefore: string[];
  contextAfter: string[];
}

export interface FileResult {
  file: string;
  matches: SearchMatch[];
}

export interface SearchOptions {
  query: string;
  folders: string[];
  caseSensitive: boolean;
  regex: boolean;
  multiline: boolean;
  fileMask: string;
  scopePath?: string;
}

export interface SearchProgress {
  type: 'results' | 'done' | 'error';
  results?: FileResult[];
  totalMatches?: number;
  totalFiles?: number;
  error?: string;
}

// Extension -> Webview 메시지
export type ExtToWebMessage =
  | { type: 'searchProgress'; data: SearchProgress }
  | { type: 'historyList'; data: string[] }
  | { type: 'replaceResult'; success: boolean; message: string }
  | { type: 'fileContent'; file: string; content: string; startLine: number }
  | { type: 'config'; theme: 'dark' | 'light'; lang: string }
  | { type: 'saveResult'; success: boolean; message: string }
  | { type: 'setMode'; mode: 'search' | 'replace' }
  | { type: 'setScope'; path: string }
  | { type: 'focusInput' };

// Webview -> Extension 메시지
export type WebToExtMessage =
  | { type: 'search'; options: SearchOptions }
  | { type: 'cancel' }
  | { type: 'openFile'; file: string; line: number; column: number }
  | { type: 'replace'; file: string; line: number; column: number;
      oldText: string; newText: string; regex: boolean }
  | { type: 'replaceAll'; query: string; replace: string;
      caseSensitive: boolean; regex: boolean; files: string[] }
  | { type: 'getHistory' }
  | { type: 'requestFileContent'; file: string; matchLine: number }
  | { type: 'saveFile'; file: string; content: string; startLine: number }
  | { type: 'openLastEditor' }
  | { type: 'closePanel' }
  | { type: 'ready' };
