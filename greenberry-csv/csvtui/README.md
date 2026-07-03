# csvtui

A Lotus 1-2-3 style terminal viewer for CSV files, built with Go and Bubble Tea.

## Build

```sh
cd csvtui
go build -o csvtui .
```

## Usage

```sh
# 1. Produce the cleaned CSV from the raw GoDaddy export
#    (keeps 13 essential columns, drops empty/PII contact fields)
./csvtui clean ../domainexport_20260629_430pm.csv ../domainexport_clean.csv

# 2. Browse it
cd ..
./csvtui/csvtui domainexport_clean.csv

# With no argument it looks for domainexport_clean.csv in the current directory
./csvtui/csvtui
```

## Keys

| Key | Action |
| --- | --- |
| `↑ ↓ ← →` / `h j k l` | Move the cell cursor |
| `PgUp` / `PgDn` / `Space` | Page up / down |
| `g` / `G` | Jump to first / last row |
| `Home` / `End` | Jump to first / last column |
| `/` then text, `Enter` | Search all cells (case-insensitive) |
| `n` | Next search match |
| `s` | Sort by current column (press again to reverse; currency-aware) |
| `q` / `Esc` | Quit |

The top bar shows the current cell in Lotus style (`A1: value`) along with the
file name and grid dimensions. Sorted columns are marked ▲/▼ in the column
letter row. Numeric columns are right-aligned.
