.PHONY: run build test lint migrate

run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test ./...

lint:
	golangci-lint run

migrate:
	# TODO: apply pending PostgreSQL migrations
