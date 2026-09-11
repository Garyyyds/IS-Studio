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
| `11092026ver002` | 2026-09-11 | Remove the Priority Override control and the priority badge from the admin ticket modal header; the triage row is now a two-column grid of Ticket Status and Assigned IT Technician. Priority is no longer editable from the modal. |
| `11092026ver003` | 2026-09-11 | Remove the priority feature entirely from both sites: deleted the PriorityLevel type, Task.priority/priorityRationale/impactScore/urgencyScore, TaggingRule.targetPriority, Runbook.severityTarget and the showP1Banner/defaultPriority settings. Stripped P1-P4 pills, card accent stripes, the board filter and column P1 counts, the navbar P1 chip, list/history priority columns, filters and sorts, batch priority actions, analytics priority distribution, handbook severity filter, runbook severity selectors, PDF priority blocks, and priority from the Gemini triage schema, prompts and chat context. The rules engine now applies tags and category only. |
| `11092026ver004` | 2026-09-11 | Add a Create Form tab to the employee portal beside Self-Service SOP Guides, with a picker for Request Form (placeholder, not built) and Disposal Form. Built the IT Fixed Asset Disposal Request form: Section A applicant fields prefilled from the signed-in user, a dynamic Section B inventory table, Section C acknowledgement notes, and an Export to PDF that reproduces the company spreadsheet layout including logo, address and Requestor/HOD/IT signature blocks. |
| `11092026ver005` | 2026-09-11 | Disposal form refinements: Employee ID and Reference No now start empty with no placeholder (matching Location, whose placeholder was also removed), the inventory table opens with one row instead of six, and the PDF prints exactly the rows the requester filled in rather than padding to a fixed six. |
