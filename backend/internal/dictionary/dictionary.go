package dictionary

// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
	IsValidWord(word string) bool
}

// NopChecker is a DictionaryChecker that accepts every word.
// It is used as the default when no dictionary implementation is configured.
type NopChecker struct{}

func (NopChecker) IsValidWord(_ string) bool { return true }

// TODO: FileDictionary, PostgresDictionary, APIDictionary implementations
