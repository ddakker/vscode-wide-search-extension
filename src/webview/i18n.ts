const en: Record<string, string> = {
  'search.placeholder': 'Search...',
  'search.multilinePlaceholder': 'Multiline search...',
  'replace.placeholder': 'Replace...',
  'replace.multilinePlaceholder': 'Multiline replace...',
  'btn.replace': 'Replace',
  'preview.empty': 'Select a result to preview',
  'result.empty': 'No results. Hidden folders (.*) and .gitignore patterns are excluded.',
  'result.noResults': 'No results',
  'status.searching': 'Searching...',
  'status.invalidRegex': 'Invalid regex',
  'preview.modified': '(modified)',
  'error.searchFailed': 'Search error',
};

const ko: Record<string, string> = {
  'search.placeholder': '검색어 입력...',
  'search.multilinePlaceholder': '멀티라인 검색어...',
  'replace.placeholder': '바꿀 내용...',
  'replace.multilinePlaceholder': '멀티라인 바꿀 내용...',
  'btn.replace': '바꾸기',
  'preview.empty': '검색 결과를 선택하면 미리보기가 표시됩니다',
  'result.empty': '검색 결과가 없습니다. 숨김 폴더(.*)와 .gitignore 패턴은 제외됩니다.',
  'result.noResults': '검색 결과가 없습니다',
  'status.searching': '검색 중...',
  'status.invalidRegex': '잘못된 정규식',
  'preview.modified': '(수정됨)',
  'error.searchFailed': '검색 중 오류 발생',
};

let strings: Record<string, string> = en;

export function initI18n(lang: string): void {
  strings = lang.startsWith('ko') ? ko : en;
}

export function t(key: string): string {
  return strings[key] ?? key;
}
