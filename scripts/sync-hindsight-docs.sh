#!/usr/bin/env bash
# Sync hindsight-docs agent skill from vectorize-io/hindsight.
# Usage:
#   ./scripts/sync-hindsight-docs.sh
#   HINDSIGHT_REPO=/path/to/hindsight ./scripts/sync-hindsight-docs.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.agents/skills/hindsight-docs"
REPO="${HINDSIGHT_REPO:-/tmp/hindsight-docs-src}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "→ Cloning vectorize-io/hindsight (depth 1)…"
  git clone --depth 1 https://github.com/vectorize-io/hindsight.git "$REPO"
else
  echo "→ Pulling $REPO…"
  git -C "$REPO" pull --ff-only
fi

echo "→ Generating skill from hindsight-docs…"
bash "$REPO/scripts/generate-docs-skill.sh"

echo "→ Copying to $DEST…"
mkdir -p "$DEST"
rsync -a --delete "$REPO/skills/hindsight-docs/" "$DEST/"

echo "→ Adding cookbook (not in upstream generator)…"
COOKBOOK_SRC="$REPO/hindsight-docs/src/pages/cookbook"
COOKBOOK_DEST="$DEST/references/cookbook"
if [[ -d "$COOKBOOK_SRC" ]]; then
  mkdir -p "$COOKBOOK_DEST/recipes" "$COOKBOOK_DEST/applications"
  for f in "$COOKBOOK_SRC/recipes"/*.md; do
    [[ -f "$f" ]] && cp "$f" "$COOKBOOK_DEST/recipes/"
  done
  for f in "$COOKBOOK_SRC/applications"/*.md; do
    [[ -f "$f" ]] && cp "$f" "$COOKBOOK_DEST/applications/"
  done
  echo "   cookbook: $(find "$COOKBOOK_DEST" -name '*.md' | wc -l | tr -d ' ') files"
fi

# db_mem overlay — preserved across sync
if [[ -f "$ROOT/scripts/hindsight-docs-overlay/TOPIC-INDEX.md" ]]; then
  cp "$ROOT/scripts/hindsight-docs-overlay/TOPIC-INDEX.md" "$DEST/references/TOPIC-INDEX.md"
fi
if [[ -f "$ROOT/scripts/hindsight-docs-overlay/SKILL-append.md" ]]; then
  # Append portal topic index (strip prior append if re-syncing)
  head -n -0 "$DEST/SKILL.md" > "$DEST/SKILL.md.tmp" 2>/dev/null || cp "$DEST/SKILL.md" "$DEST/SKILL.md.tmp"
  sed -i '' '/^## db_mem portal topic index/,$d' "$DEST/SKILL.md.tmp" 2>/dev/null || \
    sed -i '/^## db_mem portal topic index/,$d' "$DEST/SKILL.md.tmp"
  cat "$ROOT/scripts/hindsight-docs-overlay/SKILL-append.md" >> "$DEST/SKILL.md.tmp"
  mv "$DEST/SKILL.md.tmp" "$DEST/SKILL.md"
fi

echo "✓ hindsight-docs synced ($(find "$DEST/references" -type f | wc -l | tr -d ' ') reference files)"
