// csvtui — a Lotus 1-2-3 style terminal viewer for CSV files.
//
// Usage:
//
//	csvtui clean <input.csv> <output.csv>   strip the raw domain export down
//	                                        to the essential columns
//	csvtui [file.csv]                       browse a CSV in a spreadsheet grid
//	                                        (defaults to domainexport_clean.csv)
package main

import (
	"encoding/csv"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const defaultFile = "domainexport_clean.csv"

// Columns kept by `csvtui clean`, in display order. Everything else in the
// raw GoDaddy export (contact PII, WhoIs counters, mostly-empty fields) is
// dropped.
var keepCols = []string{
	"Domain Name",
	"TLD",
	"Create Date",
	"Expiration Date",
	"Auto-renew",
	"Lock",
	"Status",
	"Renewal Price",
	"Privacy",
	"Category",
	"Estimated Value",
	"365-Day Total Searches",
	"Nameservers",
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "clean" {
		if len(os.Args) != 4 {
			fmt.Fprintln(os.Stderr, "usage: csvtui clean <input.csv> <output.csv>")
			os.Exit(2)
		}
		if err := cleanCSV(os.Args[2], os.Args[3]); err != nil {
			fmt.Fprintln(os.Stderr, "csvtui clean:", err)
			os.Exit(1)
		}
		return
	}

	path := defaultFile
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	headers, rows, err := readCSV(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "csvtui:", err)
		os.Exit(1)
	}
	m := newModel(path, headers, rows)
	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Fprintln(os.Stderr, "csvtui:", err)
		os.Exit(1)
	}
}

// ---------------------------------------------------------------- clean mode

func cleanCSV(in, out string) error {
	headers, rows, err := readCSV(in)
	if err != nil {
		return err
	}
	idx := make([]int, 0, len(keepCols))
	names := make([]string, 0, len(keepCols))
	for _, want := range keepCols {
		for i, h := range headers {
			if strings.EqualFold(strings.TrimSpace(h), want) {
				idx = append(idx, i)
				names = append(names, want)
				break
			}
		}
	}
	if len(idx) == 0 {
		return fmt.Errorf("%s: none of the expected columns found", in)
	}

	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	if err := w.Write(names); err != nil {
		return err
	}
	for _, row := range rows {
		rec := make([]string, len(idx))
		for j, i := range idx {
			v := ""
			if i < len(row) {
				v = strings.Join(strings.Fields(row[i]), " ")
			}
			if names[j] == "Privacy" && v == "-" {
				v = "Off"
			}
			rec[j] = v
		}
		if err := w.Write(rec); err != nil {
			return err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return err
	}
	fmt.Printf("wrote %s (%d rows, %d columns)\n", out, len(rows), len(idx))
	return nil
}

func readCSV(path string) ([]string, [][]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	all, err := r.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("%s: %w", path, err)
	}
	if len(all) == 0 {
		return nil, nil, fmt.Errorf("%s: empty file", path)
	}
	return all[0], all[1:], nil
}

// ------------------------------------------------------------------ TUI mode

var (
	styleRef      = lipgloss.NewStyle().Foreground(lipgloss.Color("15")).Background(lipgloss.Color("4")).Bold(true)
	styleLetters  = lipgloss.NewStyle().Foreground(lipgloss.Color("0")).Background(lipgloss.Color("6"))
	styleHeader   = lipgloss.NewStyle().Foreground(lipgloss.Color("15")).Background(lipgloss.Color("4")).Bold(true)
	styleGutter   = lipgloss.NewStyle().Foreground(lipgloss.Color("0")).Background(lipgloss.Color("6"))
	styleCell     = lipgloss.NewStyle()
	styleCursor   = lipgloss.NewStyle().Foreground(lipgloss.Color("0")).Background(lipgloss.Color("14")).Bold(true)
	styleCurRow   = lipgloss.NewStyle().Background(lipgloss.Color("236"))
	styleHelp     = lipgloss.NewStyle().Foreground(lipgloss.Color("0")).Background(lipgloss.Color("7"))
	styleSearchBar = lipgloss.NewStyle().Foreground(lipgloss.Color("15")).Background(lipgloss.Color("3")).Bold(true)
)

const (
	maxColWidth = 28
	gutterWidth = 5
)

type model struct {
	path    string
	headers []string
	rows    [][]string
	widths  []int
	numeric []bool

	curR, curC     int
	rowOff, colOff int
	w, h           int

	searching bool
	query     string
	lastQuery string

	sortCol int
	sortAsc bool
	status  string
}

func newModel(path string, headers []string, rows [][]string) *model {
	m := &model{path: path, headers: headers, rows: rows, sortCol: -1, w: 80, h: 24}
	m.widths = make([]int, len(headers))
	m.numeric = make([]bool, len(headers))
	for c, h := range headers {
		w := len([]rune(h))
		num := len(rows) > 0
		for _, row := range rows {
			v := cellAt(row, c)
			if l := len([]rune(v)); l > w {
				w = l
			}
			if v != "" && !isNumeric(v) {
				num = false
			}
		}
		if w > maxColWidth {
			w = maxColWidth
		}
		if w < 3 {
			w = 3
		}
		m.widths[c] = w
		m.numeric[c] = num
	}
	return m
}

func cellAt(row []string, c int) string {
	if c < len(row) {
		return row[c]
	}
	return ""
}

func isNumeric(s string) bool {
	_, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
	return err == nil
}

// numericKey strips currency prefixes and separators so "CA$ 21.99" sorts as
// a number.
func numericKey(s string) (float64, bool) {
	t := strings.TrimSpace(s)
	if i := strings.IndexAny(t, "0123456789-"); i > 0 {
		t = t[i:]
	}
	t = strings.ReplaceAll(t, ",", "")
	f, err := strconv.ParseFloat(t, 64)
	return f, err == nil
}

func colLetter(i int) string {
	s := ""
	for i >= 0 {
		s = string(rune('A'+i%26)) + s
		i = i/26 - 1
	}
	return s
}

func (m *model) Init() tea.Cmd { return nil }

func (m *model) gridHeight() int {
	h := m.h - 4 // ref line + letters + header + help bar
	if h < 1 {
		h = 1
	}
	return h
}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
	case tea.KeyMsg:
		if m.searching {
			return m.updateSearch(msg)
		}
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		case "up", "k":
			m.curR--
		case "down", "j":
			m.curR++
		case "left", "h":
			m.curC--
		case "right", "l":
			m.curC++
		case "pgup", "ctrl+b":
			m.curR -= m.gridHeight()
		case "pgdown", "ctrl+f", " ":
			m.curR += m.gridHeight()
		case "home":
			m.curC = 0
		case "end":
			m.curC = len(m.headers) - 1
		case "g":
			m.curR = 0
		case "G":
			m.curR = len(m.rows) - 1
		case "/":
			m.searching = true
			m.query = ""
		case "n":
			m.findNext()
		case "s":
			m.sortByColumn()
		}
		m.clamp()
	}
	return m, nil
}

func (m *model) updateSearch(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc", "ctrl+c":
		m.searching = false
	case "enter":
		m.searching = false
		m.lastQuery = m.query
		m.findNext()
	case "backspace":
		if len(m.query) > 0 {
			r := []rune(m.query)
			m.query = string(r[:len(r)-1])
		}
	default:
		if msg.Type == tea.KeyRunes {
			m.query += string(msg.Runes)
		}
	}
	return m, nil
}

func (m *model) findNext() {
	q := strings.ToLower(m.lastQuery)
	if q == "" {
		m.status = "no search query"
		return
	}
	n := len(m.rows)
	for step := 1; step <= n; step++ {
		r := (m.curR + step) % n
		for c := range m.headers {
			if strings.Contains(strings.ToLower(cellAt(m.rows[r], c)), q) {
				m.curR, m.curC = r, c
				m.status = fmt.Sprintf("found %q at %s%d", m.lastQuery, colLetter(c), r+1)
				m.clamp()
				return
			}
		}
	}
	m.status = fmt.Sprintf("%q not found", m.lastQuery)
}

func (m *model) sortByColumn() {
	c := m.curC
	if m.sortCol == c {
		m.sortAsc = !m.sortAsc
	} else {
		m.sortCol, m.sortAsc = c, true
	}
	asc := m.sortAsc
	sort.SliceStable(m.rows, func(i, j int) bool {
		a, b := cellAt(m.rows[i], c), cellAt(m.rows[j], c)
		fa, oka := numericKey(a)
		fb, okb := numericKey(b)
		if oka != okb {
			return oka // numbers before text, in either direction
		}
		if oka {
			if asc {
				return fa < fb
			}
			return fa > fb
		}
		if asc {
			return strings.ToLower(a) < strings.ToLower(b)
		}
		return strings.ToLower(a) > strings.ToLower(b)
	})
	dir := "asc"
	if !asc {
		dir = "desc"
	}
	m.status = fmt.Sprintf("sorted by %s (%s)", m.headers[c], dir)
}

func (m *model) clamp() {
	if m.curR < 0 {
		m.curR = 0
	}
	if m.curR > len(m.rows)-1 {
		m.curR = len(m.rows) - 1
	}
	if m.curC < 0 {
		m.curC = 0
	}
	if m.curC > len(m.headers)-1 {
		m.curC = len(m.headers) - 1
	}
	gh := m.gridHeight()
	if m.curR < m.rowOff {
		m.rowOff = m.curR
	}
	if m.curR >= m.rowOff+gh {
		m.rowOff = m.curR - gh + 1
	}
	if m.curC < m.colOff {
		m.colOff = m.curC
	}
	for !m.colVisible(m.curC) {
		m.colOff++
	}
}

// colVisible reports whether column c fits fully on screen at the current
// horizontal offset.
func (m *model) colVisible(c int) bool {
	avail := m.w - gutterWidth
	for i := m.colOff; i <= c && i < len(m.headers); i++ {
		avail -= m.widths[i] + 1
		if avail < 0 {
			return false
		}
	}
	return c >= m.colOff
}

func (m *model) visibleCols() []int {
	cols := []int{}
	avail := m.w - gutterWidth
	for i := m.colOff; i < len(m.headers); i++ {
		avail -= m.widths[i] + 1
		if avail < 0 {
			break
		}
		cols = append(cols, i)
	}
	if len(cols) == 0 && m.colOff < len(m.headers) {
		cols = append(cols, m.colOff) // always show at least the cursor column
	}
	return cols
}

func fit(s string, w int, right bool) string {
	r := []rune(s)
	if len(r) > w {
		if w <= 1 {
			return string(r[:w])
		}
		return string(r[:w-1]) + "…"
	}
	pad := strings.Repeat(" ", w-len(r))
	if right {
		return pad + s
	}
	return s + pad
}

func (m *model) View() string {
	if m.w == 0 || len(m.rows) == 0 {
		return "empty CSV — press q to quit"
	}
	cols := m.visibleCols()
	var b strings.Builder

	// Reference line, Lotus style: A1: 'value'
	val := cellAt(m.rows[m.curR], m.curC)
	ref := fmt.Sprintf(" %s%d: %s", colLetter(m.curC), m.curR+1, val)
	right := fmt.Sprintf("%s  %d×%d ", m.path, len(m.rows), len(m.headers))
	space := m.w - lipgloss.Width(ref) - lipgloss.Width(right)
	if space < 1 {
		ref = fit(ref, m.w-lipgloss.Width(right)-1, false)
		space = 1
	}
	b.WriteString(styleRef.Render(fit(ref+strings.Repeat(" ", space)+right, m.w, false)))
	b.WriteString("\n")

	// Column letters row.
	line := strings.Repeat(" ", gutterWidth)
	for _, c := range cols {
		letter := colLetter(c)
		if c == m.sortCol {
			if m.sortAsc {
				letter += "▲"
			} else {
				letter += "▼"
			}
		}
		line += " " + fit(letter, m.widths[c], false)
	}
	b.WriteString(styleLetters.Render(fit(line, m.w, false)))
	b.WriteString("\n")

	// Field-name header row.
	line = strings.Repeat(" ", gutterWidth)
	for _, c := range cols {
		line += " " + fit(m.headers[c], m.widths[c], false)
	}
	b.WriteString(styleHeader.Render(fit(line, m.w, false)))
	b.WriteString("\n")

	// Grid.
	gh := m.gridHeight()
	for i := 0; i < gh; i++ {
		r := m.rowOff + i
		if r >= len(m.rows) {
			b.WriteString("\n")
			continue
		}
		b.WriteString(styleGutter.Render(fit(strconv.Itoa(r+1), gutterWidth-1, true) + " "))
		for _, c := range cols {
			cell := fit(cellAt(m.rows[r], c), m.widths[c], m.numeric[c])
			switch {
			case r == m.curR && c == m.curC:
				b.WriteString(styleCursor.Render(" " + cell))
			case r == m.curR:
				b.WriteString(styleCurRow.Render(" " + cell))
			default:
				b.WriteString(styleCell.Render(" " + cell))
			}
		}
		b.WriteString("\n")
	}

	// Bottom bar: search input, status, or help.
	switch {
	case m.searching:
		b.WriteString(styleSearchBar.Render(fit(" /"+m.query+"▌", m.w, false)))
	case m.status != "":
		b.WriteString(styleHelp.Render(fit(" "+m.status+"  ·  press any key", m.w, false)))
		m.status = ""
	default:
		help := " ↑↓←→ move · PgUp/PgDn page · g/G top/bottom · / search · n next · s sort · q quit"
		b.WriteString(styleHelp.Render(fit(help, m.w, false)))
	}
	return b.String()
}
