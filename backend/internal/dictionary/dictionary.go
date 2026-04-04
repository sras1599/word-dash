package dictionary

// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
	IsValidWord(word string) bool
}

// TODO: FileDictionary, PostgresDictionary, APIDictionary implementations
