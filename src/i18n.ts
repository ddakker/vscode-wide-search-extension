import * as vscode from 'vscode';

const en: Record<string, string> = {
  'panel.title': 'Search',
  'search.placeholder': 'Search...',
  'search.multilinePlaceholder': 'Multiline search...',
  'replace.placeholder': 'Replace...',
  'replace.multilinePlaceholder': 'Multiline replace...',
  'btn.caseSensitive': 'Case Sensitive (Alt+C)',
  'btn.wholeWord': 'Whole Word (Alt+W)',
  'btn.regex': 'Regex (Alt+R)',
  'btn.multiline': 'Multiline (Alt+M)',
  'btn.clearScope': 'Clear Scope',
  'btn.replace': 'Replace',
  'btn.replaceAll': 'Replace All',
  'btn.toggleReplace': 'Toggle Replace (Ctrl+H)',
  'preview.empty': 'Select a result to preview',
  'error.noFolder': 'No folder open',
  'error.searchEngine': 'Search engine error',
  'msg.saved': 'Saved',
  'msg.saveFailed': 'Save failed',
  'replace.lineNotFound': 'Line not found',
  'replace.matchNotFound': 'Match not found (file may have changed)',
  'replace.done': 'Replaced',
  'replace.failed': 'Replace failed',
  'replace.noMatches': 'No matches to replace',
  'replace.allDone': 'Replaced {1} in {0} files',
};

const ko: Record<string, string> = {
  'panel.title': '검색',
  'search.placeholder': '검색어 입력...',
  'search.multilinePlaceholder': '멀티라인 검색어...',
  'replace.placeholder': '바꿀 내용...',
  'replace.multilinePlaceholder': '멀티라인 바꿀 내용...',
  'btn.caseSensitive': '대소문자 구분 (Alt+C)',
  'btn.wholeWord': '단어 단위 (Alt+W)',
  'btn.regex': '정규식 (Alt+R)',
  'btn.multiline': '멀티라인 (Alt+M)',
  'btn.clearScope': '범위 해제',
  'btn.replace': '바꾸기',
  'btn.replaceAll': '전체 바꾸기',
  'btn.toggleReplace': '바꾸기 토글 (Ctrl+H)',
  'preview.empty': '검색 결과를 선택하면 미리보기가 표시됩니다',
  'error.noFolder': '열린 폴더가 없습니다',
  'error.searchEngine': '검색 엔진 오류',
  'msg.saved': '저장 완료',
  'msg.saveFailed': '저장 실패',
  'replace.lineNotFound': '라인을 찾을 수 없습니다',
  'replace.matchNotFound': '매치를 찾을 수 없습니다 (파일이 변경되었을 수 있음)',
  'replace.done': '교체 완료',
  'replace.failed': '바꾸기 실패',
  'replace.noMatches': '교체할 항목이 없습니다',
  'replace.allDone': '{0}개 파일에서 {1}건 교체 완료',
};

let strings: Record<string, string> = en;

export function initI18n(): void {
  strings = vscode.env.language.startsWith('ko') ? ko : en;
}

export function t(key: string, ...args: (string | number)[]): string {
  let str = strings[key] ?? key;
  args.forEach((arg, i) => {
    str = str.replace(`{${i}}`, String(arg));
  });
  return str;
}

export function getLang(): string {
  return vscode.env.language.startsWith('ko') ? 'ko' : 'en';
}
