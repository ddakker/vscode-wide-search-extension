# Wide Search

Full-width **Find in Files** for Visual Studio Code.

[한국어](README_ko.md)

## Why?

VSCode's built-in search (`Ctrl+Shift+F`) opens in the sidebar with a narrow preview. A wide, editor-tab-based search panel feels so much better.

**Wide Search** replaces the default search with a full-width editor tab:
- Flat result list with highlighted matches
- Editable preview — fix code right in the search panel
- Instant search as you type

<img src="wide-search.png" alt="Wide Search" />

## Features

- **Instant search** — results stream in as you type, powered by ripgrep
- **Replace** — single match or replace all across files, saves immediately
- **Editable preview** — click a result, edit directly, auto-saves after 1 second
- **Flat result list** — every match on its own line with filename and line number
- **Regex replace** — supports `\n`, `\t` escape sequences and `$1` capture groups
- **Multiline search & replace** — `M` button or paste multiline text to auto-activate
- **Folder scope** — right-click a folder in Explorer to search within it only
- **Auto-save before search** — unsaved files are automatically saved so ripgrep can find them
- **Search history** — up to 50 queries, navigate with arrow keys
- **Filters** — file mask (e.g. `*.ts, *.java`), case sensitive, regex
- **Keyboard-driven** — full navigation without the mouse
- **Theme sync** — respects your VSCode color theme
- **i18n** — English and Korean, auto-detected from VSCode language setting
- **Cross-platform** — Windows, Linux, macOS

## Installation

### From VS Code Extension Marketplace

1. Open Extensions (`Ctrl+Shift+X`)
2. Search for **"Wide Search"** and click **Install**

You can also install it from the [VS Code Marketplace website](https://marketplace.visualstudio.com/vscode) by searching for "Wide Search".

### From VSIX (Manual Build)

```bash
git clone https://github.com/ddakker/vscode-wide-search-extension
cd vscode-wide-search-extension
npm install
./package.sh
code --install-extension wide-search-0.1.0.vsix
```

### From VS Code UI (VSIX)

1. Open Extensions (`Ctrl+Shift+X`)
2. Click `...` → **Install from VSIX...**
3. Select the `.vsix` file

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+F` | Open search panel |
| `Ctrl+Shift+R` | Open replace panel |
| `Ctrl+Shift+H` | Open replace panel (VSCode default) |

### Search panel

| Shortcut | Action |
|----------|--------|
| Type in search box | Instant search |
| `↑` / `↓` | Navigate results / browse history |
| `Enter` | Open file at match line |
| `Esc` | Close panel / return to search from editor |
| `Tab` / `Shift+Tab` | Move focus: search → results → replace |
| `Alt+C` | Toggle case sensitive |
| `Alt+R` | Toggle regex |
| `Alt+M` | Toggle multiline |
| Double-click | Open file at match line |

### Preview editor

| Shortcut | Action |
|----------|--------|
| Edit text | Auto-saves after 1 second |
| `Esc` | Return to search input |
| `Tab` | Insert tab character |

## Usage

### Search

1. `Ctrl+Shift+F` to open
2. Type — results appear instantly
3. Click a result to preview
4. Double-click or `Enter` to open in editor

### Replace

1. `Ctrl+Shift+R` (or `Ctrl+Shift+H`) to open with replace
2. Enter search and replacement text
3. **Replace** — replaces selected match (1 occurrence)
4. **Replace All** — replaces all matches, then returns to editor
5. In regex mode, `\n`/`\t` in replacement are converted to actual newline/tab

### Folder Scope

1. Right-click a folder in Explorer → **Wide Search: Find in Folder**
2. Search is limited to that folder (shown in the scope bar)
3. Click **X** to clear scope and search all files

### Multiline

- Click **M** or press `Alt+M` to toggle multiline mode
- Search and replace inputs expand to multi-line textareas
- Paste text with newlines to auto-activate

### Edit in Preview

- Click a result to load the file in the preview
- Edit directly — changes auto-save after 1 second
- Result list updates in real-time as you edit

## Requirements

- VSCode 1.85.0+
- ripgrep (bundled with VSCode)

## License

Apache License 2.0
