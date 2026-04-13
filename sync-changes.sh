#!/bin/bash
# Sync only changed files from THIS repo to TARGET repo
# Usage: bash sync-changes.sh /path/to/target/repo
# & "C:\Program Files\Git\bin\bash.exe" sync-changes.sh C:\Users\roman\Desktop\bim-pdf

TARGET="$1"

if [ -z "$TARGET" ]; then
  echo "Usage: bash sync-changes.sh /path/to/target/repo"
  echo "Example: bash sync-changes.sh /c/Users/roman/Desktop/redlines-main"
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "Error: Target directory '$TARGET' does not exist"
  exit 1
fi

SOURCE="$(pwd)"
COUNT=0
SKIPPED=0

echo "═══════════════════════════════════════════"
echo "  Syncing changes: $SOURCE → $TARGET"
echo "═══════════════════════════════════════════"

# Get all modified/added/untracked files (skip deleted)
git status --porcelain | while IFS= read -r line; do
  status="${line:0:2}"
  file="${line:3}"

  # Skip deleted files
  if [[ "$status" == " D" || "$status" == "D " || "$status" == "DD" ]]; then
    echo "  [SKIP DEL] $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Skip if file doesn't exist (deleted or renamed)
  if [ ! -f "$SOURCE/$file" ]; then
    echo "  [SKIP] $file (not found)"
    continue
  fi

  # Create target directory if needed
  target_dir="$TARGET/$(dirname "$file")"
  mkdir -p "$target_dir"

  # Copy file
  cp "$SOURCE/$file" "$TARGET/$file"
  echo "  [COPY] $file"
  COUNT=$((COUNT + 1))
done

# Also copy new (untracked) files
git ls-files --others --exclude-standard | while IFS= read -r file; do
  if [ -f "$SOURCE/$file" ]; then
    target_dir="$TARGET/$(dirname "$file")"
    mkdir -p "$target_dir"
    cp "$SOURCE/$file" "$TARGET/$file"
    echo "  [NEW]  $file"
  fi
done

echo ""
echo "═══════════════════════════════════════════"
echo "  Done! Synced files to $TARGET"
echo "═══════════════════════════════════════════"
