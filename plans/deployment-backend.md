# Backend Deployment Plan — EC2

**TL;DR:** Cross-compile the Go binary locally, provision a t2.micro EC2 with a free DuckDNS subdomain + certbot TLS, run the binary under systemd, and nginx reverse-proxies both the REST and WebSocket servers under a single HTTPS host.

---

## Phase 1 — Local: build the binary

### Step 1 — Cross-compile for Linux

From the `backend/` directory:
```bash
cd backend
GOOS=linux GOARCH=amd64 go build -o bin/server-linux ./cmd/server
```
This produces `backend/bin/server-linux`, a self-contained binary with no runtime dependencies.

---

## Phase 2 — AWS: provision the instance

### Step 2 — Launch EC2

1. Go to AWS Console → EC2 → **Launch instance**
2. Name: `wordit`
3. AMI: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** (free tier eligible)
4. Instance type: **t2.micro** (free tier) or **t3.micro** ($0.01/hr if you want slightly better performance)
5. Key pair: create a new key pair named `wordit-key`, download the `.pem` file, store it safely
6. Network settings → **Edit**:
   - Create a new security group named `wordit-sg`
   - Add inbound rules:
     | Type | Port | Source |
     |------|------|--------|
     | SSH | 22 | My IP |
     | HTTP | 80 | Anywhere (0.0.0.0/0) |
     | HTTPS | 443 | Anywhere (0.0.0.0/0) |
7. Storage: default 8 GiB gp3 is fine
8. Click **Launch instance**

### Step 3 — Allocate and attach an Elastic IP

1. EC2 → **Elastic IPs** → **Allocate Elastic IP address** → Allocate
2. Select the new Elastic IP → **Actions → Associate Elastic IP address**
3. Select your `wordit` instance → Associate
4. **Note the IP address** — you'll use it everywhere below. Example: `1.2.3.4`

---

## Phase 3 — DuckDNS: free subdomain

### Step 4 — Create a DuckDNS subdomain

1. Go to [duckdns.org](https://www.duckdns.org) and sign in (GitHub login works)
2. In the subdomain field, type `wordit-api` → click **add domain**
3. In the **current ip** column, paste your Elastic IP (`1.2.3.4`) → click **update ip**
4. Your backend will be reachable at `wordit-api.duckdns.org`

Wait ~60 seconds, then verify DNS is resolving before continuing:
```bash
dig +short wordit-api.duckdns.org
# should print your Elastic IP
```

---

## Phase 4 — Server setup

### Step 5 — SSH into the instance

```bash
chmod 400 ~/Downloads/wordit-key.pem
ssh -i ~/Downloads/wordit-key.pem ubuntu@1.2.3.4
```

### Step 6 — Install nginx and certbot

```bash
sudo apt update
sudo apt install -y nginx python3-certbot-nginx
```

### Step 7 — Get a TLS certificate via certbot

```bash
sudo certbot --nginx -d wordit-api.duckdns.org
```

When prompted:
- Enter your email address (for renewal notices)
- Agree to terms: `Y`
- Share email with EFF: your choice
- Redirect HTTP to HTTPS: **2** (yes, redirect)

Certbot writes its own server block to `/etc/nginx/sites-enabled/default`. You'll replace it in the next step.

### Step 8 — Configure nginx

Create the site config:
```bash
sudo nano /etc/nginx/sites-available/wordit
```

Paste this content (replace `wordit-api.duckdns.org` if you chose a different subdomain):
```nginx
server {
    listen 80;
    server_name wordit-api.duckdns.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name wordit-api.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/wordit-api.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wordit-api.duckdns.org/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # WebSocket — proxied to WS server on :8081
    location /ws {
        proxy_pass         http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 3600s;
    }

    # REST API — proxied to REST server on :8080
    location / {
        proxy_pass         http://localhost:8080;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

Enable it and remove the default site:
```bash
sudo ln -s /etc/nginx/sites-available/wordit /etc/nginx/sites-enabled/wordit
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t        # must say "syntax is ok"
sudo systemctl reload nginx
```

### Step 9 — Create the application directory and .env

```bash
mkdir -p ~/wordit
nano ~/wordit/.env
```

Paste:
```
PORT=8080
WS_PORT=8081
CORS_ORIGIN=https://sras1599.github.io
TURN_DURATION_MS=90000
DEFAULT_WORD_LENGTHS=5
```

Save and close (`Ctrl+X`, `Y`, `Enter`). Lock down the file so only the current user can read it:
```bash
chmod 600 ~/wordit/.env
```

### Step 10 — Create the systemd service

```bash
sudo nano /etc/systemd/system/wordit.service
```

Paste:
```ini
[Unit]
Description=Wordit Game Server
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/wordit
EnvironmentFile=/home/ubuntu/wordit/.env
ExecStart=/home/ubuntu/wordit/server
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## Phase 5 — Deploy the binary

### Step 11 — Upload the binary

Run this on your **local machine**, not the server:
```bash
scp -i ~/Downloads/wordit-key.pem \
  backend/bin/server-linux \
  ubuntu@1.2.3.4:~/wordit/server
```

Then SSH back in and make it executable:
```bash
ssh -i ~/Downloads/wordit-key.pem ubuntu@1.2.3.4
chmod +x ~/wordit/server
```

### Step 12 — Start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable wordit
sudo systemctl start wordit
sudo systemctl status wordit    # should show "active (running)"
```

---

## Phase 6 — Verify

### Step 13 — Smoke test

From your local machine:
```bash
curl https://wordit-api.duckdns.org/healthz
# expected: {"status":"ok"}
```

Check logs if something is wrong:
```bash
sudo journalctl -u wordit -f
```

---

## Redeployment (after code changes)

```bash
# locally — rebuild and upload
GOOS=linux GOARCH=amd64 go build -o bin/server-linux ./cmd/server
scp -i ~/Downloads/wordit-key.pem backend/bin/server-linux ubuntu@1.2.3.4:~/wordit/server

# on server — restart the service
sudo systemctl restart wordit
```
