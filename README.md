# DevOps Incident Management

A containerized three-tier application for recording and tracking operational
incidents. A React frontend, an Express backend, and a PostgreSQL database run
together under Docker Compose.

## Features

- **Incident lifecycle** — create, list, update status (`open`, `investigating`,
  `resolved`), and delete incidents
- **Authentication** — session-cookie login; every API endpoint except `/health`
  requires a signed-in user
- **Role-based access** — `admin` users manage other users; regular `user`
  accounts manage incidents
- **Attribution** — each incident shows who registered it and, when resolved,
  who resolved it and when
- **Platform tagging** — every incident carries a source (`manual`, `docker`, or
  `kubernetes`) and an optional source reference (e.g. `web-api` or
  `payments/payments-7d8f6c9b55`), with filtering by source
- **Persistence** — PostgreSQL data lives in a named volume and survives
  `docker compose down`
- **Operations** — health checks on every service, non-root backend, optional
  Adminer database console under a Compose profile

## Architecture

```text
Browser
   |
   | HTTP (port 3000)
   v
Frontend (nginx: static assets + /api proxy)
   |
   | /api/* (container network)
   v
Backend (Express, port 5000)
   |
   | PostgreSQL protocol
   v
Database (PostgreSQL 16)
```

The browser talks only to the frontend. nginx serves the compiled React bundle
and proxies `/api` requests to the backend service by name, so no host-only
URLs are baked into the frontend.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, nginx (production) |
| Backend | Node.js 22, Express 4, `pg`, `express-session`, `bcryptjs` |
| Database | PostgreSQL 16 |
| Admin console | Adminer 5 (optional) |

## Repository layout

```text
docker-lab/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
│       ├── server.js      # Express app, routes, error handling
│       ├── db.js          # schema init, migration, seed data
│       ├── auth.js        # session, login/logout/me, guards
│       └── users.js       # admin user management
├── frontend/
│   ├── Dockerfile         # multi-stage: Vite build -> nginx
│   ├── .dockerignore
│   ├── nginx.conf         # serves assets + /api proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── api.js
│       └── styles.css
├── docker-compose.yaml
├── .env.example
├── .env                   # local overrides (never committed if secret)
└── README.md
```

## Getting started

### Prerequisites

- Docker with Docker Compose v2

### 1. Configure environment (optional)

The stack runs out of the box with its built-in defaults. To override them,
create a `.env` file:

```bash
cp .env.example .env
```

### 2. Start the stack

```bash
docker compose up -d --build
```

### 3. Open the app

| Component | URL |
| --- | --- |
| Application | http://localhost:3000 |
| Backend health | http://localhost:5000/health |
| Adminer (optional) | http://localhost:8080 (see below) |

Sign in with the default account. **Change the password immediately after
first login** — the backend prints `Seeded admin user 'admin'. Change its
password!` on first start.

### Default login

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin` | admin |

These defaults come from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in
`docker-compose.yaml` and can be changed via the `.env` file.

## Configuration

All values can be overridden in `.env`:

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_DB` | database, backend | `incidentdb` | Database name |
| `POSTGRES_USER` | database, backend | `incident_user` | Database user |
| `POSTGRES_PASSWORD` | database, backend | `change_me` | Database password |
| `BACKEND_PORT` | host mapping | `5000` | Host port for the backend |
| `FRONTEND_PORT` | host mapping | `3000` | Host port for the frontend |
| `SESSION_SECRET` | backend | `dev-session-secret-change-me` | Signs session cookies; set a long random value |
| `ADMIN_USERNAME` | backend | `admin` | Initial admin username (used only when the user does not exist) |
| `ADMIN_PASSWORD` | backend | `admin` | Initial admin password (used only when the user does not exist) |

Environment values are read by Compose at startup. Changing `SESSION_SECRET`
or the admin credentials has no effect on already-seeded accounts — for a
fresh setup, remove the volume first (`docker compose down -v`).

## Usage

### Signing in

The app opens on a login screen. Any authenticated user can create, edit, and
delete incidents; only admins see the **Users** panel.

### Incidents

- Use **Create incident** to register one: title, description, severity, source,
  and an optional source reference (e.g. `web-api`).
- Change an incident's status with its dropdown. Resolving records the current
  user and timestamp as *Resolved by*; reopening clears both.
- Each card shows *Registered by* and, when applicable, *Resolved by*.
- **Filter by source** narrows the list to `manual`, `docker`, or `kubernetes`.

### Managing users (admin only)

The **Users** panel lists all accounts and lets you add or remove users.

Rules enforced by the backend:

- Username: at least 3 characters, unique
- Password: at least 6 characters
- You cannot remove your own account
- A user who has created incidents cannot be removed (HTTP `409`)

## REST API

Base URL: `http://localhost:5000`

All `/api` endpoints require the session cookie obtained from
`POST /api/auth/login`. `/api/users` additionally requires an `admin` role.

### Health (public)

```http
GET /health
```

```json
{
  "service": "incident-backend",
  "status": "healthy",
  "database": "connected"
}
```

Returns `503` when the database is unreachable.

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{"username": "admin", "password": "admin"}
```

Response `200` with `{ "id": 1, "username": "admin", "role": "admin" }`.
Bad credentials return `401`. Logout:

```http
POST /api/auth/logout
```

Returns `204` and clears the cookie. To check the current session:

```http
GET /api/auth/me
```

### Users (admin only)

```http
GET /api/users
```

```http
POST /api/users
Content-Type: application/json

{"username": "alice", "password": "secret1", "role": "user"}
```

Response `201` with the created user. Duplicate username returns `409`.

```http
DELETE /api/users/:id
```

Returns `204`. A user with incidents returns `409`; deleting yourself returns `400`.

### Incidents

```http
GET /api/incidents
```

Optional query parameter to filter by source:

```http
GET /api/incidents?source=docker
```

```http
POST /api/incidents
Content-Type: application/json

{
  "title": "Checkout API unavailable",
  "description": "Customers cannot complete payment.",
  "severity": "critical",
  "status": "open",
  "source": "docker",
  "source_ref": "checkout-api"
}
```

Response `201` with the created incident. `title` is required (min 3 chars);
`severity`, `status`, and `source` must be valid enum values.

```http
PATCH /api/incidents/:id/status
Content-Type: application/json

{"status": "resolved"}
```

Response `200` with the updated incident, including `resolvedBy` and
`resolvedAt` (cleared again when the status is set back to `open` or
`investigating`).

```http
DELETE /api/incidents/:id
```

Response `204`.

Error responses use JSON, e.g. `{ "message": "invalid source" }`, with
`400` (validation), `401` (not authenticated), `403` (not admin),
`404` (not found), and `409` (conflict).

## Data model

### incidents

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `SERIAL` | Primary key |
| `title` | `VARCHAR(200)` | Required |
| `description` | `TEXT` | Default `''` |
| `severity` | `VARCHAR(20)` | `low` / `medium` / `high` / `critical` |
| `status` | `VARCHAR(20)` | `open` / `investigating` / `resolved`, default `open` |
| `source` | `VARCHAR(20)` | `manual` / `docker` / `kubernetes`, default `manual` |
| `source_ref` | `VARCHAR(200)` | Optional reference, e.g. container or pod name |
| `created_by` | `INTEGER` | FK to `users(id)` — who registered it |
| `resolved_by` | `INTEGER` | FK to `users(id)` — who resolved it |
| `resolved_at` | `TIMESTAMPTZ` | Set when resolved, cleared on reopen |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Default `NOW()` |

### users

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `SERIAL` | Primary key |
| `username` | `VARCHAR(50)` | Unique, required |
| `password_hash` | `VARCHAR(255)` | bcrypt hash |
| `role` | `VARCHAR(10)` | `admin` / `user`, default `user` |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |

On startup the backend creates both tables if missing, adds the tagging and
attribution columns to older installs, backfills legacy incidents to the admin
user, and seeds the admin account plus four sample incidents when the tables
are empty.

## Docker & Compose

| Service | Image / build | Published port | Health check |
| --- | --- | --- | --- |
| `database` | `postgres:16-alpine` | none | `pg_isready` |
| `backend` | `./backend` | `5000` | `GET /health` via wget on `127.0.0.1` |
| `frontend` | `./frontend` | `3000` -> nginx `80` | wget on `127.0.0.1` |
| `db-admin` | `adminer:5-alpine` (profile) | `8080` | none |

- Services resolve each other by name (`database`, `backend`) on the default
  Compose network — no fixed IPs, no `localhost` between containers.
- `postgres_data` is a named volume mounted at `/var/lib/postgresql/data`.
- The backend waits for the database health check and retries its own
  connection before starting.
- Adminer is opt-in via the `db-admin` profile:

  ```bash
  docker compose --profile db-admin up -d
  ```

  Open http://localhost:8080, server = `database`, user = `incident_user`.

## Common commands

```bash
docker compose up -d --build   # build and start everything
docker compose ps              # service state and health
docker compose logs -f backend # follow backend logs
docker compose up -d --build backend  # rebuild just the backend
docker compose down            # stop; data persists
docker compose down -v         # stop AND delete the database volume (all data lost)
```

Quick API smoke test:

```bash
# Log in (stores the session cookie in cookies.txt)
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Now hit protected endpoints with the cookie
curl -b cookies.txt http://localhost:5000/api/incidents
```

## Troubleshooting

- **Port already in use** — `docker compose ps` to see what is running; stop any
  conflicting process, or change `FRONTEND_PORT` / `BACKEND_PORT` in `.env`.
- **Backend shows connection errors at startup** — it retries for a while before
  failing; check `docker compose ps database` is healthy.
- **App loads but API calls fail (401)** — the browser session expired (8 hours)
  or cookies are blocked; sign in again. `GET /api/auth/me` reports the session.
- **Forgotten admin password / stale seed** — the admin account is only created
  when missing. Reset by wiping the volume: `docker compose down -v`, then
  adjust `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` and start again.
- **`Cannot read properties of undefined` in browser** — the frontend is talking
  to a backend that is still starting; wait for healthy (`docker compose ps`).
