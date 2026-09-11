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
| `11092026ver006` | 2026-09-11 | Move the disposal form Back button to sit beside and left of Export to PDF, with the form title alone on the left of the header row. |
| `11092026ver007` | 2026-09-11 | Fix the black bar over the Section B header row in the disposal PDF. doc.text() sets the non-stroking colour, so every filled rect after the first header cell inherited black and painted over its own label; the fill and text colour are now set per cell before each rect. |
| `11092026ver008` | 2026-09-11 | Disposal PDF layout tidy-up: drop the empty third header box so the address block runs to the right edge, give every section the same vertical gap via a SECTION_GAP constant, and rebuild the signature block as three equal-width columns with the colon at a fixed offset so Requestor/Date and all three columns line up. |
| `11092026ver009` | 2026-09-11 | Centre the company address horizontally and vertically in its header box, and anchor the signature block to the foot of the page so a short form no longer leaves the bottom half of the sheet blank; on a full page the signatures still follow the notes and overflow onto a new page. |
| `11092026ver010` | 2026-09-11 | Widen the Quantity column in the disposal PDF from 10.0mm to 18.1mm so its header label stops being clipped; the extra width is taken proportionally from Disposal Description, Spec/Model and Serial Number, and every header label now measures clear of its column. |
| `11092026ver011` | 2026-09-11 | Section B cells now accept multiple lines. The Description, Spec/Model, Serial Number and Remarks inputs became auto-growing textareas, and the PDF wraps each cell to its column and grows the row to the tallest cell instead of clipping to a single line, so typed newlines such as "os: win 11 / cpu speed: 123" print in full. |
| `11092026ver012` | 2026-09-11 | Drop the second "os: win 11" line from the Spec / Model placeholder, leaving just the single-line example. |
| `11092026ver013` | 2026-09-11 | Add the IT Fixed Asset Allocation Form to the employee portal. Generalised the disposal form into a config-driven AssetFormView and assetFormPdf so both sheets share one layout implementation, then added ALLOCATION_FORM alongside DISPOSAL_FORM with its own title, section headings, Asset Description column and acknowledgement notes. The Create Form picker now offers Allocation, Disposal and the still-pending Request form. |
| `11092026ver014` | 2026-09-11 | Replace the drafted allocation acknowledgement notes with the five official company clauses, reproduced verbatim. The notes block grows from four to five entries (44mm tall with two wrapping) and the signature block still anchors at the page foot. |
| `11092026ver015` | 2026-09-11 | Correct three spellings in the allocation acknowledgement notes: "due the" to "due to the" in note 2, and "failed to observed" to "failed to observe" plus "reffered" to "referred" in note 5. |
| `11092026ver016` | 2026-09-11 | Give the allocation form its own signing roles: Prepared/Installed By, Authorised By and Acknowledged/Accepted By. Signature labels moved into the form config, and the renderer now stacks the label above a full-width signing line when the labels are too long to sit inline, so the allocation lines are 55mm instead of the 11mm an inline layout would have left. The disposal form keeps its inline Requestor/HOD/IT block unchanged. |
| `11092026ver017` | 2026-09-11 | Add Section D, FOR IT DEPARTMENT USE, to the allocation form: an Allocated Unit Returned Acknowledgement with two tick-box options (NOT emboldened in the second), a full-width Remarks rule, and Resources Returned By / Checked By signing lines. Section C signatures now flow naturally instead of anchoring to the page foot whenever a Section D follows, so there is room beneath them. Section D is config-driven and the disposal form does not get it. |
| `11092026ver018` | 2026-09-11 | Make Section D editable and fix its PDF layout. The tick boxes and Remarks are now real inputs on screen (the Completed by IT badge stays), and their values print on the PDF as a drawn tick and text on the remarks rule. Added the missing Date lines under Resources Returned By and Checked By, and spaced the Section D header from the Section C signatures by measuring the block bottom rather than its starting baseline, which widens the gap from 1mm to 10mm. |
