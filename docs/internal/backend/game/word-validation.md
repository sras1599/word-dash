# Word Validation

Word validation is handled through a pluggable interface so that the backing implementation can be swapped without changing game logic.

```go
// DictionaryChecker validates whether a string is a real word.
type DictionaryChecker interface {
    IsValidWord(word string) bool
}
```

## Planned Implementations

| Implementation       | Description |
|----------------------|-------------|
| `FileDictionary`     | Loads a flat word list (for example `words_alpha.txt`) into memory at startup. O(1) lookup via `map[string]struct{}`. Suitable for local dev and self-hosted deployments. |
| `PostgresDictionary` | Queries the `words` table in PostgreSQL. Useful if the word list needs to be updated dynamically without a redeploy. |
| `APIDictionary`      | Calls an external dictionary API (for example Free Dictionary API). Adds network latency; intended for future use or fallback. |

The active implementation is injected at startup via the config package and passed to the game engine as the `DictionaryChecker` interface.
