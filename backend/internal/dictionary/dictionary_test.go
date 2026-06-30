package dictionary

import (
	"strings"
	"testing"
)

func TestFileCheckerValidatesLoadedWords(t *testing.T) {
	checker, err := NewFileChecker(strings.NewReader(`{"cat":1,"hello":1}`))
	if err != nil {
		t.Fatalf("new file checker: %v", err)
	}

	tests := []struct {
		name string
		word string
		want bool
	}{
		{name: "valid word", word: "cat", want: true},
		{name: "unknown word", word: "zzzzzz", want: false},
		{name: "normalizes case and whitespace", word: "  HELLO  ", want: true},
		{name: "empty input", word: "", want: false},
		{name: "whitespace input", word: "   ", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := checker.IsValidWord(tt.word); got != tt.want {
				t.Fatalf("IsValidWord(%q) = %v, want %v", tt.word, got, tt.want)
			}
		})
	}
}

func TestNewFileCheckerReturnsErrorForMalformedJSON(t *testing.T) {
	if _, err := NewFileChecker(strings.NewReader(`{"cat":`)); err == nil {
		t.Fatal("NewFileChecker returned nil error for malformed JSON")
	}
}
