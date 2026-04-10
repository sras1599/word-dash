package main

import (
	"context"
	"errors"
	"log"
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
	startupCtx, startupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer startupCancel()

	store, cleanup, err := storage.NewFromConfig(startupCtx, cfg)
	if err != nil {
		log.Fatalf("failed to initialize storage: %v", err)
	}
	defer cleanup()

	restMux := http.NewServeMux()
	apihttp.RegisterRoutes(restMux, store)
	restServer := &http.Server{
		Addr:    cfg.RESTAddr(),
		Handler: apihttp.CORSMiddleware(cfg.CORSOrigin, restMux),
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
		log.Fatalf("server failed: %v", err)
	case sig := <-sigCh:
		log.Printf("received signal %s, shutting down servers", sig.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	shutdownServer("REST", restServer, ctx)
	shutdownServer("WS", wsServer, ctx)
}

func listenAndServe(name string, srv *http.Server, errCh chan<- error) {
	log.Printf("starting %s server on %s", name, srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		errCh <- err
	}
}

func shutdownServer(name string, srv *http.Server, ctx context.Context) {
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("%s server shutdown error: %v", name, err)
		return
	}

	log.Printf("%s server stopped", name)
}
