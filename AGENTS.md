# AGENTS.md — Project Rules (all coders must obey)

## Git Write Operations — EXPLICIT PERMISSION REQUIRED

No coder (including this AI assistant) shall commit, amend, push, force-push, or otherwise modify git history in this repository **without explicit, direct permission from the user**.

### What is prohibited without explicit approval:
- `git commit` — any commit, including WIP or "small" fixes
- `git push` — to any remote, any branch
- `git push --force` / `git push --force-with-lease`
- `git amend` / `git commit --amend`
- `git rebase` that rewrites history
- `git reset --hard` that discards committed work
- Any operation that transmits repository objects to a remote

### What is permitted without approval:
- Reading files, running builds, running tests
- Editing files in the working tree (unstaged changes)
- Creating scripts, documentation, or analysis in the working tree
- `git status`, `git diff`, `git log` (read-only inspection)

### Why:
- The user has explicitly had a coder push without permission, causing a blocked 447 MB push attempt and session timeout.
- All fixes in this session are **local and uncommitted** (791 files changed, 114 MB of images).
- Nothing will be pushed until the user explicitly names the remote, branch, and gives permission.

### How to request a push:
The user must state:
1. Which remote (e.g., `origin`, `dhow-coast-travels2`, etc.)
2. Which branch (e.g., `master`, `main`)
3. Explicit words of permission (e.g., "push now", "commit and push")

Until then: **do not commit. Do not push.**
