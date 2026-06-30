package dictionary

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

//go:embed data/words_dictionary.json
var dictionaryData embed.FS

// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
	IsValidWord(word string) bool
}

// NopChecker is a DictionaryChecker that accepts every word.
// It is used as the default when no dictionary implementation is configured.
type NopChecker struct{}

func (NopChecker) IsValidWord(_ string) bool { return true }

// FileChecker validates words against a word list loaded into memory.
type FileChecker struct {
	words map[string]struct{}
}

// NewFileChecker loads a JSON dictionary from r.
//
// The expected format is a JSON object whose keys are valid words, such as
// dwyl/english-words' words_dictionary.json.
func NewFileChecker(r io.Reader) (*FileChecker, error) {
	var raw map[string]int
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode dictionary JSON: %w", err)
	}

	words := make(map[string]struct{}, len(raw))
	for word := range raw {
		normalized := normalize(word)
		if normalized == "" {
			continue
		}
		words[normalized] = struct{}{}
	}

	return &FileChecker{words: words}, nil
}

// NewEmbeddedEnglishChecker loads the bundled English dictionary.
func NewEmbeddedEnglishChecker() (*FileChecker, error) {
	data, err := dictionaryData.ReadFile("data/words_dictionary.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded dictionary: %w", err)
	}
	return NewFileChecker(bytes.NewReader(data))
}

func (c *FileChecker) IsValidWord(word string) bool {
	if c == nil {
		return false
	}

	_, ok := c.words[normalize(word)]
	return ok
}

func normalize(word string) string {
	return strings.ToLower(strings.TrimSpace(word))
}

// TODO: PostgresDictionary and APIDictionary implementations
