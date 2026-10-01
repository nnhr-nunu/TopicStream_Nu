#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# 静的エクスポートで作れない route（API・動的な共有ページ）を、ビルドの間だけ退避する。
# 退避先はリポジトリの中（同じドライブ）にする。別のドライブ（Windows の一時フォルダは C:）だと mv がコピー＋削除になり、
# 途中で失敗すると src/app/api が半分だけ残る。同じドライブなら名前の付け替えだけなので、移るか移らないかのどちらか
STASH="$ROOT/.pages-stash"
MOVED=()
restore() {
  for path in "${MOVED[@]}"; do
    local saved="$STASH/$(printf '%s' "$path" | tr '/' '_')"
    if [ -d "$saved" ] && [ ! -e "$path" ]; then
      mv "$saved" "$path"
    elif [ -d "$saved" ]; then
      echo "退避した $path を戻せませんでした（$saved に残っています）" >&2
    fi
  done
  rmdir "$STASH" 2>/dev/null || true
}
trap restore EXIT
stash() {
  local path="$1"
  [ -d "$path" ] || return 0
  mkdir -p "$STASH"
  mv "$path" "$STASH/$(printf '%s' "$path" | tr '/' '_')"
  MOVED+=("$path")
}
stash src/app/api
stash 'src/app/watch/[id]'
# 開発サーバーが作った型の一覧（.next/dev/types）には、退避した api・watch/[id] への参照が残っている。
# 残したままだと型チェックで「モジュールが無い」と落ちるので消す（次に開発サーバーを動かせば作り直される）
rm -rf .next/dev/types
export STATIC_EXPORT=1
npx next build
