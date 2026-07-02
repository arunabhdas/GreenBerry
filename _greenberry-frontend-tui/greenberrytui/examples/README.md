# Ink layout examples

A gallery of the common terminal-UI layouts, each implemented as a small,
self-contained [Ink](https://github.com/vadimdemedes/ink) component. Use them as
copy-paste starting points while building the GreenBerry TUI.

Built and verified against the version pinned in this repo: **ink 4.4.1**.

## Run them

Every file is standalone-runnable with `tsx` (already a devDependency) — no build
step, picks up edits immediately. Run from the app directory
(`greenberrytui/greenberrytui/`):

```bash
# Interactive index — browse all examples, see the run command for each
npm run examples            # alias for: tsx examples/gallery.tsx

# …or run any single example full-screen
npx tsx examples/01-stack.tsx
npx tsx examples/08-table.tsx
```

> Run them in a **real terminal** to see colors, bold, inverse, borders, etc.
> Piping the output to a file/pager strips the ANSI styling.

## The catalog

Thumbnails link to full-size screenshots in [`../examples-screenshots`](../examples-screenshots).

| #   | File                   | Layout                                                            | Preview                                                                                                              | Key Ink APIs                                                        |
| --- | ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| —   | `gallery.tsx`          | Interactive index (itself a sidebar + master-detail + status bar) | [<img src="../examples-screenshots/gallery.png" width="200">](../examples-screenshots/gallery.png)                   | `useInput`, `useStdout`, `Spacer`                                   |
| 01  | `01-stack.tsx`         | **App shell** — header / body / footer                            | [<img src="../examples-screenshots/01-stack.png" width="200">](../examples-screenshots/01-stack.png)                 | `flexDirection="column"`, `flexGrow`                                |
| 02  | `02-sidebar.tsx`       | **Sidebar + main** — fixed rail + flexible content                | [<img src="../examples-screenshots/02-sidebar.png" width="200">](../examples-screenshots/02-sidebar.png)             | `flexDirection="row"`, fixed `width` vs `flexGrow`, `gap`           |
| 03  | `03-three-pane.tsx`    | **Three-pane** — nav / main / inspector                           | [<img src="../examples-screenshots/03-three-pane.png" width="200">](../examples-screenshots/03-three-pane.png)       | two fixed widths around one `flexGrow`                              |
| 04  | `04-grid.tsx`          | **Uniform grid** — equal N×M cells                                | [<img src="../examples-screenshots/04-grid.png" width="200">](../examples-screenshots/04-grid.png)                   | `flexGrow` + `flexBasis={0}`, nested rows, `gap`                    |
| 05  | `05-centered.tsx`      | **Centered** — splash / empty state                               | [<img src="../examples-screenshots/05-centered.png" width="200">](../examples-screenshots/05-centered.png)           | `justifyContent` + `alignItems` = `center`                          |
| 06  | `06-dashboard.tsx`     | **Dashboard (bento)** — mixed-size widgets                        | [<img src="../examples-screenshots/06-dashboard.png" width="200">](../examples-screenshots/06-dashboard.png)         | asymmetric `flexGrow` weights                                       |
| 07  | `07-master-detail.tsx` | **Master–detail** — list selects, panel shows                     | [<img src="../examples-screenshots/07-master-detail.png" width="200">](../examples-screenshots/07-master-detail.png) | row split, `inverse` selection, label/value rows                    |
| 08  | `08-table.tsx`         | **Data table** — aligned columns                                  | [<img src="../examples-screenshots/08-table.png" width="200">](../examples-screenshots/08-table.png)                 | per-cell `width`, `justifyContent` align, `wrap="truncate"`         |
| 09  | `09-form.tsx`          | **Form** — aligned label/value rows                               | [<img src="../examples-screenshots/09-form.png" width="200">](../examples-screenshots/09-form.png)                   | fixed label `width`, border on focused field, cursor block          |
| 10  | `10-tabs.tsx`          | **Tabs** — tab bar over content                                   | [<img src="../examples-screenshots/10-tabs.png" width="200">](../examples-screenshots/10-tabs.png)                   | row of labels, active highlight                                     |
| 11  | `11-statusbar.tsx`     | **Status bar** — distribute segments                              | [<img src="../examples-screenshots/11-statusbar.png" width="200">](../examples-screenshots/11-statusbar.png)         | `<Spacer>` vs `justifyContent="space-between"`                      |
| 12  | `12-cards.tsx`         | **Card wrap** — responsive reflow                                 | [<img src="../examples-screenshots/12-cards.png" width="200">](../examples-screenshots/12-cards.png)                 | `flexWrap="wrap"`, `gap`                                            |
| 13  | `13-borders.tsx`       | **Borders** — all styles + dividers                               | [<img src="../examples-screenshots/13-borders.png" width="200">](../examples-screenshots/13-borders.png)             | `borderStyle`, `borderColor`, `borderDimColor`, single-side borders |
| 14  | `14-modal.tsx`         | **Modal / dialog** — centered prompt                              | [<img src="../examples-screenshots/14-modal.png" width="200">](../examples-screenshots/14-modal.png)                 | centering box + bordered dialog                                     |
| 15  | `15-scroll-list.tsx`   | **Scrolling list** — windowed viewport _(interactive)_            | [<img src="../examples-screenshots/15-scroll-list.png" width="200">](../examples-screenshots/15-scroll-list.png)     | `useInput`, array slice as viewport                                 |
| 16  | `16-progress.tsx`      | **Meters** — progress bars / gauges                               | [<img src="../examples-screenshots/16-progress.png" width="200">](../examples-screenshots/16-progress.png)           | block chars, aligned label/bar/value                                |

## Ink 4.4.1 layout cheat-sheet

Everything is a flexbox `<Box>` (text must live inside `<Text>`):

- **Direction**: `flexDirection="row" | "column"` (default `row`).
- **Sizing**: `width`/`height` (number of cells or `"50%"`), `minWidth`/`minHeight`.
- **Filling space**: `flexGrow={n}` to absorb slack; `flexBasis={0}` + equal
  `flexGrow` for equal columns/rows.
- **Alignment**: `justifyContent` (main axis) and `alignItems` (cross axis):
  `flex-start | center | flex-end | space-between | space-around | space-evenly`.
- **Spacing**: `gap` / `rowGap` / `columnGap`, plus `padding*` and `margin*`.
- **Wrapping**: `flexWrap="wrap"` for responsive reflow.
- **Borders**: `borderStyle` = `single | double | round | bold | singleDouble |
doubleSingle | classic | arrow`; color with `borderColor`, dim with
  `borderDimColor`, and toggle sides with `borderTop/Bottom/Left/Right={false}`.
- **Text styling**: `color`, `backgroundColor`, `bold`, `italic`, `underline`,
  `strikethrough`, `inverse`, `dimColor`, `wrap="truncate"`.

### Version gotchas baked into these examples

- **No `backgroundColor` on `<Box>`** in 4.4.1 (it's on `<Text>` only). Panels
  get their look from **borders** or from `inverse`/`<Text backgroundColor>`.
- **No `overflow: hidden` clipping.** To "scroll", keep an offset and render only
  the visible slice of the data (see `15-scroll-list.tsx`).
- **No real overlay / z-index.** A modal is rendered _instead of_ the background
  and centered (see `14-modal.tsx`). A true overlay needs `position="absolute"`.
- **Interactive examples guard `useInput`** with
  `{isActive: Boolean(isRawModeSupported)}` — note the `Boolean(...)`: in a
  non-TTY `isRawModeSupported` is `undefined`, and `useInput` only treats a
  strict `false` as inactive, so the coercion is what prevents a
  "Raw mode is not supported" crash when there's no TTY.

## File pattern

Each file exports its component as `default` **and** renders itself only when run
directly, so the gallery (and your own code) can import the component without
triggering a render:

```tsx
export default function Example() {
	/* ... */
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	render(<Example />);
}
```
