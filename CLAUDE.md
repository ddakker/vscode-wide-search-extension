# Wide Search Extension — Development Guide

## Project Overview

Full-width "Find in Files" for VSCode.
Editor tab-based search panel with flat result list + editable preview.

## Build & Package

```bash
npm install          # install dependencies
npm run build        # esbuild (extension + webview)
npm run watch        # watch mode
./package.sh         # build + vsce package + install instructions
```

Two esbuild entry points:
- `src/extension.ts` → `dist/extension.js` (Node/CJS, externals: vscode)
- `src/webview/app.ts` → `dist/webview/app.js` (Browser/IIFE)

## Architecture

```
Extension Host (Node.js)          Webview (Browser)
┌─────────────────────┐           ┌─────────────────────┐
│ extension.ts        │           │ app.ts              │
│ searchEngine.ts     │◄─postMsg─►│ styles.css          │
│ webviewPanel.ts     │           │                     │
│ replaceEngine.ts    │           │ textarea editor     │
│ historyManager.ts   │           │ highlight overlay   │
│ rgPathResolver.ts   │           └─────────────────────┘
└─────────────────────┘
         │
    child_process.spawn
         │
    ┌────▼────┐
    │ ripgrep │
    └─────────┘
```

### Key Design Decisions

1. **ripgrep via child_process.spawn** (not `findTextInFiles` API)
   - Reason: `--json`, `--multiline`, streaming, cancellation support
   - `shell: false` (default) for command injection safety

2. **Webview with textarea** (not Monaco or contenteditable)
   - Reason: Monaco bundle too heavy, contenteditable unreliable
   - Highlight overlay behind transparent textarea for match line background

3. **Flat result list** (not file-grouped tree)
   - Reason: Simpler selection model, no collapse/expand complexity

4. **No debounce on search** (immediate trigger)
   - Previous rg process is killed on each keystroke
   - Cancelled process events are ignored via `currentProcess !== proc` check

## Module Responsibilities

| Module | File | Key Points |
|--------|------|------------|
| Entry | `extension.ts` | Register 3 commands, create output channel |
| Types | `types.ts` | `ExtToWebMessage`, `WebToExtMessage`, `SearchOptions` |
| rg Path | `rgPathResolver.ts` | 4-step detection, Windows `.exe` handling, caches result |
| Search | `searchEngine.ts` | spawn rg, JSON stream parse, batch results (50ms/20 items) |
| Panel | `webviewPanel.ts` | Singleton panel, CSP+nonce, file content serving, save handler |
| Replace | `replaceEngine.ts` | WorkspaceEdit + immediate save, skip binary files |
| History | `historyManager.ts` | globalState, max 50, dedup on add |
| UI | `webview/app.ts` | All webview logic, keyboard nav, multiline, auto-save |
| Styles | `webview/styles.css` | VSCode CSS variables, editor overlay, flat list |

## Message Protocol

### Extension → Webview
- `searchProgress` — streaming results / done / error
- `historyList` — search history array
- `replaceResult` — success/fail + message
- `fileContent` — file content for preview (200 lines around match)
- `saveResult` — auto-save result
- `setMode` — switch search/replace mode
- `config` — theme (dark/light)

### Webview → Extension
- `search` — trigger search with options
- `cancel` — kill current rg process
- `openFile` — open file in editor at line/column
- `replace` — replace single match
- `replaceAll` — replace in specified files
- `requestFileContent` — request file content for preview
- `saveFile` — save edited preview content
- `openLastEditor` — focus previous editor (after replace all)
- `closePanel` — dispose panel
- `ready` — webview loaded

## rg Path Resolution Order (Cross-platform)

1. `vscode.env.appRoot` + 4 candidate paths (including `.asar.unpacked`)
2. `process.execPath` parent + `resources/app` + 4 candidate paths
3. `which rg` (Linux/macOS) or `where rg.exe` (Windows)
4. `require('@vscode/ripgrep').rgPath`

Windows: all paths use `rg.exe` instead of `rg`.

## Keybinding Registration

- Uses `-` prefix to unbind conflicting VSCode defaults
- Registers both `Ctrl+Shift+R` and VSCode default `Ctrl+Shift+H` for replace
- Webview internal shortcuts: `Alt+C`, `Alt+R`, `Alt+M`, `Esc`

## Known Limitations

- No syntax highlighting in preview (textarea limitation, Shiki would need separate render layer)
- File icons are emoji-based (no SVG icon set)
- `openFileSearch` command registered but not implemented
- Multiline replace in `replaceEngine` operates line-by-line (doesn't handle cross-line patterns)
- `retainContextWhenHidden: true` may consume memory on long sessions

## Testing

No automated tests yet. Manual testing checklist:
1. Search with various queries (fixed string, regex, multiline)
2. Replace single + replace all + verify file saved
3. Preview editing + auto-save + result list update
4. Keyboard navigation (arrows, Enter, Esc, Tab)
5. Windows + Linux + macOS rg path resolution
6. Large repo (500+ results limit)
7. Binary file handling
