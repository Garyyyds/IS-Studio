# Version log

Every coding update gets a version the owner assigns, in the form
`DDMMYYYYverNNN` — the date the work was done, then a three-digit counter that
restarts at `000` each day. Each version is an annotated git tag pointing at the
commit that contains exactly that state.

## How to use it

```bash
git tag -n99                      # list every version with its notes
git show 10092026ver000           # see what a version contains
git diff 10092026ver000 HEAD      # what changed since a version
git checkout 10092026ver000       # inspect a version (detached HEAD; safe)
git revert <commit>               # undo a version, keeping history
git reset --hard 10092026ver000   # discard everything after a version
```

`git checkout` is the safe one for a look around — `git reset --hard` throws
away later work permanently.

## Versions

| Version | Date | Summary |
| --- | --- | --- |
| `10092026ver000` | 2026-09-10 | Baseline. Deployed IS Studio on Render with Supabase and Gemini, hashed passwords, Gemini model fallback chain, `DESIGN.md` blueprint. Fixed the dev-server reload loop by scoping Vite's watcher away from `data/`. |
| `10092026ver001` | 2026-09-10 | Employee support chatbot. Floating assistant in the bottom-right of the employee portal, answered by Gemini via `POST /api/ai/chat`. Employee accounts only; scoped to the requester's own tickets. |
