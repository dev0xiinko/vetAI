#!/usr/bin/env bash
# PostToolUse hook: format files Claude edits/writes with Prettier.
# Opt in by adding the snippet from SETUP.md to .claude/settings.json.
# Reads the tool-call JSON on stdin and formats the touched file if it's one we care about.

set -euo pipefail

input="$(cat)"

# Extract the file path from the tool input (Edit/Write put it in file_path).
file="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||"")}catch{process.stdout.write("")}})')"

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    npx prettier --write "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
