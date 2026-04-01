import { spawn, ChildProcess } from 'child_process';
import { resolveRgPath } from './rgPathResolver';
import { SearchOptions, SearchMatch, FileResult, SearchProgress } from './types';

const MAX_RESULTS = 500;
const BATCH_INTERVAL = 50;
const MAX_BATCH_SIZE = 20;

let outputChannel: { appendLine(msg: string): void } | undefined;

export function setOutputChannel(ch: { appendLine(msg: string): void }): void {
  outputChannel = ch;
}

function log(msg: string): void {
  outputChannel?.appendLine(`[WideSearch] ${msg}`);
}

export class SearchEngine {
  private currentProcess: ChildProcess | null = null;

  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  search(
    options: SearchOptions,
    onProgress: (progress: SearchProgress) => void
  ): void {
    this.cancel();

    const rgPath = resolveRgPath();
    const args = this.buildArgs(options);

    log(`rg path: ${rgPath}`);
    log(`rg args: ${JSON.stringify(args)}`);
    console.log(`[WideSearch] rg path: ${rgPath}`);
    console.log(`[WideSearch] rg args:`, args);

    const proc = spawn(rgPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.currentProcess = proc;

    let totalMatches = 0;
    let buffer = '';
    const pendingResults = new Map<string, FileResult>();
    let batchTimer: NodeJS.Timeout | null = null;

    const flush = () => {
      if (pendingResults.size === 0) return;
      const results = Array.from(pendingResults.values());
      pendingResults.clear();
      onProgress({ type: 'results', results, totalMatches });
    };

    const scheduleBatch = () => {
      if (!batchTimer) {
        batchTimer = setTimeout(() => {
          batchTimer = null;
          flush();
        }, BATCH_INTERVAL);
      }
    };

    proc.stdout!.on('data', (chunk: Buffer) => {
      if (this.currentProcess !== proc) return;
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        if (totalMatches >= MAX_RESULTS) continue;

        try {
          const msg = JSON.parse(line);
          const match = this.parseRgMessage(msg);
          if (!match) continue;

          totalMatches++;
          let fileResult = pendingResults.get(match.file);
          if (!fileResult) {
            fileResult = { file: match.file, matches: [] };
            pendingResults.set(match.file, fileResult);
          }
          fileResult.matches.push(match);

          if (pendingResults.size >= MAX_BATCH_SIZE) {
            if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
            flush();
          } else {
            scheduleBatch();
          }
        } catch {
          // JSON 파싱 실패 — 해당 라인 무시
        }
      }
    });

    let stderrBuf = '';
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf-8');
    });

    proc.on('close', (code) => {
      log(`rg exited: code=${code}, stderr=${stderrBuf}, matches=${totalMatches}`);
      console.log(`[WideSearch] rg exited: code=${code}, stderr=${stderrBuf}, matches=${totalMatches}`);

      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }

      // 이미 취소된 프로세스면 무시
      if (this.currentProcess !== proc) {
        return;
      }
      this.currentProcess = null;

      flush();

      if (code !== null && code !== 0 && code !== 1) {
        onProgress({
          type: 'error',
          error: stderrBuf.trim() || 'Search error',
        });
        return;
      }

      onProgress({
        type: 'done',
        totalMatches,
        totalFiles: 0,
      });
    });

    proc.on('error', (err) => {
      log(`rg spawn error: ${err.message}`);
      this.currentProcess = null;
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        onProgress({
          type: 'error',
          error: `ripgrep not found (path: ${rgPath})`,
        });
      } else {
        onProgress({ type: 'error', error: `Search error: ${err.message}` });
      }
    });
  }

  private buildArgs(options: SearchOptions): string[] {
    const args = ['--json'];

    if (!options.caseSensitive) {
      args.push('--ignore-case');
    }

    if (options.multiline) {
      args.push('--multiline');
    }

    if (options.regex || options.multiline) {
      // 멀티라인: \n을 실제 줄바꿈 패턴으로 변환, 정규식 필수
      const query = options.multiline && !options.regex
        ? options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\n')
        : options.query;
      args.push('--regexp', query);
    } else {
      args.push('--fixed-strings', options.query);
    }

    if (options.fileMask) {
      const masks = options.fileMask.split(',').map(m => m.trim()).filter(Boolean);
      for (const mask of masks) {
        args.push('--glob', mask);
      }
    }

    args.push(...options.folders);
    return args;
  }

  private parseRgMessage(msg: Record<string, unknown>): SearchMatch | null {
    if (msg.type !== 'match') return null;

    const data = msg.data as Record<string, unknown>;
    if (!data) return null;

    const pathObj = data.path as Record<string, string>;
    const file = pathObj?.text;
    if (!file) return null;

    const lineNumber = data.line_number as number;
    const linesObj = data.lines as Record<string, string>;
    const text = linesObj?.text?.trimEnd() ?? '';

    const submatches = data.submatches as Array<Record<string, unknown>>;
    const column = submatches?.[0]?.start as number ?? 0;

    return {
      file,
      line: lineNumber,
      column,
      text,
      contextBefore: [],
      contextAfter: [],
    };
  }
}
