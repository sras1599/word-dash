package storage

import (
	"context"
	"fmt"

	goredis "github.com/redis/go-redis/v9"
	"github.com/sras1599/wordit/backend/config"
	"github.com/sras1599/wordit/backend/internal/room"
	"github.com/sras1599/wordit/backend/internal/storage/memory"
	redisstore "github.com/sras1599/wordit/backend/internal/storage/redis"
)

// NewFromConfig returns the configured room store and a cleanup function for
// any external resources it owns.
func NewFromConfig(ctx context.Context, cfg config.Config) (room.Store, func(), error) {
	if cfg.RedisURL == "" {
		return memory.NewStore(), func() {}, nil
	}

	opts, err := goredis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}

	client := goredis.NewClient(opts)
	cleanup := func() {
		_ = client.Close()
	}

	if err := client.Ping(ctx).Err(); err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("connect to redis: %w", err)
	}

	store := redisstore.NewStore(client)
	if err := store.ResetConnections(ctx); err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("normalize redis room connections: %w", err)
	}

	return store, cleanup, nil
}
