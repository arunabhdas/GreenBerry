# ArcType UI/UX Research

Reference study of the **ArcType** database GUI, to guide the GreenBerry clone:
a macOS/Electron GUI (`greenberry-frontend-macos`) and a terminal-UI version
(`greenberrytui`).

**Source:** screenshots in `spec/screenshot_1.png … screenshot_23.png`.
Screens `screenshot_1–12` were reviewed in full (they cover every top-level view);
`screenshot_13–23` (detail dialogs) could not be loaded in this session due to an
image-count limit — see [Gaps](#12-gaps--to-confirm).

> Context: ArcType was a cross-platform SQL client (Postgres, MySQL, and others),
> acquired by Cockroach Labs and discontinued in 2022. It's a strong archetype
> for a modern, approachable DB GUI — the "TablePlus but friendlier" lane.

---

## 1. Product in one line

A workspace-based SQL client with three modes — **Tables** (browse/edit data via a
spreadsheet grid), **Queries** (SQL editor + history), **Dashboards** (charts built
from queries) — all in a tabbed, dark, macOS-native-feeling shell.

---

## 2. Visual design language

- **Theme:** near-black dark UI in layered grays. Approx palette:
  - base background `#0E0F13`, panels/sidebar `#16171C`, hover `#1E1F25`
  - borders/dividers `#26272E`
  - text primary `#E6E7EA`, secondary/dim `#8A8D96`
- **Accents (two):**
  - **Pink/magenta** `~#EC4899` — brand accent: active-tab underline, selected-cell
    border, primary toggles ("Use monospace font"), the SQL **Run** button, progress bar.
  - **Indigo/blue** `~#5B6CF0` — primary buttons: **Add Filter**, **Save**,
    **Delete Workspace**, **New Query**.
- **Typography:** clean sans for the UI; **optional monospace for data** (a setting,
  on by default). Column headers show the field name + a dim type label under/next to it.
- **Shape/density:** rounded corners on cards, buttons, inputs; compact rows; icon+label
  buttons with a leading glyph; generous but not sparse spacing.
- **Chrome:** standard macOS traffic-light window controls; a Wi‑Fi/connection glyph top-right.

---

## 3. Global layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● ● ●   [workspace ▾]        ⚙  🔍  ‹        [🏠][tab][tab•][+]        ⋯  ↺  │  window + tab bar
├──────┬──────────────────────────┬───────────────────────────────────────────┤
│ ICON │  CONTEXT SIDEBAR         │  MAIN CONTENT (active tab)                 │
│ RAIL │  (varies by mode)        │                                           │
│      │                          │  • Tables → data grid + toolbar           │
│ Tab. │  Tables: sources, schema,│  • Queries → SQL editor                   │
│ Que. │   search, table tree,    │  • Dashboards → widget canvas             │
│ Dash │   functions              │                                           │
│      │                          │                                           │
│  ⚙   │                          │                                           │
├──────┴──────────────────────────┴───────────────────────────────────────────┤
│  status / row count / pagination                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

Three nested levels of navigation:

1. **Icon rail (far left):** workspace switcher (`appliaison ▾`) at top; then the three
   modes **Tables / Queries / Dashboards** (icon + label, selected item has a filled
   dark chip); a **⚙ settings** entry; global **🔍 search**; a **‹ collapse** chevron.
2. **Context sidebar:** contents depend on the active mode (details below). Collapsible.
3. **Tab bar (top of main):** a home tab, then one tab per open table/query/dashboard.
   Active tab has a **pink underline**; **unsaved** tabs show a **pink dot**; `+` opens a new tab.

---

## 4. The three modes

### Tables (schema browser + data grid)
Sidebar:
- **Data-source dropdown** (`unicorn_test ▾`) — switches connection; its menu includes
  **"Add new data source / Create a new connection"** plus the saved-connection list.
- **Schema dropdown** (`public ▾`).
- **Search tables** input.
- **Tables (N)** — collapsible list; each table expands to its **columns with types**
  (`id serial`, `username character varying`, `active boolean`, …).
- **Functions (N)** section at the bottom.

Main = the **data grid** (see §6).

### Queries
Sidebar has **Queries | History** tabs:
- **Queries:** new-query / new-folder icons, **Search queries**, saved-query list (empty
  state: "No queries.").
- **History:** searchable, reverse-chronological list of executed statements, each with a
  **timestamp** (e.g. `SELECT * FROM posts;` · `Mar 29, 2023 – 5:02am`). Click to reload.

Main = the **SQL editor** (see §7).

### Dashboards
Sidebar: new-dashboard / new-folder icons, **Search dashboards**, dashboard list (with
folders, e.g. `JNSQ - Heroku PROD`; items have an `×` to remove).
Main = a **widget canvas** with **`+ Add`** (add a chart/widget), undo/redo, refresh.
Charts are built from queries.

---

## 5. Connection management (`Connect to PostgreSQL` modal)

- **Left:** "Manage connections" — **`+ Add Connection`** and the saved-connection list.
  `+ Add Connection` shows an **engine picker**: PostgreSQL, MySQL, PlanetScale,
  YugabyteDB, SQLite, ClickHouse. (Multi-engine from the start.)
- **Right:** **Credentials / Permissions** tabs. Fields: **Name, Host, Port, User,
  Password** (reveal eye), **Database, SSL Mode** (dropdown, default `preferred`),
  **Key… / Cert… / CA Cert…** buttons, and two toggles: **Connect to all databases on
  the server**, **Connect with SSH**.
- **Footer:** "Need help connecting? Chat with support / Email us"; a **Connection URL**
  field (`postgres://user:****@host…`) with **Show / copy**; **Test Connection** and
  **Save** buttons.
- On success → toast: **"Connection Successful — Successfully connected to PostgreSQL."**

---

## 6. Data grid (the core of "table browsing")

Toolbar (left→right): **table name** · **Insert Row** · **Add Filter** (indigo) ·
**Add Sort** · **Create query** · **Export** · **↺ refresh** · **⋯ more**.

Grid:
- Column headers show **name + dim type** (`id serial`, `email varchar`, `active bool`).
- A leading **`#` row-number** column.
- **Selected cell** has a **pink border** (single-cell selection; spreadsheet feel).
- Horizontal scroll for wide tables.

Footer: **row count** (`1 rows`), **pagination** (`← 1 of 1 →`).

Implied editing model (from "Insert Row" + spreadsheet grid + the "staged edits" language
in the plan): edit cells inline, stage changes, then commit — matching TablePlus/ArcType's
"edit then apply" pattern.

---

## 7. SQL editor (Queries)

- Tabbed (`Untitled Query`, unsaved = pink dot).
- **Line numbers**, **syntax highlighting** (keywords like `DROP TABLE`, `SELECT` colored;
  identifiers `"public"."user"` distinct).
- Top-right: **connection selector** (which DB to run against), **▶ Run ▾** (pink; dropdown
  for run options e.g. run-selection), **Save**.
- **History** tab (shared with Queries sidebar) records every executed statement w/ timestamp.
- Settings → **Editor → Tab Width** (default 4).

---

## 8. Home / onboarding

A **Home** tab with quick actions (**New Query**, **New Dashboard**, **+ Add Connection**),
plus an **onboarding checklist** with a progress bar:
1. Create or join a workspace ✓  2. Connect to a database ✓  3. Filter a table for data
4. Run a query  5. Add a chart to a dashboard — each with **"View tutorial."**
Below: **"Click on a table to explore it"** with source/schema dropdowns and the table list.

---

## 9. Settings

Left nav under **App**: **General, Appearance, Editor, Members**.
- **General:** Workspace name + Update; **Delete Workspace** (indigo).
- **Appearance:** **Zoom Level** (default/large/larger, `Aa` previews), **Enable light mode**
  (beta toggle), **Use monospace font for data** (toggle, on).
- **Editor:** **Tab Width**.
- **Members:** workspace collaborators (multiplayer/shared workspaces).

---

## 10. Interaction patterns to carry over

- **Everything is a tab** (tables, queries, dashboards, home) with an unsaved dot.
- **Workspaces** own connections, queries, dashboards, and members (collaborative).
- **Toasts** for async results (connection success, etc.).
- **Two-accent** system: indigo = primary action, pink = "live/active/brand."
- **Progressive disclosure:** onboarding checklist, contextual empty states ("No queries.").

---

## 11. Feature inventory

| Area | Feature | MVP? (per plan) |
|---|---|---|
| Connections | Multi-engine, SSL modes, SSH tunnel, test, connection URL, "all DBs" | ✅ core (PG first) |
| Schema | Source/schema switch, table tree w/ column types, functions, search | ✅ core |
| Data grid | Browse, paginate, row count, wide-scroll, cell select | ✅ MVP (browsing) |
| Data grid | Insert Row, inline edit, staged commit | ✅ MVP (editing) |
| Data grid | Add Filter, Add Sort, Export, "Create query" from table | ✅ MVP |
| SQL | Editor (highlight, line numbers), Run, Run-selection, Save | ✅ MVP |
| SQL | History (timestamped), saved queries + folders | ✅ core |
| Dashboards | Chart widgets from queries, canvas | later epic |
| Workspace | Members/collab, workspace settings | later epic |
| DBA | roles, indexes, backup/restore, monitoring, extensions | later epics |

---

## 12. Mapping to GreenBerry

### GUI — `greenberry-frontend-macos` (Electron + React)
Near 1:1 with ArcType. Reuse the exact structure: icon rail → context sidebar → tabbed main;
two-accent dark theme; connection modal; data grid; CodeMirror/Monaco SQL editor;
dashboards later. This is the "clone."

### TUI — `greenberrytui` (Ink)
The hard/novel translation. Proposed mapping:

```
┌ greenberry ▸ unicorn_test/public ───────────────── ⌘K palette · ? help ─┐  header
├──────────────┬──────────────────────────────────────────────────────────┤
│ TABLES  (3)  │  [ piccolo_user ]  [ Untitled Query ]              tabs   │
│  ▸ migration │ ──────────────────────────────────────────────────────── │
│  ▸ piccolo_… │  #  id   username   email            active  admin        │
│  ▸ sessions  │  1  1    admin      arunabh@…         true    true         │  data grid
│ FUNCTIONS(10)│  …                                                        │
│              │                                                           │
│ [/] filter   │  1 rows · page 1/1                                        │  status
├──────────────┴──────────────────────────────────────────────────────────┤
│ NORMAL · f filter · s sort · e edit · : SQL · x export · q quit          │  keybar
└──────────────────────────────────────────────────────────────────────────┘
```

Concept translation:
- **Icon rail (modes)** → a top mode indicator + number keys / a command palette
  (`1` Tables, `2` Queries, `3` Dashboards), since a TUI has less room for a permanent rail.
- **Context sidebar** → left pane: a focusable **schema tree** (tables → columns/types,
  functions), with `/` to filter — like the existing focus panes in `greenberrytui`.
- **Tab bar** → a one-line tab strip; `Tab`/`Shift+Tab` or `[`/`]` to switch; unsaved `•`.
- **Data grid** → a scrollable, windowed grid (k9s-style): arrow/`hjkl` to move the cell
  cursor, `PgUp/PgDn` paginate, header row pinned, selected cell inverse/pink.
- **Add Filter / Add Sort** → modal forms (column ▸ operator ▸ value) — reuse the menu/list
  patterns already built in `examples/`.
- **Insert Row / edit** → inline cell editor (a `LineEditor`), staged edits shown as a diff
  bar, `Ctrl+S` to commit.
- **SQL editor** → a multiline input pane with `Ctrl+Enter` to run against the current
  connection; results render in the grid; **History** as a selectable list.
- **Connection manager** → a full-screen form (the fields from §5) + a saved-connection list.
- **Export** → write CSV/JSON to a path (ties into the existing `greenberry-csv` work).
- **Command palette (`⌘K`/`:`)** → the TUI's answer to ArcType's scattered toolbars.

Proposed TUI keymap (first pass): `hjkl`/arrows move · `Tab` panes · `[ ]` tabs ·
`/` filter · `s` sort · `e` edit cell · `i` insert row · `:` SQL mode · `x` export ·
`r` refresh · `g/G` top/bottom · `?` help · `q` quit.

### Repo shape (per interview)
Independent apps (no shared-core package), **two roadmaps**: `ROADMAP-GUI.md` and
`ROADMAP-TUI.md`. Multi-DB architected from day one (PG first). MVP = **both** table
browsing **and** SQL editor / grid editing.

---

## 13. Gaps / to confirm

Screens **`screenshot_13–23`** weren't viewable this session (image-count limit). Based on the
toolbar/settings entries already seen, they most likely show: the **Add Filter** panel,
**Add Sort** panel, **Insert Row** / cell-edit UI, the **Export** dialog (formats), the
connection **Permissions** tab, and **Members** management. Worth confirming before finalizing:
- Exact **filter operators** and multi-condition (AND/OR) UI.
- **Edit/commit** flow (per-cell vs staged batch; how deletes work).
- **Export** formats/options (CSV/JSON/SQL; whole table vs filtered/selection).
- Keyboard shortcuts ArcType exposes.

I can fold those in — either in a fresh session where the images load, or if you paste the
specific ones you care about.
