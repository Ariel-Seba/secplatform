# SecPlatform

Modular Security Operations Platform — Docker-based, web-first, extensible.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS (dark tech theme) |
| Backend | FastAPI (Python 3.12) + SQLAlchemy async |
| Auth | JWT (access 15min + refresh 7d) + RBAC by groups |
| Database | PostgreSQL 16 + Redis 7 |
| Modules | Independent FastAPI microservices (Docker) |
| Reports | WeasyPrint + Jinja2 → PDF |
| Proxy | Traefik v3 |
| CI/CD | GitHub Actions + Checkov |

## Quick Start

```bash
# 1. Clone and configure
git clone https://github.com/Ariel-Seba/secplatform
cd secplatform/infra
cp .env.example .env
# Edit .env with your secrets

# 2. Start platform
docker compose up -d

# 3. Seed initial data (first time)
docker compose exec backend python /app/scripts/seed-db.py

# 4. Access
# Web UI:  https://secplatform.local  (or http://localhost:3000 in dev)
# API:     https://api.secplatform.local/api/docs
# Monitor: https://monitor.secplatform.local
```

Default credentials: `admin` / `Admin1234!`

## Add a new module

```bash
./scripts/new-module.sh module-name 8004
```

## Modules

| Module | Port | Category | Tools |
|--------|------|----------|-------|
| pentest | 8001 | Offensive | nmap, nikto |
| discovery | 8002 | Recon | subfinder, httpx |
| compliance | 8003 | Compliance | checkov, lynis |
| report-engine | 8010 | Reports | WeasyPrint |

## CI/CD

Every PR triggers Checkov security scan on Dockerfiles and docker-compose. HIGH/CRITICAL findings block merge.
On merge to `main`: Docker images are built and pushed to `ghcr.io`, then deployed.

## Report Templates

- `executive` — C-Suite / Client (5-8 pages)
- `technical` — Engineering team (detailed findings)
- `compliance` — Audit / Legal (controls + gaps)
- `discovery` — Attack surface overview
