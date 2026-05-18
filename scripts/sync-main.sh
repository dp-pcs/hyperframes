#!/usr/bin/env bash
#
# Sync caleb with origin/main while preserving local skills/.
#
# - Merges origin/main into the current (caleb) branch.
# - Keeps skills/ exactly as it is on caleb (main's changes to skills/ are dropped).
# - Refreshes skills_pre/ with origin/main's skills/ tree as a side-by-side reference.
# - Never pushes. Run `git push` manually if you want to publish the merge.
#
# Usage:  bash scripts/sync-main.sh
#

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

BRANCH_REQUIRED="caleb"
REMOTE="origin"
REMOTE_BRANCH="main"
SKILLS_DIR="skills"
SNAPSHOT_DIR="skills_pre"

log() { printf '\033[1;36m[sync-main]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[sync-main]\033[0m %s\n' "$*" >&2; }

# 1. Pre-flight checks
current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$BRANCH_REQUIRED" ]; then
  err "Current branch is '$current_branch', expected '$BRANCH_REQUIRED'. Run: git checkout $BRANCH_REQUIRED"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  err "Working tree is not clean. Commit or stash your changes first."
  git status --short
  exit 1
fi

if [ ! -d "$SKILLS_DIR" ]; then
  err "$SKILLS_DIR/ not found at repo root. Aborting."
  exit 1
fi

# 2. Fetch latest origin/main
log "Fetching $REMOTE/$REMOTE_BRANCH..."
git fetch "$REMOTE" "$REMOTE_BRANCH"

# 3. Is there anything new?
incoming="$(git log --oneline "$BRANCH_REQUIRED..$REMOTE/$REMOTE_BRANCH" || true)"
if [ -z "$incoming" ]; then
  log "$REMOTE/$REMOTE_BRANCH has no new commits. Nothing to merge."
  exit 0
fi

incoming_count="$(printf '%s\n' "$incoming" | wc -l | tr -d ' ')"
log "$incoming_count new commit(s) to merge:"
printf '%s\n' "$incoming" | sed 's/^/    /'

# 4. Warn if main touched skills/ since the merge base
skills_diff="$(git diff --name-only "$BRANCH_REQUIRED...$REMOTE/$REMOTE_BRANCH" -- "$SKILLS_DIR" || true)"
if [ -n "$skills_diff" ]; then
  log "Note: $REMOTE/$REMOTE_BRANCH has changes under $SKILLS_DIR/ that will NOT be merged (kept in $SNAPSHOT_DIR/ only):"
  printf '%s\n' "$skills_diff" | sed 's/^/    /'
fi

# 5. Refresh skills_pre/ snapshot
log "Refreshing $SNAPSHOT_DIR/ from $REMOTE/$REMOTE_BRANCH:$SKILLS_DIR/ ..."
rm -rf "$SNAPSHOT_DIR"
mkdir -p "$SNAPSHOT_DIR"
git archive "$REMOTE/$REMOTE_BRANCH" "$SKILLS_DIR" | tar -x -C "$SNAPSHOT_DIR" --strip-components=1

# 6. Merge, preserving skills/
log "Merging $REMOTE/$REMOTE_BRANCH into $BRANCH_REQUIRED (will not commit yet)..."
git merge "$REMOTE/$REMOTE_BRANCH" --no-commit --no-ff

log "Restoring $SKILLS_DIR/ to $BRANCH_REQUIRED's pre-merge state..."
git checkout HEAD -- "$SKILLS_DIR"
git add "$SKILLS_DIR"

# Drop any files main added under skills/ that are now sitting in the worktree
# as untracked (because we just reverted the index but not the worktree adds).
untracked_in_skills="$(git ls-files --others --exclude-standard "$SKILLS_DIR" || true)"
if [ -n "$untracked_in_skills" ]; then
  log "Removing $SKILLS_DIR/ files that came from $REMOTE/$REMOTE_BRANCH but are not in $BRANCH_REQUIRED:"
  printf '%s\n' "$untracked_in_skills" | sed 's/^/    /'
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    rm -f -- "$f"
  done <<< "$untracked_in_skills"
fi

# 7. Finalize merge commit
log "Committing merge..."
git commit --no-edit

# 8. Verify
log "Verifying..."
if [ -n "$(git diff --stat HEAD^1 HEAD -- "$SKILLS_DIR")" ]; then
  err "$SKILLS_DIR/ unexpectedly changed in this merge. Inspect with: git diff HEAD^1 HEAD -- $SKILLS_DIR"
  exit 1
fi

log "Done."
log "  - $BRANCH_REQUIRED now contains $REMOTE/$REMOTE_BRANCH (merge commit: $(git rev-parse --short HEAD))"
log "  - $SKILLS_DIR/ unchanged"
log "  - $SNAPSHOT_DIR/ refreshed with $REMOTE/$REMOTE_BRANCH's $SKILLS_DIR/ tree"
log "  - Nothing pushed to $REMOTE."
