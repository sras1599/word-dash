package config

import (
	"os"
	"strconv"
	"strings"
)

const (
	defaultPort           = "8080"
	defaultWSPort         = "8081"
	defaultTurnDurationMS = 60_000
	defaultCORSOrigin     = "http://localhost:5173"
)

var defaultWordLengths = []int{5}

// Cfg is the package-level config, loaded once at startup from environment
// variables. Any package that imports config can reference Cfg directly.
var Cfg = Load()

type Config struct {
	Port               string
	WSPort             string
	DBURL              string
	RedisURL           string
	TurnDurationMS     int
	DefaultWordLengths []int
	CORSOrigin         string
}

func (c Config) RESTAddr() string {
	return ":" + c.Port
}

func (c Config) WSAddr() string {
	return ":" + c.WSPort
}

func Load() Config {
	turnDurationMS := defaultTurnDurationMS
	if raw := os.Getenv("TURN_DURATION_MS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			turnDurationMS = parsed
		}
	}

	wordLengths := defaultWordLengths
	if raw := os.Getenv("DEFAULT_WORD_LENGTHS"); raw != "" {
		if parsed := parseIntList(raw); len(parsed) > 0 {
			wordLengths = parsed
		}
	}

	return Config{
		Port:               getEnvOrDefault("PORT", defaultPort),
		WSPort:             getEnvOrDefault("WS_PORT", defaultWSPort),
		DBURL:              os.Getenv("DB_URL"),
		RedisURL:           os.Getenv("REDIS_URL"),
		TurnDurationMS:     turnDurationMS,
		DefaultWordLengths: wordLengths,
		CORSOrigin:         getEnvOrDefault("CORS_ORIGIN", defaultCORSOrigin),
	}
}

func getEnvOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseIntList(s string) []int {
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			result = append(result, n)
		}
	}
	return result
}
