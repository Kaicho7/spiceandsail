# Owner Actions Required for Spice & Sail Concierge

1. **Rotate BUILD_TOKEN, then purge it from git history**:
   - The repository previously had `BUILD_TOKEN` committed at the root. It has now been untracked (`git rm --cached`) and ignored.
   - The token should be rotated immediately on whatever service it authenticates.
   - Once rotated and approved by the repository owner, a history purge (e.g. `git-filter-repo` or BFG) should be performed to permanently excise the historical commits containing the token string.
