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

git diff upstream/develop HEAD -- \
    .typedoc.json README_RU.md \
    src/renderer/embed/index.html src/renderer/index.html \
    src/renderer/components/ExtensionManager.vue \
    src/renderer/others/extension.ts \
    src/renderer/__tests__/others/extension.ts \
    src/renderer/services/export.ts src/renderer/services/view.ts \
    src/renderer/support/ga.ts \
    src/main/app.ts \
    help/FEATURES.md help/FEATURES_ZH-CN.md help/PLUGIN.md help/PLUGIN_ZH-CN.md \
    src/share/i18n/languages/en.ts src/share/i18n/languages/ru.ts \
    src/share/i18n/languages/zh-CN.ts src/share/i18n/languages/zh-TW.ts \
    > "$PATCH_DIR/008-brand-name-global.patch"

git diff upstream/develop HEAD -- \
    src/renderer/plugins/status-bar-help.tsx \
    src/renderer/support/args.ts \
    > "$PATCH_DIR/009-links-navyum.patch"

git diff upstream/develop HEAD -- \
    src/renderer/plugins/image-hosting-picgo.ts \
    src/renderer/types.ts \
    > "$PATCH_DIR/010-picgo-image-format.patch"

git diff upstream/develop HEAD -- \
    electron-builder.json \
    scripts/notarize.js \
    > "$PATCH_DIR/011-build-config.patch"

# Remove empty patches
find "$PATCH_DIR" -name "*.patch" -empty -delete

echo "[PATCH] Done. Current patches:"
ls -la "$PATCH_DIR"/*.patch 2>/dev/null || echo "  (no patches)"
