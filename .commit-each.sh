#!/bin/bash
set -e
cd "$(dirname "$0")"

{
  git diff --name-only
  git ls-files --others --exclude-standard
} | grep -v '__pycache__' | grep -v '\.pyc$' | grep -v '^\.DS_Store$' | grep -v '^backend/\.env$' | grep -v '^backend/db\.sqlite3$' | sort -u | while IFS= read -r file; do
  [ -z "$file" ] && continue
  git add "$file"
  git commit -m "chore: update $file"
  echo "Committed: $file"
done

echo "All files committed."
