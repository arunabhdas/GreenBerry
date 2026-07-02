# GetStarted

⏺ Done — the left panel of greenberrytui is now an arrow-key menu. (The screenshot shows two stacked frames — a capture artifact of the non-TTY render; the bottom one is the steady
  state: the focused "Menu" pane with Test highlighted in green.)

  What changed (greenberrytui/greenberrytui/src/app.tsx)

  - The left "Nav" pane is now a Menu with three options: Test, Connect, Quit.
  - ↑/↓ (or k/j) move the selection, wrapping around; the selected row is highlighted (inverse green bar with a › marker).
  - Enter runs the selected option:
    - Quit → exits the app
    - Test → status: "Self-test passed — all systems nominal."
    - Connect → status: "Connecting to greenberry@localhost…"
  - The Main pane shows the current selection + the last action's status.
  - Existing pane-focus navigation (Tab / ← / →) and q/Esc to quit are preserved; footer hint updated.

  Verified

  - tsc --noEmit → exit 0.
  - Interactive pty test: menu shows all three options, no crash; ↓ ↓ then Enter on Quit exits cleanly (code 0).
  - Visual capture confirms the highlight + "Selected: …" readout.

  Run it

  cd greenberrytui/greenberrytui
  npm start      # ↑/↓ to move, Enter to run, q to quit
  (Use npm start, not npm run dev — the watch mode keeps running after the app quits.)

  This is a stopping point — src/app.tsx has uncommitted changes. Commit it yourself whenever you're ready; I won't.
