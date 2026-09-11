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
| `10092026ver002` | 2026-09-10 | Automated version control. A Stop hook now commits, tags and logs each turn that changed files, using .claude/version-bump.sh. |
| `11092026ver000` | 2026-09-11 | Remove SLA entirely from admin and employee sites: dropped slaDeadline/slaHours from the Task and TaggingRule models, deleted calculateSlaStatus, removed countdown badges, the list SLA column, compliance metrics, the rules SLA target, the settings toggle, the portal response-times panel, and SLA from the Gemini triage schema and chat context. |
| `11092026ver001` | 2026-09-11 | Remove the Work Impact & Urgency Level concept from both sites: deleted the three-card selector from the employee portal and the admin ticket modal, dropped urgencyLevel from the Task model, removed the Reported Urgency readout and handleUrgencyChange. Portal submissions now default to P3 for IT triage instead of self-assigning P1/P2/P4. |
