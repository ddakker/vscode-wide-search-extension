import * as vscode from 'vscode';

const HISTORY_KEY = 'wideSearch.history';
const MAX_HISTORY = 50;

export class HistoryManager {
  constructor(private globalState: vscode.Memento) {}

  getHistory(): string[] {
    return this.globalState.get<string[]>(HISTORY_KEY, []);
  }

  getLastQuery(): string {
    const history = this.getHistory();
    return history[0] ?? '';
  }

  async addQuery(query: string): Promise<void> {
    if (!query.trim()) return;

    const history = this.getHistory();
    const filtered = history.filter(h => h !== query);
    filtered.unshift(query);

    if (filtered.length > MAX_HISTORY) {
      filtered.length = MAX_HISTORY;
    }

    try {
      await this.globalState.update(HISTORY_KEY, filtered);
    } catch {
      // globalState 쓰기 실패 — 무시
    }
  }
}
