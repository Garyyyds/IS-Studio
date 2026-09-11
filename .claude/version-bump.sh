#!/usr/bin/env bash
# Auto-version hook for IS Studio.
#
# Runs on the Stop event, after Claude finishes a turn. If the turn changed
# anything, it commits the work, tags it with the next DDMMYYYYverNNN version
# and appends a row to VERSIONS.md. A turn that changed nothing produces no
# version, so the tag list stays a list of real restore points.
#
# The description comes from .claude/.version-note when Claude wrote one during
# the turn; otherwise it falls back to the list of changed files.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 0

# Not a git repo, or git missing: do nothing rather than fail the turn.
command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

NOTE_FILE="$REPO/.claude/.version-note"
LOG_FILE="$REPO/VERSIONS.md"

# data/server-storage.json is a runtime cache the server rewrites on every read.
# Committing it would put a meaningless timestamp diff in every single version.
EXCLUDE_CACHE="data/server-storage.json"
EXCLUDE_NOTE=".claude/.version-note"

git add -A >/dev/null 2>&1
git reset -q -- "$EXCLUDE_CACHE" "$EXCLUDE_NOTE" >/dev/null 2>&1

# Nothing staged means the turn changed no files - no version for this turn.
if git diff --cached --quiet; then
  rm -f "$NOTE_FILE"
  exit 0
fi

DATE="$(date +%d%m%Y)"

# Next counter for today: highest existing NNN on a tag for this date, plus one.
# Counters restart at 000 each day, so yesterday's tags never affect today.
HIGHEST="$(git tag --list "${DATE}ver*" \
  | sed -n "s/^${DATE}ver\([0-9][0-9][0-9]\)$/\1/p" \
  | sed 's/^0*\([0-9]\)/\1/' \
  | sort -n \
  | tail -1)"
[ -z "$HIGHEST" ] && HIGHEST=-1
NEXT="$(printf '%03d' "$((HIGHEST + 1))")"
VERSION="${DATE}ver${NEXT}"

# Guard against a collision (a tag already at that name) rather than overwrite.
if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null 2>&1; then
  echo "{\"systemMessage\": \"Version $VERSION already exists - skipped auto-versioning. Commit manually.\"}"
  exit 0
fi

if [ -s "$NOTE_FILE" ]; then
  SUMMARY="$(tr '\n' ' ' < "$NOTE_FILE" | sed 's/  */ /g; s/^ //; s/ $//')"
else
  FILES="$(git diff --cached --name-only | head -6 | tr '\n' ' ' | sed 's/ $//')"
  COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
  SUMMARY="Changed $COUNT file(s): $FILES"
fi

# Escape the pipe so a summary containing one cannot break the markdown table.
ROW_SUMMARY="$(printf '%s' "$SUMMARY" | sed 's/|/\\|/g')"
printf '| `%s` | %s | %s |\n' "$VERSION" "$(date +%Y-%m-%d)" "$ROW_SUMMARY" >> "$LOG_FILE"

git add -- "$LOG_FILE" >/dev/null 2>&1

git commit -q -m "$VERSION: $SUMMARY" >/dev/null 2>&1 || {
  echo "{\"systemMessage\": \"Auto-version: commit failed for $VERSION. Working tree left staged.\"}"
  exit 0
}

git tag -a "$VERSION" -m "$SUMMARY" >/dev/null 2>&1 || {
  echo "{\"systemMessage\": \"Auto-version: committed but tagging $VERSION failed.\"}"
  exit 0
}

rm -f "$NOTE_FILE"

echo "{\"systemMessage\": \"Saved $VERSION - $SUMMARY\"}"
exit 0
