# REST API

All request and response bodies are JSON. No authentication headers are required. Identity is established by the `playerId` returned on room create or join and passed as a WebSocket URL parameter.

## POST /rooms

Create a new game room. The requesting player becomes the host.

### Request body

```json
{
  "name": "Alice",
  "variation": {
    "wordLengths": [3, 4, 5]
  }
}
```

### Response 200 OK

```json
{
  "roomCode": "XK39PQ",
  "playerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Error responses

| Status | Condition                 |
|--------|---------------------------|
| `400`  | Missing or invalid fields |

## POST /rooms/:roomCode/join

Join an existing room.

### Request body

```json
{
  "name": "Bob"
}
```

### Response 200 OK

```json
{
  "roomCode": "XK39PQ",
  "playerId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

### Error responses

| Status | Condition                              |
|--------|----------------------------------------|
| `400`  | Missing or invalid fields              |
| `404`  | Room not found                         |
| `409`  | Room is full or game already in progress |
