#!/bin/bash
set -e

cd "$(dirname "$0")"

if ! command -v vsce &> /dev/null; then
  echo "vsce가 설치되어 있지 않습니다. 설치합니다..."
  npm install -g @vscode/vsce
fi

if [ "$1" = "--release" ]; then
  echo "[릴리즈 빌드] console.log 제거됨"
  node esbuild.mjs --release
else
  echo "[개발 빌드] console.log 유지됨"
  node esbuild.mjs
fi

vsce package --allow-missing-repository --no-dependencies

VSIX=$(ls -t *.vsix | head -1)
echo ""
echo "패키징 완료: $VSIX"
echo ""
echo "=== 설치 방법 ==="
echo "1) VS Code UI: Extensions(Ctrl+Shift+X) → ··· → VSIX에서 설치... → $VSIX 선택"
echo "2) 명령어:     code --install-extension $VSIX"
