#!/bin/bash
set -e

# Regenerate all patches from current diff against upstream
# Run this after modifying any customization to keep patches in sync

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_DIR="$REPO_ROOT/.patches"

cd "$REPO_ROOT"

echo "[PATCH] Regenerating patches from diff against upstream/develop..."

git fetch upstream 2>/dev/null || true

git diff upstream/develop HEAD -- src/renderer/others/premium.ts \
    > "$PATCH_DIR/001-premium-bypass.patch"

git diff upstream/develop HEAD -- src/renderer/components/Premium.vue \
    > "$PATCH_DIR/002-premium-email.patch"

git diff upstream/develop HEAD -- src/renderer/components/TitleBar.vue \
    > "$PATCH_DIR/003-brand-titlebar.patch"

git diff upstream/develop HEAD -- src/renderer/plugins/markdown-front-matter/index.ts \
    > "$PATCH_DIR/004-brand-frontmatter.patch"

git diff upstream/develop HEAD -- package.json \
    > "$PATCH_DIR/005-brand-package.patch"

git diff upstream/develop HEAD -- README.md README_ZH-CN.md \
    > "$PATCH_DIR/006-readme.patch"

git diff upstream/develop HEAD -- .github/workflows/release.yml \
    > "$PATCH_DIR/007-ci-mac-only.patch"

# Remove empty patches
find "$PATCH_DIR" -name "*.patch" -empty -delete

echo "[PATCH] Done. Current patches:"
ls -la "$PATCH_DIR"/*.patch 2>/dev/null || echo "  (no patches)"
