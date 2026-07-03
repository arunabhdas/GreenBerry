package main

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func testModel(t *testing.T) *model {
	t.Helper()
	headers, rows, err := readCSV("../domainexport_clean.csv")
	if err != nil {
		t.Fatal(err)
	}
	m := newModel("test.csv", headers, rows)
	m.Update(tea.WindowSizeMsg{Width: 120, Height: 30})
	return m
}

func key(s string) tea.KeyMsg {
	if len(s) == 1 {
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
	}
	switch s {
	case "down":
		return tea.KeyMsg{Type: tea.KeyDown}
	case "right":
		return tea.KeyMsg{Type: tea.KeyRight}
	case "end":
		return tea.KeyMsg{Type: tea.KeyEnd}
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	}
	panic("unknown key " + s)
}

func TestViewRendersGrid(t *testing.T) {
	m := testModel(t)
	v := m.View()
	if !strings.Contains(v, "Domain Name") {
		t.Error("header row missing")
	}
	if !strings.Contains(v, "alinapoplianski.ca") {
		t.Error("first data row missing")
	}
	if !strings.Contains(v, "A1:") {
		t.Error("Lotus-style cell reference missing")
	}
	if n := len(strings.Split(v, "\n")); n != 30 {
		t.Errorf("expected 30 lines for height 30, got %d", n)
	}
}

func TestNavigationAndClamp(t *testing.T) {
	m := testModel(t)
	m.Update(key("G"))
	if m.curR != len(m.rows)-1 {
		t.Errorf("G should jump to last row, got %d", m.curR)
	}
	m.Update(key("end"))
	if m.curC != len(m.headers)-1 {
		t.Errorf("end should jump to last column, got %d", m.curC)
	}
	if !m.colVisible(m.curC) {
		t.Error("cursor column should be visible after horizontal scroll")
	}
	v := m.View()
	if !strings.Contains(v, "domaincontrol") {
		t.Error("nameserver column content should be visible at right edge")
	}
	m.Update(key("g"))
	for i := 0; i < 500; i++ {
		m.Update(key("h"))
	}
	if m.curC != 0 || m.curR != 0 {
		t.Errorf("clamp failed: cursor at %d,%d", m.curR, m.curC)
	}
}

func TestSearch(t *testing.T) {
	m := testModel(t)
	m.Update(key("/"))
	for _, r := range "amazingindia" {
		m.Update(key(string(r)))
	}
	m.Update(key("enter"))
	if got := cellAt(m.rows[m.curR], 0); got != "amazingindia.app" {
		t.Errorf("search landed on %q", got)
	}
}

func TestSortNumericCurrency(t *testing.T) {
	m := testModel(t)
	// Move to Renewal Price column (index 7) and sort descending.
	for i := 0; i < 7; i++ {
		m.Update(key("right"))
	}
	m.Update(key("s"))
	m.Update(key("s"))
	prev, ok := numericKey(cellAt(m.rows[0], 7))
	if !ok {
		t.Fatalf("first row should be numeric after desc sort, got %q", cellAt(m.rows[0], 7))
	}
	seenText := false
	for i, row := range m.rows {
		v, ok := numericKey(cellAt(row, 7))
		if !ok {
			seenText = true
			continue
		}
		if seenText {
			t.Fatalf("row %d: numeric value %v after non-numeric rows", i, v)
		}
		if v > prev {
			t.Fatalf("row %d: %v > previous %v, not descending", i, v, prev)
		}
		prev = v
	}
}

func TestCleanNormalizesPrivacy(t *testing.T) {
	_, rows, err := readCSV("../domainexport_clean.csv")
	if err != nil {
		t.Fatal(err)
	}
	for i, row := range rows {
		if cellAt(row, 8) == "-" {
			t.Errorf("row %d: Privacy still '-'", i+1)
		}
	}
}
