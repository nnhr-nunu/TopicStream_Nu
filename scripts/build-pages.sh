#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API_BACKUP=""
WATCH_ID_BACKUP=""
cleanup() {
  if [ -n "$API_BACKUP" ] && [ -d "$API_BACKUP" ] && [ ! -d src/app/api ]; then
    mv "$API_BACKUP" src/app/api
  fi
  if [ -n "$WATCH_ID_BACKUP" ] && [ -d "$WATCH_ID_BACKUP" ] && [ ! -d src/app/watch/'[id]' ]; then
    mv "$WATCH_ID_BACKUP" src/app/watch/'[id]'
  fi
}
trap cleanup EXIT
if [ -d src/app/api ]; then
  API_BACKUP="$(mktemp -d)"
  mv src/app/api "$API_BACKUP/api"
  API_BACKUP="$API_BACKUP/api"
fi
if [ -d src/app/watch/'[id]' ]; then
  WATCH_ID_BACKUP="$(mktemp -d)"
  mv src/app/watch/'[id]' "$WATCH_ID_BACKUP/[id]"
  WATCH_ID_BACKUP="$WATCH_ID_BACKUP/[id]"
fi
export STATIC_EXPORT=1
npx next build
