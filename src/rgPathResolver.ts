import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { execFileSync } from 'child_process';

let cachedPath: string | undefined;

const rgBin = process.platform === 'win32' ? 'rg.exe' : 'rg';

const candidates = [
  (root: string) => path.join(root, 'node_modules', '@vscode', 'ripgrep', 'bin', rgBin),
  (root: string) => path.join(root, 'node_modules', 'vscode-ripgrep', 'bin', rgBin),
  (root: string) => path.join(root, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', rgBin),
  (root: string) => path.join(root, 'node_modules.asar.unpacked', 'vscode-ripgrep', 'bin', rgBin),
];

export function resolveRgPath(): string {
  if (cachedPath) return cachedPath;

  const tried: string[] = [];

  // 1) vscode.env.appRoot 기반
  const appRoot = vscode.env.appRoot;
  for (const fn of candidates) {
    const p = fn(appRoot);
    tried.push(p);
    if (fs.existsSync(p)) {
      cachedPath = p;
      return cachedPath;
    }
  }

  // 2) process.execPath 기반 (Electron 바이너리 옆)
  const execDir = path.join(path.dirname(process.execPath), 'resources', 'app');
  for (const fn of candidates) {
    const p = fn(execDir);
    tried.push(p);
    if (fs.existsSync(p)) {
      cachedPath = p;
      return cachedPath;
    }
  }

  // 3) PATH에서 rg 찾기
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = execFileSync(cmd, ['rg'], { encoding: 'utf-8' }).trim();
    if (result) {
      cachedPath = result.split('\n')[0].trim();
      return cachedPath;
    }
  } catch {
    // 다음 단계로
  }

  // 4) @vscode/ripgrep 패키지 require
  try {
    const rgPkg = require('@vscode/ripgrep');
    if (rgPkg.rgPath && fs.existsSync(rgPkg.rgPath)) {
      cachedPath = rgPkg.rgPath as string;
      return cachedPath!;
    }
  } catch {
    // 최종 실패
  }

  throw new Error(
    'ripgrep not found.\nTried paths:\n' + tried.join('\n')
  );
}
