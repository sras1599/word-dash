# Word Dash Backend Deployment Guide

This guide walks through setting up an Arch Linux PC as a backend host for Word Dash. The backend runs as a Go binary managed by `systemd`. The frontend is a static Vite app that can be built and hosted separately on GitHub Pages.

The examples use these placeholder values:

- Linux user: `deploy`
- App directory: `/opt/word-dash`
- Backend domain: `api.example.com`
- Frontend origin: `https://<github-user>.github.io`

Replace those values with your real username, paths, and domains.

## 1. What You Are Deploying

The backend is one Go program that starts two HTTP servers:

- REST API server: `PORT`, default `8080`
- WebSocket server: `WS_PORT`, default `8081`

Important backend paths:

- REST health check: `GET /healthz` on the REST server
- WebSocket health check: `GET /healthz` on the WebSocket server
- Create room: `POST /rooms` on the REST server
- Join room: `POST /rooms/{roomCode}/join` on the REST server
- WebSocket connection: `/ws?roomCode=...&playerId=...` on the WebSocket server

The frontend reads these build-time variables:

- `VITE_API_URL`: REST base URL before endpoint paths are appended
- `VITE_WS_URL`: WebSocket base URL before `/ws` is appended

For a direct domain deployment:

```text
REST API:  https://api.example.com/rooms
WebSocket: wss://api.example.com/ws
```

Use these frontend values:

```env
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

For a sub-path deployment behind a load balancer:

```text
REST API:  https://example.com/word-dash/api/rooms
WebSocket: wss://example.com/word-dash/realtime/ws
```

Use these frontend values:

```env
VITE_API_URL=https://example.com/word-dash/api
VITE_WS_URL=wss://example.com/word-dash/realtime
```

In both cases, do not include `/rooms` in `VITE_API_URL` and do not include `/ws` in `VITE_WS_URL`. The frontend adds those paths itself.

## 2. Costs

This setup can be cheap, but it is not automatically free.

Likely costs:

- Electricity and wear from running your PC all the time.
- Internet bandwidth from players connecting to your home network.
- A static public IP, if your ISP charges for one.
- A domain name, if you want a friendly hostname.
- Managed DNS, if your domain provider does not include it.
- Optional paid tunnel services, cloud load balancers, hosted Redis, or monitoring tools.

Usually free:

- GitHub Pages for a public repository.
- TLS certificates from Let's Encrypt.
- Local Redis running on the same machine.
- Running the Go backend binary on your own PC.

If you host from home, remember that your ISP may block inbound ports, rotate your public IP, or disallow servers on residential plans.

## 3. Prepare Arch Linux

Log in to the server locally or through an existing administrator account.

Update the system:

```bash
sudo pacman -Syu
```

Install required packages:

```bash
sudo pacman -S --needed git base-devel go redis ufw openssh curl
```

Check the Go version required by the project:

```bash
grep '^go ' /opt/word-dash/backend/go.mod
```

If you have not cloned the repository yet, check after cloning in the next section. The current project declares its Go version in `backend/go.mod`; use `go version` to verify your installed Go is new enough:

```bash
go version
```

Enable SSH so you can connect remotely:

```bash
sudo systemctl enable --now sshd
sudo systemctl status sshd
```

Create a non-root deployment user:

```bash
sudo useradd -m -s /bin/bash deploy
sudo passwd deploy
```

Allow the deploy user to use `sudo` when needed:

```bash
sudo usermod -aG wheel deploy
sudo EDITOR=nano visudo
```

In `visudo`, make sure this line is uncommented:

```text
%wheel ALL=(ALL:ALL) ALL
```

### SSH Key Login

From your own computer, create an SSH key if you do not already have one:

```bash
ssh-keygen -t ed25519 -C "word-dash-deploy"
```

Copy the public key to the server:

```bash
ssh-copy-id deploy@server-ip-address
```

Test the login:

```bash
ssh deploy@server-ip-address
```

After key login works, you can optionally disable password login by editing `/etc/ssh/sshd_config`:

```text
PasswordAuthentication no
PermitRootLogin no
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

Keep one existing SSH session open while testing a new one, so you do not lock yourself out.

### Firewall

Enable a basic firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

If you expose the Go servers directly without Traefik or another reverse proxy, you would also need:

```bash
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
```

For production, prefer exposing only ports `80` and `443` and let Traefik forward traffic internally to `8080` and `8081`.

### Home Router Port Forwarding

If this PC is on a home network, your router must forward public traffic to the PC:

- Forward TCP `80` to the server's local IP port `80`.
- Forward TCP `443` to the server's local IP port `443`.
- Reserve a static local IP for the server in your router settings.

If your ISP changes your public IP, configure dynamic DNS or update DNS records when the IP changes.

## 4. Clone and Build the Backend

Log in as the deploy user:

```bash
ssh deploy@server-ip-address
```

Create the app directory:

```bash
sudo mkdir -p /opt/word-dash
sudo chown deploy:deploy /opt/word-dash
```

Clone the repository:

```bash
git clone git@github.com:sras1599/word-dash.git /opt/word-dash
```

If the server does not have a GitHub SSH key, use HTTPS instead:

```bash
git clone https://github.com/sras1599/word-dash.git /opt/word-dash
```

Build and test the backend:

```bash
cd /opt/word-dash/backend
make test
make build
```

The backend binary will be created at:

```text
/opt/word-dash/backend/bin/server
```

Run it manually once to verify it starts:

```bash
cd /opt/word-dash/backend
PORT=8080 WS_PORT=8081 CORS_ORIGIN=https://<github-user>.github.io ./bin/server
```

In another terminal, check both health endpoints:

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8081/healthz
```

Stop the manual server with `Ctrl+C` after testing.

## 5. Configure Runtime Environment

Create an environment file:

```bash
sudo mkdir -p /etc/word-dash
sudo nano /etc/word-dash/backend.env
```

Example production config:

```env
PORT=8080
WS_PORT=8081
CORS_ORIGIN=https://<github-user>.github.io
REDIS_URL=redis://127.0.0.1:6379/0
TURN_DURATION_MS=90000
DEFAULT_WORD_LENGTHS=3,4,5
```

Set safe permissions:

```bash
sudo chown root:root /etc/word-dash/backend.env
sudo chmod 0644 /etc/word-dash/backend.env
```

Environment variables:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `8080` | REST API listen port |
| `WS_PORT` | No | `8081` | WebSocket listen port |
| `REDIS_URL` | No | empty | Redis connection string; empty uses in-memory storage |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Browser origin allowed to call REST APIs |
| `TURN_DURATION_MS` | No | `90000` | Turn timer duration in milliseconds |
| `DEFAULT_WORD_LENGTHS` | No | `3,4,5` | Allowed word lengths for default games |

Use the exact GitHub Pages origin for `CORS_ORIGIN`, without a trailing slash.

## 6. Redis

The backend can run without Redis. If `REDIS_URL` is unset, rooms live only in process memory. That is fine for quick testing, but all active rooms disappear when the backend restarts.

For a hosted setup, use Redis:

```bash
sudo systemctl enable --now redis
sudo systemctl status redis
redis-cli ping
```

Expected response:

```text
PONG
```

Use this environment value for local Redis:

```env
REDIS_URL=redis://127.0.0.1:6379/0
```

Redis stores active room and game state. It is not storing user accounts, passwords, or payment data. Treat it as operational game state, not as a long-term database.

## 7. Create a systemd Service

Create the service file:

```bash
sudo nano /etc/systemd/system/word-dash-backend.service
```

Paste:

```ini
[Unit]
Description=Word Dash backend
After=network-online.target redis.service
Wants=network-online.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/word-dash/backend
EnvironmentFile=/etc/word-dash/backend.env
ExecStart=/opt/word-dash/backend/bin/server
Restart=on-failure
RestartSec=3

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/word-dash/backend

[Install]
WantedBy=multi-user.target
```

Load and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now word-dash-backend
sudo systemctl status word-dash-backend
```

Check logs:

```bash
journalctl -u word-dash-backend -f
```

Check health:

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8081/healthz
```

Useful service commands:

```bash
sudo systemctl restart word-dash-backend
sudo systemctl stop word-dash-backend
sudo systemctl start word-dash-backend
sudo systemctl status word-dash-backend
```

## 8. Manual Updates

Create a deploy script:

```bash
nano /opt/word-dash/deploy-backend.sh
```

Paste:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/word-dash
git fetch origin
git checkout main
git pull --ff-only origin main

cd /opt/word-dash/backend
make test
make build

sudo systemctl restart word-dash-backend

curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8081/healthz
```

Make it executable:

```bash
chmod +x /opt/word-dash/deploy-backend.sh
```

Run it whenever you want to deploy the latest backend:

```bash
/opt/word-dash/deploy-backend.sh
```

If the script asks for a sudo password during the restart, that is expected unless you configure passwordless sudo for only that command.

## 9. Optional GitHub Actions Deployment

You can use GitHub Actions to SSH into the server and run the same deploy script.

On the server, make sure the deploy script works manually first:

```bash
/opt/word-dash/deploy-backend.sh
```

Add these GitHub repository secrets:

| Secret | Example | Purpose |
| --- | --- | --- |
| `DEPLOY_HOST` | `api.example.com` | Server hostname or IP |
| `DEPLOY_USER` | `deploy` | SSH user |
| `DEPLOY_SSH_KEY` | private key text | SSH private key allowed to log in as `deploy` |

Example workflow file:

```yaml
name: Deploy backend

on:
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Start SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}

      - name: Deploy
        run: |
          ssh -o StrictHostKeyChecking=accept-new \
            ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} \
            /opt/word-dash/deploy-backend.sh
```

This runs tests and builds on the server. That keeps the server as the source of the running binary and avoids copying artifacts between machines.

If `sudo systemctl restart word-dash-backend` blocks for a password in CI, create a restricted sudoers rule:

```bash
sudo visudo -f /etc/sudoers.d/word-dash-deploy
```

Add:

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart word-dash-backend
```

Keep this rule narrow. Do not grant passwordless sudo for all commands.

## 10. GitHub Pages Frontend

The frontend is static after build. For GitHub Pages, configure the build with backend URLs.

For a direct backend domain:

```env
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

For a sub-path reverse proxy:

```env
VITE_API_URL=https://example.com/word-dash/api
VITE_WS_URL=wss://example.com/word-dash/realtime
```

The backend must set `CORS_ORIGIN` to the public frontend origin:

```env
CORS_ORIGIN=https://<github-user>.github.io
```

If the GitHub Pages site is a project page, the origin is still only the scheme and host. For example:

```text
Frontend URL:    https://<github-user>.github.io/word-dash/
CORS_ORIGIN:     https://<github-user>.github.io
```

The browser sends only the origin in CORS checks, not the path.

## 11. Traefik Reverse Proxy Examples

Traefik should terminate TLS on `443`, then forward REST traffic to `127.0.0.1:8080` and WebSocket traffic to `127.0.0.1:8081`.

WebSockets do not need special headers in Traefik when the router forwards the request normally; Traefik handles the upgrade.

### Direct Domain

This example serves both REST and WebSocket on `api.example.com`:

```yaml
http:
  routers:
    word-dash-rest:
      rule: "Host(`api.example.com`) && (Path(`/healthz`) || PathPrefix(`/rooms`))"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: word-dash-rest

    word-dash-ws:
      rule: "Host(`api.example.com`) && PathPrefix(`/ws`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: word-dash-ws

  services:
    word-dash-rest:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8080"

    word-dash-ws:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8081"
```

Frontend values:

```env
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

### Sub-path

This example serves REST under `/word-dash/api` and WebSocket under `/word-dash/realtime`.

The backend still expects root-relative paths like `/rooms` and `/ws`, so Traefik must strip the external prefixes before forwarding:

```yaml
http:
  routers:
    word-dash-rest-subpath:
      rule: "Host(`example.com`) && PathPrefix(`/word-dash/api`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - word-dash-strip-api
      service: word-dash-rest

    word-dash-ws-subpath:
      rule: "Host(`example.com`) && PathPrefix(`/word-dash/realtime`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - word-dash-strip-realtime
      service: word-dash-ws

  middlewares:
    word-dash-strip-api:
      stripPrefix:
        prefixes:
          - "/word-dash/api"

    word-dash-strip-realtime:
      stripPrefix:
        prefixes:
          - "/word-dash/realtime"

  services:
    word-dash-rest:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8080"

    word-dash-ws:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8081"
```

External URLs:

```text
REST API:  https://example.com/word-dash/api/rooms
WebSocket: wss://example.com/word-dash/realtime/ws
```

Frontend values:

```env
VITE_API_URL=https://example.com/word-dash/api
VITE_WS_URL=wss://example.com/word-dash/realtime
```

## 12. Verification Checklist

On the server:

```bash
systemctl status word-dash-backend
journalctl -u word-dash-backend -n 100 --no-pager
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8081/healthz
```

Through the public URL:

```bash
curl --fail https://api.example.com/healthz
```

For sub-path REST:

```bash
curl --fail https://example.com/word-dash/api/healthz
```

For WebSocket, open the frontend and check the browser devtools Network tab. The `/ws` request should show a successful WebSocket connection, not a failed HTTP request.

## 13. Troubleshooting

### SSH Fails

Check that SSH is running:

```bash
sudo systemctl status sshd
```

Check firewall rules:

```bash
sudo ufw status verbose
```

If you are connecting from outside your home network, check router port forwarding for port `22`, or use a VPN/tunnel instead of exposing SSH publicly.

### Backend Service Will Not Start

Check logs:

```bash
journalctl -u word-dash-backend -n 100 --no-pager
```

Common causes:

- `/opt/word-dash/backend/bin/server` does not exist. Run `cd /opt/word-dash/backend && make build`.
- The environment file has invalid values.
- `REDIS_URL` is set but Redis is not running.
- Another process is already using `8080` or `8081`.

Check ports:

```bash
ss -ltnp
```

### Redis Connection Fails

Check Redis:

```bash
sudo systemctl status redis
redis-cli ping
```

If Redis is not needed for a quick test, remove `REDIS_URL` from `/etc/word-dash/backend.env` and restart:

```bash
sudo systemctl restart word-dash-backend
```

### CORS Errors in Browser

Symptoms:

- Room creation or joining fails in the browser.
- Browser console mentions CORS or `Access-Control-Allow-Origin`.

Fix:

- Set `CORS_ORIGIN` to the frontend origin exactly.
- Do not include a path in `CORS_ORIGIN`.
- Restart the backend after changing `/etc/word-dash/backend.env`.

Example:

```env
CORS_ORIGIN=https://<github-user>.github.io
```

Then:

```bash
sudo systemctl restart word-dash-backend
```

### WebSocket Fails

Symptoms:

- The lobby loads, but real-time updates do not work.
- Browser devtools shows `/ws` failing.
- Traefik logs show 404 or 502 for WebSocket requests.

Fix:

- Confirm `VITE_WS_URL` is using `wss://` for HTTPS sites.
- Confirm the frontend value does not include `/ws`.
- Confirm Traefik routes `/ws` to port `8081`.
- For sub-path deployments, confirm Traefik strips `/word-dash/realtime` before forwarding.
- Confirm the backend WebSocket health endpoint responds locally:

```bash
curl --fail http://127.0.0.1:8081/healthz
```

### Public HTTPS Does Not Work

Check:

- DNS record points to your public IP.
- Router forwards ports `80` and `443` to the server.
- `ufw` allows ports `80` and `443`.
- Traefik is running.
- Let's Encrypt can reach your server over the public internet.

Use:

```bash
curl -v https://api.example.com/healthz
```

### Deployment Script Fails in GitHub Actions

Common causes:

- `DEPLOY_SSH_KEY` does not match a public key in `/home/deploy/.ssh/authorized_keys`.
- The server rejects GitHub's SSH connection.
- `deploy-backend.sh` is not executable.
- The deploy user cannot restart the systemd service.

Test from your own machine first:

```bash
ssh deploy@api.example.com /opt/word-dash/deploy-backend.sh
```
