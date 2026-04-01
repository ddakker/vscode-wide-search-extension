import { initI18n, t } from './i18n';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
}

interface FileResult {
  file: string;
  matches: SearchMatch[];
}

interface SearchProgress {
  type: 'results' | 'done' | 'error';
  results?: FileResult[];
  totalMatches?: number;
  error?: string;
}

const vscode = acquireVsCodeApi();

// DOM elements
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchInputMulti = document.getElementById('search-input-multi') as HTMLTextAreaElement;
const fileMaskInput = document.getElementById('file-mask') as HTMLInputElement;
const btnCase = document.getElementById('btn-case') as HTMLButtonElement;
const btnWord = document.getElementById('btn-word') as HTMLButtonElement;
const btnRegex = document.getElementById('btn-regex') as HTMLButtonElement;
const btnMultiline = document.getElementById('btn-multiline') as HTMLButtonElement;
const scopeRow = document.getElementById('scope-row') as HTMLDivElement;
const scopeLabel = document.getElementById('scope-label') as HTMLSpanElement;
const btnClearScope = document.getElementById('btn-clear-scope') as HTMLButtonElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const previewContent = document.getElementById('preview-content') as HTMLDivElement;
const previewHeader = document.getElementById('preview-header') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const replaceRow = document.getElementById('replace-row') as HTMLDivElement;
const replaceInput = document.getElementById('replace-input') as HTMLInputElement;
const replaceInputMulti = document.getElementById('replace-input-multi') as HTMLTextAreaElement;
const btnReplace = document.getElementById('btn-replace') as HTMLButtonElement;
const btnReplaceAll = document.getElementById('btn-replace-all') as HTMLButtonElement;
const btnToggleReplace = document.getElementById('btn-toggle-replace') as HTMLButtonElement;

// State
let caseSensitive = false;
let useRegex = false;
let multiline = false;
let isSearching = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let allResults: FileResult[] = [];
let totalMatches = 0;
let selectedIndex = -1;
let flatMatches: SearchMatch[] = [];
let historyList: string[] = [];
let historyIndex = -1;
let replaceVisible = false;
let currentScopePath = '';

// 미리보기 편집 상태
let previewFile = '';
let previewStartLine = 0;
let previewOriginalContent = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const FILE_ICONS: Record<string, string> = {
  ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨',
  json: '📋', css: '🎨', html: '🌐', vue: '💚',
  svelte: '🧡', py: '🐍', java: '☕', go: '🔵',
  rs: '🦀', md: '📝', yaml: '⚙️', yml: '⚙️',
  toml: '⚙️', sh: '🖥️', sql: '🗃️', xml: '📄', txt: '📄',
};

function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? '📄';
}

function getActiveSearchInput(): HTMLInputElement | HTMLTextAreaElement {
  return multiline ? searchInputMulti : searchInput;
}

function getSearchValue(): string {
  return getActiveSearchInput().value;
}

function getReplaceValue(): string {
  return multiline ? replaceInputMulti.value : replaceInput.value;
}

function toggleMultiline(): void {
  multiline = !multiline;
  btnMultiline.classList.toggle('active', multiline);

  if (multiline) {
    searchInputMulti.value = searchInput.value;
    replaceInputMulti.value = replaceInput.value;
    searchInput.style.display = 'none';
    replaceInput.style.display = 'none';
    searchInputMulti.style.display = 'block';
    replaceInputMulti.style.display = 'block';
    searchInputMulti.focus();
  } else {
    searchInput.value = searchInputMulti.value.replace(/\n/g, ' ');
    replaceInput.value = replaceInputMulti.value.replace(/\n/g, ' ');
    searchInputMulti.style.display = 'none';
    replaceInputMulti.style.display = 'none';
    searchInput.style.display = 'block';
    replaceInput.style.display = 'block';
    searchInput.focus();
  }
  debouncedSearch();
}

function getRelativePath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  if (useRegex) {
    try {
      const re = new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi');
      return escaped.replace(re, '<span class="match-highlight">$1</span>');
    } catch {
      return escaped;
    }
  }
  const flags = caseSensitive ? 'g' : 'gi';
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escapedQuery})`, flags);
  return escaped.replace(re, '<span class="match-highlight">$1</span>');
}

// ---- Rendering ----

function renderResults(): void {
  flatMatches = [];
  resultsList.innerHTML = '';

  if (allResults.length === 0 && !isSearching) {
    if (getSearchValue().trim()) {
      resultsList.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.5">'
        + t('result.empty') + '</div>';
    }
    return;
  }

  const query = getSearchValue();

  for (const fileResult of allResults) {
    for (const match of fileResult.matches) {
      const idx = flatMatches.length;
      flatMatches.push(match);

      const item = document.createElement('div');
      item.className = 'match-item';
      item.dataset.index = String(idx);

      const fileName = fileResult.file.replace(/\\/g, '/').split('/').pop() ?? '';

      item.innerHTML = `
        <span class="match-text">${highlightMatch(match.text, query)}</span>
        <span class="match-location">${escapeHtml(fileName)} ${match.line}</span>
      `;
      resultsList.appendChild(item);
    }
  }
}

function selectMatch(index: number): void {
  if (index < 0 || index >= flatMatches.length) return;

  const prev = resultsList.querySelector('.match-item.selected');
  if (prev) prev.classList.remove('selected');

  selectedIndex = index;
  const el = resultsList.querySelector(`.match-item[data-index="${index}"]`);
  if (el) {
    el.classList.add('selected');
    el.scrollIntoView({ block: 'nearest' });
  }

  // 다른 파일로 전환 전 현재 편집 내용 저장
  autoSaveIfChanged();

  const match = flatMatches[index];
  showPreview(match);
}

function showPreview(match: SearchMatch): void {
  previewHeader.textContent = `${getRelativePath(match.file)} : ${match.line}`;
  vscode.postMessage({
    type: 'requestFileContent',
    file: match.file,
    matchLine: match.line,
  });
}

function getMatchLineCount(): number {
  if (!multiline) return 1;
  const query = getSearchValue();
  return query.split('\n').length;
}

function renderPreview(content: string, startLine: number, matchLine: number): void {
  previewFile = flatMatches[selectedIndex]?.file ?? '';
  previewStartLine = startLine;
  previewOriginalContent = content;

  const lines = content.split('\n');
  const gutterLines = lines.map((_, i) => startLine + i).join('\n');
  const matchLineCount = getMatchLineCount();

  previewContent.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'editor-wrapper';

  const gutter = document.createElement('div');
  gutter.className = 'editor-gutter';
  gutter.textContent = gutterLines;

  // 하이라이트 오버레이 (매치 라인 배경색)
  const highlight = document.createElement('div');
  highlight.className = 'editor-highlight';
  for (let i = 0; i < lines.length; i++) {
    const lineNum = startLine + i;
    const div = document.createElement('div');
    div.className = 'highlight-line';
    if (lineNum >= matchLine && lineNum < matchLine + matchLineCount) {
      div.classList.add('active-match');
    }
    // 빈 줄도 높이 유지를 위해 nbsp
    div.innerHTML = escapeHtml(lines[i]) || '&nbsp;';
    highlight.appendChild(div);
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'editor-textarea';
  textarea.value = content;
  textarea.spellcheck = false;
  textarea.id = 'preview-editor';

  // 자동 저장: 수정 후 1초 뒤 저장
  textarea.addEventListener('input', () => {
    previewHeader.textContent = `${getRelativePath(previewFile)} : ${matchLine} ${t('preview.modified')}`;
    scheduleAutoSave();
  });

  // gutter + highlight 스크롤 동기화
  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  });

  // Esc: 검색 입력으로 포커스 이동 (패널 닫기 방지)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      autoSaveIfChanged();
      searchInput.focus();
    }
    // Tab: 실제 탭 문자 입력
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      scheduleAutoSave();
    }
  });

  wrapper.appendChild(gutter);
  wrapper.appendChild(highlight);
  wrapper.appendChild(textarea);
  previewContent.appendChild(wrapper);

  // 매치 라인으로 스크롤
  const lineHeight = 18;
  const targetLine = matchLine - startLine;
  const scrollPos = Math.max(0, (targetLine - 5) * lineHeight);
  setTimeout(() => {
    textarea.scrollTop = scrollPos;
    gutter.scrollTop = scrollPos;
  }, 10);
}

function scheduleAutoSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autoSaveIfChanged(), 1000);
}

function autoSaveIfChanged(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

  const textarea = document.getElementById('preview-editor') as HTMLTextAreaElement | null;
  if (!textarea || !previewFile) return;

  const current = textarea.value;
  if (current === previewOriginalContent) return;

  previewOriginalContent = current;
  vscode.postMessage({
    type: 'saveFile',
    file: previewFile,
    content: current,
    startLine: previewStartLine,
  });
}

function openFile(match: SearchMatch): void {
  vscode.postMessage({
    type: 'openFile',
    file: match.file,
    line: match.line,
    column: match.column,
  });
}

function setStatus(text: string, loading = false): void {
  statusText.innerHTML = loading
    ? `<span class="spinner"></span>${escapeHtml(text)}`
    : escapeHtml(text);
}

function updateStatusSummary(): void {
  const fileCount = allResults.length;
  if (totalMatches > 0) {
    setStatus(`${totalMatches} results in ${fileCount} files`);
  }
}

// ---- Search ----

function triggerSearch(): void {
  const query = getSearchValue().trim();
  const activeInput = getActiveSearchInput();
  if (!query) {
    vscode.postMessage({ type: 'cancel' });
    allResults = [];
    totalMatches = 0;
    selectedIndex = -1;
    renderResults();
    setStatus('');
    previewContent.innerHTML = `<span class="placeholder">${t('preview.empty')}</span>`;
    previewHeader.textContent = '';
    return;
  }

  if (useRegex) {
    try {
      new RegExp(query);
      activeInput.classList.remove('error');
    } catch {
      activeInput.classList.add('error');
      setStatus(t('status.invalidRegex'));
      return;
    }
  } else {
    activeInput.classList.remove('error');
  }

  // 검색 전 현재 편집 내용 저장
  autoSaveIfChanged();

  isSearching = true;
  allResults = [];
  totalMatches = 0;
  selectedIndex = -1;
  renderResults();
  previewContent.innerHTML = '';
  previewHeader.textContent = '';
  setStatus(t('status.searching'), true);

  vscode.postMessage({
    type: 'search',
    options: {
      query,
      folders: [],
      caseSensitive,
      regex: useRegex,
      multiline,
      fileMask: fileMaskInput.value.trim(),
      scopePath: currentScopePath || undefined,
    },
  });
}

function debouncedSearch(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  triggerSearch();
}

function updateResultsFromPreview(): void {
  const textarea = document.getElementById('preview-editor') as HTMLTextAreaElement | null;
  if (!textarea || !previewFile) return;

  const query = getSearchValue().trim();
  if (!query) return;

  const lines = textarea.value.split('\n');
  const fileResult = allResults.find(r => r.file === previewFile);
  if (!fileResult) return;

  // 현재 파일의 매치를 textarea 내용 기준으로 갱신
  const updatedMatches: typeof fileResult.matches = [];
  for (const match of fileResult.matches) {
    const lineIdx = match.line - previewStartLine;
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const lineText = lines[lineIdx];
      // 쿼리가 아직 해당 라인에 있는지 확인
      const searchText = caseSensitive ? lineText : lineText.toLowerCase();
      const searchQuery = caseSensitive ? query : query.toLowerCase();
      if (searchText.includes(searchQuery)) {
        match.text = lineText;
        updatedMatches.push(match);
      }
      // 없으면 매치 제거 (수정으로 사라진 경우)
    } else {
      updatedMatches.push(match);
    }
  }

  fileResult.matches = updatedMatches;

  // 파일의 매치가 0개면 결과에서 제거
  if (updatedMatches.length === 0) {
    allResults = allResults.filter(r => r.file !== previewFile);
  }

  // 전체 매치 수 재계산
  totalMatches = allResults.reduce((sum, r) => sum + r.matches.length, 0);

  // 현재 선택 인덱스 보존하면서 리스트만 다시 그리기
  const currentFile = selectedIndex >= 0 ? flatMatches[selectedIndex]?.file : null;
  const currentLine = selectedIndex >= 0 ? flatMatches[selectedIndex]?.line : null;
  renderResults();
  updateStatusSummary();

  // 이전에 선택했던 매치 복원
  if (currentFile && currentLine) {
    const newIdx = flatMatches.findIndex(m => m.file === currentFile && m.line === currentLine);
    if (newIdx >= 0) {
      selectedIndex = newIdx;
      const el = resultsList.querySelector(`.match-item[data-index="${newIdx}"]`);
      if (el) {
        el.classList.add('selected');
      }
    }
  }
}

// ---- Message handling ----

window.addEventListener('message', (event) => {
  const msg = event.data;

  switch (msg.type) {
    case 'searchProgress':
      handleSearchProgress(msg.data as SearchProgress);
      break;

    case 'historyList':
      historyList = msg.data as string[];
      break;

    case 'replaceResult':
      if (msg.success) {
        setStatus(msg.message);
        setTimeout(triggerSearch, 200);
      } else {
        setStatus(msg.message);
      }
      break;

    case 'fileContent':
      if (selectedIndex >= 0 && flatMatches[selectedIndex]?.file === msg.file) {
        renderPreview(msg.content, msg.startLine, flatMatches[selectedIndex].line);
      }
      break;

    case 'saveResult':
      if (msg.success) {
        previewHeader.textContent = previewHeader.textContent?.replace(` ${t('preview.modified')}`, '') ?? '';
        // 미리보기 편집 내용으로 검색 리스트 즉시 갱신
        updateResultsFromPreview();
      }
      break;

    case 'setMode':
      if (msg.mode === 'replace' && !replaceVisible) {
        toggleReplace();
        replaceInput.focus();
      } else if (msg.mode === 'search' && replaceVisible) {
        toggleReplace();
        searchInput.focus();
      } else {
        (msg.mode === 'replace' ? replaceInput : searchInput).focus();
      }
      break;

    case 'setScope':
      currentScopePath = msg.path;
      updateScopeDisplay();
      // 새 범위 → 초기화 + 포커스
      allResults = [];
      totalMatches = 0;
      selectedIndex = -1;
      renderResults();
      previewContent.innerHTML = '';
      previewHeader.textContent = '';
      getActiveSearchInput().focus();
      if (getSearchValue().trim()) {
        triggerSearch();
      }
      break;

    case 'config':
      document.body.dataset.theme = msg.theme;
      if (msg.lang) {
        initI18n(msg.lang);
      }
      break;
  }
});

function handleSearchProgress(progress: SearchProgress): void {
  switch (progress.type) {
    case 'results':
      if (progress.results) {
        for (const fr of progress.results) {
          const existing = allResults.find(r => r.file === fr.file);
          if (existing) {
            existing.matches.push(...fr.matches);
          } else {
            allResults.push(fr);
          }
        }
        totalMatches = progress.totalMatches ?? totalMatches;
      }
      renderResults();
      updateStatusSummary();

      if (selectedIndex < 0 && flatMatches.length > 0) {
        selectMatch(0);
      }
      break;

    case 'done':
      isSearching = false;
      totalMatches = progress.totalMatches ?? totalMatches;
      updateStatusSummary();
      if (totalMatches === 0) {
        renderResults();
        previewContent.innerHTML = `<span class="placeholder">${t('result.noResults')}</span>`;
        previewHeader.textContent = '';
        setStatus('');
      }
      break;

    case 'error':
      isSearching = false;
      setStatus(progress.error ?? t('error.searchFailed'));
      break;
  }
}

// ---- Keyboard handling ----

searchInput.addEventListener('input', () => {
  historyIndex = -1;
  debouncedSearch();
});

// 붙여넣기 시 개행 포함되면 자동 멀티라인 전환
searchInput.addEventListener('paste', (e) => {
  const text = e.clipboardData?.getData('text') ?? '';
  if (text.includes('\n')) {
    e.preventDefault();
    if (!multiline) {
      toggleMultiline();
    }
    searchInputMulti.value = text;
    searchInputMulti.focus();
    debouncedSearch();
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (e.target === searchInput && historyList.length > 0 && !searchInput.value) {
      historyIndex = Math.min(historyIndex + 1, historyList.length - 1);
      searchInput.value = historyList[historyIndex];
      debouncedSearch();
    } else if (flatMatches.length > 0) {
      selectMatch(selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, flatMatches.length - 1));
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!searchInput.value && historyList.length > 0) {
      historyIndex = Math.max(historyIndex - 1, 0);
      searchInput.value = historyList[historyIndex];
      debouncedSearch();
    } else if (selectedIndex > 0) {
      selectMatch(selectedIndex - 1);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIndex >= 0 && flatMatches[selectedIndex]) {
      openFile(flatMatches[selectedIndex]);
    }
  } else if (e.key === 'Escape') {
    vscode.postMessage({ type: 'closePanel' });
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    fileMaskInput.focus();
  }
});

fileMaskInput.addEventListener('input', debouncedSearch);
fileMaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    vscode.postMessage({ type: 'closePanel' });
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    if (replaceVisible) {
      replaceInput.focus();
    } else if (flatMatches.length > 0) {
      resultsList.focus();
    }
  }
});

resultsList.tabIndex = 0;

// 이벤트 위임: DOM 재생성에도 안정적으로 동작
resultsList.addEventListener('click', (e) => {
  const item = (e.target as HTMLElement).closest('.match-item') as HTMLElement | null;
  if (!item) return;
  const idx = Number(item.dataset.index);
  if (!isNaN(idx)) selectMatch(idx);
});
resultsList.addEventListener('dblclick', (e) => {
  const item = (e.target as HTMLElement).closest('.match-item') as HTMLElement | null;
  if (!item) return;
  const idx = Number(item.dataset.index);
  if (!isNaN(idx) && flatMatches[idx]) openFile(flatMatches[idx]);
});

resultsList.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectMatch(Math.min(selectedIndex + 1, flatMatches.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex > 0) {
      selectMatch(selectedIndex - 1);
    } else {
      searchInput.focus();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIndex >= 0 && flatMatches[selectedIndex]) {
      openFile(flatMatches[selectedIndex]);
    }
  } else if (e.key === 'Escape') {
    vscode.postMessage({ type: 'closePanel' });
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      if (replaceVisible) {
        replaceInput.focus();
      } else {
        fileMaskInput.focus();
      }
    } else if (replaceVisible) {
      replaceInput.focus();
    }
  }
});

replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    vscode.postMessage({ type: 'closePanel' });
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      fileMaskInput.focus();
    } else if (flatMatches.length > 0) {
      resultsList.focus();
    }
  }
});

document.addEventListener('keydown', (e) => {
  // 에디터에서 Esc는 textarea keydown에서 처리
  const target = e.target as HTMLElement;
  if (e.key === 'Escape' && target.id !== 'preview-editor') {
    vscode.postMessage({ type: 'closePanel' });
  }

  if (e.altKey && e.key === 'c') {
    e.preventDefault();
    caseSensitive = !caseSensitive;
    btnCase.classList.toggle('active', caseSensitive);
    debouncedSearch();
  }

  if (e.altKey && e.key === 'r') {
    e.preventDefault();
    useRegex = !useRegex;
    btnRegex.classList.toggle('active', useRegex);
    debouncedSearch();
  }

  if (e.altKey && e.key === 'm') {
    e.preventDefault();
    toggleMultiline();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    toggleReplace();
  }
});

// Toggle buttons
btnCase.addEventListener('click', () => {
  caseSensitive = !caseSensitive;
  btnCase.classList.toggle('active', caseSensitive);
  debouncedSearch();
});

btnRegex.addEventListener('click', () => {
  useRegex = !useRegex;
  btnRegex.classList.toggle('active', useRegex);
  debouncedSearch();
});

btnWord.addEventListener('click', () => {
  btnWord.classList.toggle('active');
});

btnMultiline.addEventListener('click', toggleMultiline);

// 멀티라인 textarea 이벤트
searchInputMulti.addEventListener('input', () => {
  historyIndex = -1;
  debouncedSearch();
});

searchInputMulti.addEventListener('keydown', (e) => {
  // Esc: 패널 닫기
  if (e.key === 'Escape') {
    vscode.postMessage({ type: 'closePanel' });
  }
});

// Replace
function toggleReplace(): void {
  replaceVisible = !replaceVisible;
  replaceRow.style.display = replaceVisible ? 'flex' : 'none';
  btnToggleReplace.classList.toggle('active', replaceVisible);
  btnToggleReplace.textContent = replaceVisible
    ? `${t('btn.replace')} ▲`
    : `${t('btn.replace')} ▼`;
}

btnToggleReplace.addEventListener('click', toggleReplace);

btnReplace.addEventListener('click', () => {
  if (selectedIndex < 0 || !flatMatches[selectedIndex]) return;
  const match = flatMatches[selectedIndex];
  const query = getSearchValue().trim();
  if (!query) return;

  // 선택된 라인 1건 교체
  vscode.postMessage({
    type: 'replace',
    file: match.file,
    line: match.line,
    column: match.column,
    oldText: query,
    newText: getReplaceValue(),
    regex: useRegex,
  });
});

btnReplaceAll.addEventListener('click', () => {
  const query = getSearchValue().trim();
  if (!query) return;
  const files = allResults.map(r => r.file);
  if (files.length === 0) return;

  // 전체 바꾸기 요청 후 즉시 에디터로 이동
  vscode.postMessage({
    type: 'replaceAll',
    query,
    replace: getReplaceValue(),
    caseSensitive,
    regex: useRegex,
    files,
  });
  vscode.postMessage({ type: 'openLastEditor' });
});

// ---- Scope ----
function updateScopeDisplay(): void {
  if (currentScopePath) {
    const short = currentScopePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
    scopeLabel.textContent = `Scope: ${short}`;
    scopeRow.style.display = 'flex';
  } else {
    scopeRow.style.display = 'none';
  }
}

btnClearScope.addEventListener('click', () => {
  currentScopePath = '';
  updateScopeDisplay();
  if (getSearchValue().trim()) {
    triggerSearch();
  }
});

// ---- Init ----
vscode.postMessage({ type: 'ready' });

setTimeout(() => {
  searchInput.focus();
  vscode.postMessage({ type: 'getHistory' });
}, 50);
