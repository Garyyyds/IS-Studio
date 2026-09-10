# IS Studio — IT Operations Workspace

## Design system: non-negotiable

**Read [`DESIGN.md`](./DESIGN.md) before writing or modifying ANY UI code.**

The visual design came from a Google AI Studio prototype and is exactly what the
owner wants. It is settled. Every change must use the tokens, typography scale,
spacing, radii and component patterns defined there.

Specifically:

- **Never** invent a colour. Use the documented semantic tokens (priority, SLA,
  environment, surface). If a needed token is missing, ask rather than improvise.
- **Never** substitute a different icon library or animation library.
  `lucide-react` for icons, `motion/react` for animation.
- **Always** provide both light and dark variants. Every surface, border and text
  colour needs its `dark:` counterpart.
- **Match the radius hierarchy**: `rounded-2xl` modals, `rounded-xl` panels,
  `rounded-lg` inputs/buttons, `rounded-md`/`rounded` chips.
- Prefer **borders over heavy shadows**. `shadow-xs` base, `shadow-md` on hover.

When adding a component, copy the closest existing pattern from `DESIGN.md`
section 5 rather than writing fresh markup.

## Stack

- React 19 + Vite 6 + Tailwind 4, TypeScript
- Express backend in `server.ts` (single file), bundled by esbuild
- Supabase for persistence; local `data/server-storage.json` is a fallback cache
- Gemini for AI triage and runbook generation

## Deployment

Live at https://is-studio.onrender.com — Render redeploys on every push to
`main`. See [`DEPLOY.md`](./DEPLOY.md) for the full operational detail,
including the RLS warning that applies before creating any publishable key.

## Local development

```bash
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm run build   # vite build + esbuild server bundle
```

**Local and production share the same Supabase database.** Changing code is
safe; deleting records while testing deletes them for real.

## Notes

- `motion` is a dependency but is not yet used anywhere in `src/`. The first
  animation added should follow the `motion/react` pattern in `DESIGN.md`.
- `server.ts` imports `vite` at the top level, so `vite` must stay in
  `dependencies` (not just `devDependencies`) or production startup breaks.
- `GEMINI_MODEL` accepts a comma-separated fallback chain; a model out of daily
  quota hands off to the next automatically.

## Versioning: automatic

Every turn that changes files is committed and tagged automatically by a `Stop`
hook (`.claude/settings.json` -> `.claude/version-bump.sh`). Versions are named
`DDMMYYYYverNNN` — the date, then a counter that restarts at `000` each day.
A turn that changes nothing produces no version.

`VERSIONS.md` holds the log. To describe a version in your own words rather than
a file list, write one line to `.claude/.version-note` before the turn ends; the
hook uses it for the commit message and the log row, then deletes it.

```bash
git tag -n99                      # every version with its note
git diff 10092026ver000 HEAD      # what changed since a version
git checkout <version>            # inspect a version (safe)
git reset --hard <version>        # discard everything after it
```

Tags and commits stay local. Pushing to `main` deploys to Render, so it is never
automatic — ask before pushing.
