package config

import (
	"os"
	"strconv"
	"time"
)

const (
	defaultPort           = "8080"
	defaultWSPort         = "8081"
	defaultTurnDurationMS = 60000
)

type Config struct {
	Port           string
	WSPort         string
	DBURL          string
	RedisURL       string
	TurnDurationMS int
}

func (c Config) RESTAddr() string {
	return ":" + c.Port
}

func (c Config) WSAddr() string {
	return ":" + c.WSPort
}

func (c Config) TurnDuration() time.Duration {
	return time.Duration(c.TurnDurationMS) * time.Millisecond
}

func Load() Config {
	turnDurationMS := defaultTurnDurationMS
	if raw := os.Getenv("TURN_DURATION_MS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			turnDurationMS = parsed
		}
	}

	return Config{
		Port:           getEnvOrDefault("PORT", defaultPort),
		WSPort:         getEnvOrDefault("WS_PORT", defaultWSPort),
		DBURL:          os.Getenv("DB_URL"),
		RedisURL:       os.Getenv("REDIS_URL"),
		TurnDurationMS: turnDurationMS,
	}
}

func getEnvOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
