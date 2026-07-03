FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.23

RUN addgroup -S worddash && adduser -S -G worddash worddash

WORKDIR /app
COPY --from=build /out/server /app/server

USER worddash

EXPOSE 8080 8081

ENTRYPOINT ["/app/server"]
