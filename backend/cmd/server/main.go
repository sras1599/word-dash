package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	apihttp "github.com/sras1599/wordit/backend/api/http"
	apiws "github.com/sras1599/wordit/backend/api/ws"
	"github.com/sras1599/wordit/backend/config"
	"github.com/sras1599/wordit/backend/internal/storage"
	internalws "github.com/sras1599/wordit/backend/internal/ws"
)

func main() {
	cfg := config.Load()
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})))
	startupCtx, startupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer startupCancel()

	store, cleanup, err := storage.NewFromConfig(startupCtx, cfg)
	if err != nil {
		slog.Error("failed to initialize storage", "error", err)
		os.Exit(1)
	}
	defer cleanup()

	restMux := http.NewServeMux()
	apihttp.RegisterRoutes(restMux, store)
	restServer := &http.Server{
		Addr:    cfg.RESTAddr(),
		Handler: apihttp.LoggingMiddleware(apihttp.CORSMiddleware(cfg.CORSOrigin, restMux)),
	}

	wsMux := http.NewServeMux()
	hub := internalws.NewHub(store)
	apiws.RegisterRoutes(wsMux, hub)
	wsServer := &http.Server{
		Addr:    cfg.WSAddr(),
		Handler: wsMux,
	}

	errCh := make(chan error, 2)
	go listenAndServe("REST", restServer, errCh)
	go listenAndServe("WS", wsServer, errCh)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		slog.Error("server failed", "error", err)
		os.Exit(1)
	case sig := <-sigCh:
		slog.Info("received signal, shutting down", "signal", sig.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	shutdownServer("REST", restServer, ctx)
	shutdownServer("WS", wsServer, ctx)
}

func listenAndServe(name string, srv *http.Server, errCh chan<- error) {
	slog.Info("starting server", "name", name, "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		errCh <- err
	}
}

func shutdownServer(name string, srv *http.Server, ctx context.Context) {
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "name", name, "error", err)
		return
	}

	slog.Info("server stopped", "name", name)
}
