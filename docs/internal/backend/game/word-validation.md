# Word Validation

Word validation is handled through a pluggable interface so that the backing implementation can be swapped without changing game logic.

```go
// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
    IsValidWord(word string) bool
}
```

## Active Implementation

The backend currently uses `FileChecker`, which loads the embedded English word
list once during server startup and stores normalized words in a
`map[string]struct{}` for O(1) lookup. The bundled source is
`dwyl/english-words` `words_dictionary.json`.

The active checker is injected at startup and passed to the game engine as the
`DictionaryChecker` interface. Clients never validate words locally.

## Planned Implementations

| Implementation       | Description |
|----------------------|-------------|
| `PostgresDictionary` | Queries the `words` table in PostgreSQL. Useful if the word list needs to be updated dynamically without a redeploy. |
| `APIDictionary`      | Calls an external dictionary API (for example Free Dictionary API). Adds network latency; intended for future use or fallback. |
