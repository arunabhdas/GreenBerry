  What was created (in greenberry-csv/csvtui/):
  - main.go — a Go + Bubble Tea program with two modes:
    - csvtui clean <in> <out> strips the raw GoDaddy export from 81 columns down to 13 essentials (Domain Name, TLD, Create/Expiration dates, Auto-renew, Lock, Status, Renewal Price,
  Privacy, Category, Estimated Value, 365-Day Searches, Nameservers), dropping all the registrant/admin/tech/billing PII and empty fields. It also normalizes whitespace and turns Privacy
  - into Off.
    - The default mode is the Lotus 1-2-3-style viewer: a top bar showing the current cell reference (A1: alinapoplianski.ca), a column-letters row, the header row, numbered rows in a
  cyan gutter, a highlighted cell cursor, and a help bar. Numeric columns are right-aligned, and long cells truncate with … (the top bar always shows the full value).
  - main_test.go — tests covering rendering, navigation/clamping, search, currency-aware sorting, and the Privacy normalization. All pass, and go vet is clean.
  - README.md and a .gitignore for the binary.

  Already generated: domainexport_clean.csv (210 rows × 13 columns) sits next to the raw export.

  I caught and fixed one real bug along the way: the descending sort comparator wasn't a valid ordering, and empty Renewal Price cells floated to the top — now non-numeric cells always
  sink to the bottom and CA$ 21.99-style values sort numerically.

  To try it, run this in your own terminal (it's interactive, so I didn't launch it myself):

  cd /Users/coder/repos/offsideai/githubrepos_workspace_active_1/GreenBerry/greenberry-csv
  ./csvtui/csvtui

  Keys: arrows/hjkl to move, PgUp/PgDn, g/G top/bottom, / to search, n for next match, s to sort by the current column (again to reverse), q to quit.
