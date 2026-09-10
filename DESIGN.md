# Design System & UI Blueprint — IT Operations Workspace

This document defines the visual design system, UI components, typography, layout rules, and color palettes for this application. Use this blueprint to maintain aesthetic consistency when modifying or adding components with Claude, Cursor, or VS Code.

---

## 1. Design Philosophy & Core Archetype
- **Archetype**: Professional IT Operations & DevOps Workspace — dense, information-rich, clean, and distraction-free.
- **Visual Tone**: High-contrast, slate-grounded surfaces with semantic priority accents (Rose, Amber, Indigo, Slate) and purposeful borders over heavy drop shadows.
- **Theming**: Comprehensive dual-theme support (Light & Dark mode) powered by Tailwind's `dark:` class prefix toggled on `:root`.

---

## 2. Typography & Fonts
Imported via Google Fonts in `index.html`:
- **UI / Headings / Body (`font-sans`)**: `Plus Jakarta Sans` (`400`, `500`, `600`, `700`, `800`)
- **Code / Ticket IDs / SLAs / Telemetry (`font-mono`)**: `JetBrains Mono` (`400`, `500`, `600`, `700`)

### Typographic Hierarchy
| Level | Font Size & Weight | Tailwind Classes | Example Usage |
| :--- | :--- | :--- | :--- |
| **Page Title** | 20–24px Bold | `text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white` | Main view headers, top bar titles |
| **Section Title** | 16–18px SemiBold | `text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100` | Modal titles, column headers, analytics charts |
| **Card / Task Title** | 14px SemiBold | `text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug` | Kanban ticket titles, runbook titles |
| **Body Text** | 13–14px Regular | `text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed` | Descriptions, logs, changelog, steps |
| **Micro Badges / Meta** | 10–11px Bold | `text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500` | SLA tags, category chips, status pills |
| **Ticket Codes & Numbers** | 11–12px Bold Mono | `font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300` | `INC-1042`, `PR-01`, timestamps |

---

## 3. Color Palette & Semantic Tokens

### Canvas & Surface Tokens
| Surface Role | Light Mode Classes | Dark Mode Classes |
| :--- | :--- | :--- |
| **App Canvas Background** | `bg-slate-100` | `dark:bg-slate-950` |
| **Primary Container / Card** | `bg-white` | `dark:bg-slate-900` |
| **Secondary Well / Sub-panel**| `bg-slate-50` | `dark:bg-slate-800/60` |
| **Hover States** | `hover:bg-slate-100` | `dark:hover:bg-slate-800` |
| **Card & Container Borders** | `border-slate-200` | `dark:border-slate-800` |
| **Subtle Dividers** | `border-slate-100` | `dark:border-slate-800/80` |

### Priority Tokens
- **P1 — Critical / Blocker**:
  - Light: `bg-rose-50 text-rose-700 border-rose-200` (Top accent line: `bg-rose-600`)
  - Dark: `dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900`
- **P2 — High**:
  - Light: `bg-amber-50 text-amber-700 border-amber-200` (Top accent line: `bg-amber-500`)
  - Dark: `dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900`
- **P3 — Medium**:
  - Light: `bg-indigo-50 text-indigo-700 border-indigo-200`
  - Dark: `dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900`
- **P4 — Low / Backlog**:
  - Light: `bg-slate-100 text-slate-700 border-slate-200`
  - Dark: `dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`

### SLA & Health Status
- **Breached**: `bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 font-bold`
- **Warning (< 1h)**: `bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900`
- **Met / Healthy**: `bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900`

### Environment Tags
- **Production (`prod`)**: `bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200`
- **Staging (`stage`)**: `bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200`
- **Disaster Recovery (`dr`)**: `bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200`

---

## 4. Spacing, Borders & Radius Rules

1. **Border Radii Hierarchy**:
   - Modals & Floating Overlays: `rounded-2xl`
   - Content Panels, Kanban Columns, Big Cards: `rounded-xl`
   - Form Inputs, Buttons, Dropdowns: `rounded-lg`
   - Tags, Chips, Micro Badges: `rounded-md` or `rounded`
2. **Padding Math**:
   - Ticket & List Cards: `p-3.5` to `p-4`
   - Main Content Views: `p-4 sm:p-6 lg:p-8`
   - Modals / Slide-outs: `p-6`
   - Buttons: `px-3.5 py-2` (Horizontal padding is ~2x vertical padding)
3. **Card Shadows & Elevation**:
   - Base state: `border border-slate-200 dark:border-slate-800 shadow-xs`
   - Hover state: `hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all`

---

## 5. Reusable Component Patterns

### Primary CTA Button
```tsx
<button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors">
  <Plus className="w-4 h-4" />
  <span>New Ticket</span>
</button>
```

### Secondary / Neutral Button
```tsx
<button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors">
  Cancel
</button>
```

### Danger / Destructive Button
```tsx
<button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors">
  <Trash2 className="w-4 h-4" />
  <span>Delete</span>
</button>
```

### Form Input Field
```tsx
<input 
  type="text"
  className="w-full px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
  placeholder="Enter title..."
/>
```

### Modal Overlay & Container
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
  <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6">
    {/* Modal Header */}
    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Modal Title</h3>
      <button className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
        <X className="w-5 h-5" />
      </button>
    </div>
    {/* Modal Content */}
  </div>
</div>
```

---

## 6. Icons & Animations
- **Icons**: Always imported from `lucide-react`.
  - Chip/Badge icons: `w-3.5 h-3.5`
  - Button/Action icons: `w-4 h-4`
  - View headers/Navigation icons: `w-5 h-5`
- **Animations**: Use `motion` from `motion/react`:
  ```tsx
  import { motion } from 'motion/react';

  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    transition={{ duration: 0.15, ease: 'easeOut' }}
  >
    {/* Animated content */}
  </motion.div>
  ```
