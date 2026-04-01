#!/bin/bash
set -e

# MarkNote upstream sync script
# Syncs upstream/develop and re-applies local customizations

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_DIR="$REPO_ROOT/.patches"
UPSTREAM_BRANCH="upstream/develop"
LOCAL_BRANCH="develop"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[SYNC]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$REPO_ROOT"

# 1. Pre-check
if [ -n "$(git status --porcelain)" ]; then
    error "Working tree not clean. Commit or stash first."
    exit 1
fi

current_branch=$(git branch --show-current)
if [ "$current_branch" != "$LOCAL_BRANCH" ]; then
    error "Not on $LOCAL_BRANCH branch (current: $current_branch)"
    exit 1
fi

# 2. Fetch upstream
log "Fetching upstream..."
git fetch upstream

# 3. Check if there are new changes
LOCAL_HEAD=$(git rev-parse HEAD)
UPSTREAM_HEAD=$(git rev-parse $UPSTREAM_BRANCH)
MERGE_BASE=$(git merge-base HEAD $UPSTREAM_BRANCH)

if [ "$UPSTREAM_HEAD" = "$MERGE_BASE" ]; then
    log "Already up to date with upstream. Nothing to do."
    exit 0
fi

BEHIND=$(git rev-list --count HEAD..$UPSTREAM_BRANCH)
AHEAD=$(git rev-list --count $UPSTREAM_BRANCH..HEAD)
log "Status: ${BEHIND} commits behind upstream, ${AHEAD} commits ahead (local changes)"

# 4. Merge upstream (accept upstream for conflicting files, we'll re-apply patches)
log "Merging upstream/develop..."
if git merge $UPSTREAM_BRANCH -m "Merge upstream/develop into $LOCAL_BRANCH" 2>/dev/null; then
    log "Merge completed without conflicts."
else
    warn "Conflicts detected. Auto-resolving with upstream version (patches will re-apply local changes)..."

    # For conflicting files, accept upstream version first
    CONFLICTING_FILES=$(git diff --name-only --diff-filter=U)
    for file in $CONFLICTING_FILES; do
        log "  Accepting upstream: $file"
        git checkout --theirs "$file"
        git add "$file"
    done

    git commit --no-edit
    log "Merge committed with upstream versions for conflicting files."
fi

# 5. Re-apply patches
log "Re-applying local customization patches..."
FAILED_PATCHES=()

for patch in "$PATCH_DIR"/*.patch; do
    [ -f "$patch" ] || continue
    patch_name=$(basename "$patch")

    if git apply --check "$patch" 2>/dev/null; then
        git apply "$patch"
        log "  Applied: $patch_name"
    else
        # Try with 3-way merge
        if git apply --3way "$patch" 2>/dev/null; then
            log "  Applied (3-way): $patch_name"
        else
            warn "  FAILED: $patch_name (needs manual resolution)"
            FAILED_PATCHES+=("$patch_name")
        fi
    fi
done

# 6. Commit patch re-application
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "Re-apply MarkNote customizations after upstream sync"
    log "Customizations committed."
fi

# 7. Summary
echo ""
log "===== Sync Complete ====="
log "Upstream commits merged: $BEHIND"
if [ ${#FAILED_PATCHES[@]} -gt 0 ]; then
    warn "Failed patches (need manual fix):"
    for p in "${FAILED_PATCHES[@]}"; do
        warn "  - $p"
    done
    echo ""
    warn "After fixing, run: scripts/update-patches.sh"
else
    log "All patches applied successfully."
fi
