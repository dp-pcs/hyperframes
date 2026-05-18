#!/usr/bin/env bash
set -euo pipefail

# Sync the upstream hyperframes skill content into the amplifier-video-worker
# package so it ships inside the Docker image. Run this manually whenever the
# upstream skill files change.

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"
SOURCE_HYPERFRAMES="$REPO_ROOT/skills/hyperframes"
SOURCE_GSAP="$REPO_ROOT/skills/gsap"
DEST="$PACKAGE_DIR/skills"

if [ ! -d "$SOURCE_HYPERFRAMES" ]; then
  echo "Missing $SOURCE_HYPERFRAMES — run from inside the hyperframes repo." >&2
  exit 1
fi

mkdir -p "$DEST/hyperframes"
cp "$SOURCE_HYPERFRAMES/SKILL.md" "$DEST/hyperframes/"
cp "$SOURCE_HYPERFRAMES/house-style.md" "$DEST/hyperframes/"
cp "$SOURCE_HYPERFRAMES/patterns.md" "$DEST/hyperframes/"
cp "$SOURCE_HYPERFRAMES/visual-styles.md" "$DEST/hyperframes/"
cp "$SOURCE_HYPERFRAMES/data-in-motion.md" "$DEST/hyperframes/"

mkdir -p "$DEST/gsap"
cp "$SOURCE_GSAP/SKILL.md" "$DEST/gsap/"

echo "Synced skill content to $DEST"
