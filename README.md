# DevOps Incident Management Application

## DevOps Containerization Assignment

Welcome to the DevOps engineering team.

This repository contains a three-tier incident-management application.

---

## 1. Application overview

The application is an **Incident Command Center** used to record and manage operational incidents.

Users can:

- View all incidents
- Create an incident
- Assign a severity
- Change an incident's status
- Delete an incident
- View the number of active incidents

The frontend communicates with the backend through HTTP. The backend stores and retrieves incident records from PostgreSQL.

### Architecture

```text
Browser
   |
   | HTTP
   v
Frontend service
   |
   | /api/*
   v
Backend service
   |
   | PostgreSQL protocol
   v
Database service
```

The browser should access only the frontend for normal application usage. The frontend runtime should route API requests to the backend service.

---

## 2. Repository structure

```text
incident-management-docker-lab/
├── backend/
│   ├── package.json
│   └── src/
│       ├── db.js
│       └── server.js
│
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── styles.css
│
├── .env.example
└── README.md
```

---

## 3. Technical specification

### 3.1 Frontend

| Item | Specification |
|---|---|
| Framework | React 18 |
| Build tool | Vite 6 |
| Language | JavaScript with JSX |
| Package manager | npm |
| Development command | `npm run dev` |
| Production build command | `npm run build` |
| Build output | `dist/` |
| Development port | Vite default, normally `5173` |
| API path used by browser | `/api/incidents` |

The frontend uses relative API URLs such as:

```text
/api/incidents
/api/incidents/:id/status
```

The production frontend container must therefore provide a way to forward `/api` traffic to the backend service, or an equivalent design that does not require hardcoding a host-only backend URL into the browser bundle.

### Frontend package scripts

```json
{
  "dev": "vite --host 0.0.0.0",
  "build": "vite build",
  "preview": "vite preview --host 0.0.0.0"
}
```

### Frontend container expectations

The final frontend image should:

- Build the React application successfully
- Serve the compiled production assets
- Listen on all required interfaces
- Forward `/api` requests to the backend service
- Avoid shipping unnecessary build dependencies in the runtime image
- Return the frontend application for client-side routes where appropriate
- Include a meaningful health check

A multi-stage build is strongly recommended.

---

### 3.2 Backend

| Item | Specification |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| PostgreSQL client | `pg` |
| Module system | ES modules |
| Package manager | npm |
| Production command | `npm start` |
| Development command | `npm run dev` |
| Default application port | `5000` |
| Bind address | `0.0.0.0` |

### Backend package scripts

```json
{
  "start": "node src/server.js",
  "dev": "node --watch src/server.js"
}
```

### Backend runtime behavior

During startup, the backend:

1. Attempts to connect to PostgreSQL
2. Retries failed database connections
3. Creates the `incidents` table when it does not exist
4. Inserts sample records when the table is empty
5. Starts the HTTP server on `0.0.0.0`

The backend also handles `SIGTERM` and `SIGINT` so database connections can be closed during container shutdown.

### Backend environment variables

| Variable | Required purpose | Application default |
|---|---|---|
| `PORT` | Backend HTTP port | `5000` |
| `DB_HOST` | PostgreSQL hostname | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `incidentdb` |
| `DB_USER` | Database user | `incident_user` |
| `DB_PASSWORD` | Database password | `incident_password` |
| `NODE_ENV` | Runtime environment | Not enforced by source |

For a containerized environment, `DB_HOST` must refer to the database service through the Docker network. It must not use the host machine's `localhost` unless the database is intentionally running in the same container, which is not permitted for this assignment.

### Backend container expectations

The backend image should:

- Use an appropriate supported Node.js base image
- Install only required production dependencies in the final runtime
- Use Docker layer caching effectively
- Exclude local dependencies and unnecessary files from the build context
- Run the application using `npm start`
- Listen on port `5000` inside the container
- Run as a non-root user
- Include a backend health check
- Shut down cleanly when Compose stops the service

---

### 3.3 Database

| Item | Specification |
|---|---|
| Database engine | PostgreSQL |
| Recommended major version | PostgreSQL 16 |
| Internal port | `5432` |
| Default database | `incidentdb` |
| Default user | `incident_user` |

Use an official PostgreSQL image rather than creating a custom database image unless you can justify the need.

The database must be configured through environment variables and must use persistent storage.

### Database schema

The backend creates the following logical table:

| Column | Type and behavior |
|---|---|
| `id` | Auto-incrementing primary key |
| `title` | Required text, maximum 200 characters |
| `description` | Text, defaults to empty string |
| `severity` | `low`, `medium`, `high`, or `critical` |
| `status` | `open`, `investigating`, or `resolved` |
| `created_at` | Timestamp with time zone |
| `updated_at` | Timestamp with time zone |

The database data must survive container replacement and normal `docker compose down` operations.

---

## 4. REST API contract

### Health check

```http
GET /health
```

Healthy response:

```json
{
  "service": "incident-backend",
  "status": "healthy",
  "database": "connected"
}
```

The endpoint returns HTTP `503` when the backend cannot query the database.

---

### List incidents

```http
GET /api/incidents
```

Expected response: HTTP `200` with a JSON array.

---

### Create an incident

```http
POST /api/incidents
Content-Type: application/json
```

Example request:

```json
{
  "title": "Checkout API unavailable",
  "description": "Customers cannot complete payment.",
  "severity": "critical",
  "status": "open"
}
```

Expected response: HTTP `201` with the created incident.

Validation rules:

- `title` is required
- `title` must have at least three characters
- `severity` must be `low`, `medium`, `high`, or `critical`
- `status` must be `open`, `investigating`, or `resolved`

---

### Update incident status

```http
PATCH /api/incidents/:id/status
Content-Type: application/json
```

Example body:

```json
{
  "status": "resolved"
}
```

Expected response: HTTP `200` with the updated incident.

---

### Delete an incident

```http
DELETE /api/incidents/:id
```

Expected response: HTTP `204`.

---

## 5. Containerization requirements

Your solution must provide exactly three application services:

- `frontend`
- `backend`
- `database`

Supporting one-time or administrative containers may be proposed, but you must not replace the three required services.

### 5.1 Service networking

Create a Compose network that allows:

```text
frontend -> backend
backend  -> database
```

Use Compose service discovery rather than fixed container IP addresses.

Do not use:

- Hardcoded container IP addresses
- Host networking as a shortcut
- `localhost` for communication between different containers
- A single container containing all three application tiers

Only ports needed by the host should be published.

Recommended host access:

| Component | Suggested host port | Required exposure |
|---|---:|---|
| Frontend | `3000` | Yes |
| Backend | `5000` | Optional but useful for testing |
| PostgreSQL | `5432` | Not required for normal use |

The database should remain private to the Compose network unless external access is explicitly required for debugging.

---

### 5.2 Configuration

Provide a committed `.env.example` containing non-sensitive example values.

Do not commit a real `.env` file containing secrets.

The Compose configuration must support at least:

```env
POSTGRES_DB=incidentdb
POSTGRES_USER=incident_user
POSTGRES_PASSWORD=change_me
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

Database credentials must not be embedded in a Dockerfile or application image.

For this exercise, environment variables are acceptable. In a production platform, secrets would normally be supplied through a dedicated secret-management solution.

---

### 5.3 Persistence

The following workflow must preserve incident records:

```bash
docker compose up -d
# Create an incident
docker compose down
docker compose up -d
# The incident must still exist
```

The following command may intentionally delete all data:

```bash
docker compose down -v
```

Document this distinction clearly.

---

### 5.4 Reliability and operations

The Compose solution should include sensible restart behavior.

The environment must support:

```bash
docker compose up --build
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

Logs must remain visible through standard container output. Do not write application logs only to files inside ephemeral containers.

---

## 6. Required deliverables

Submit the following:

1. `backend/Dockerfile`
2. `backend/.dockerignore`
3. `frontend/Dockerfile`
4. `frontend/.dockerignore`
5. `compose.yaml`
6. Any required frontend web-server or proxy configuration
7. `.env.example`
8. Updated operational documentation
9. A short design note named `DEVOPS_NOTES.md`

---

## 7. Acceptance criteria

The assignment is complete only when all of the following pass.

### Build and startup

- [ ] `docker compose config` completes successfully
- [ ] `docker compose build` completes successfully
- [ ] `docker compose up -d` starts all required services
- [ ] `docker compose ps` shows the services running
- [ ] All configured health checks become healthy

### Functional behavior

- [ ] The frontend opens in a browser
- [ ] The incident list loads successfully
- [ ] A new incident can be created
- [ ] Incident status can be updated
- [ ] An incident can be deleted
- [ ] Backend `/health` returns HTTP `200`
- [ ] Backend health confirms database connectivity

### Networking

- [ ] The frontend reaches the backend using container networking
- [ ] The backend reaches PostgreSQL using container networking
- [ ] No fixed container IP address is used
- [ ] Cross-container communication does not use `localhost`

### Persistence

- [ ] PostgreSQL uses a named volume
- [ ] Data survives `docker compose down` and restart
- [ ] `docker compose down -v` removes the persistent database data

### Security and image quality

- [ ] `.dockerignore` exists for each custom build context
- [ ] Database credentials are not embedded in Dockerfiles
- [ ] The backend runtime does not run as root
- [ ] The frontend uses a production build
- [ ] The final frontend runtime does not require the Vite development server
- [ ] Unnecessary files are excluded from final images

### Documentation

- [ ] Setup instructions work on a clean machine with Docker installed
- [ ] Required environment variables are documented
- [ ] Start, stop, logs, rebuild, reset, and troubleshooting commands are documented
- [ ] `DEVOPS_NOTES.md` explains the design decisions

---

## 8. Validation commands

Run these commands before submitting your solution.

### Validate Compose syntax

```bash
docker compose config
```

### Build the images

```bash
docker compose build
```

### Start the application

```bash
docker compose up -d
```

### Inspect status

```bash
docker compose ps
```

### Inspect logs

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 database
```

### Test backend health

```bash
curl --fail http://localhost:5000/health
```

### List incidents

```bash
curl --fail http://localhost:5000/api/incidents
```

### Create an incident

```bash
curl --fail -X POST http://localhost:5000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Containerization validation incident",
    "description": "Created while validating the Docker environment.",
    "severity": "medium"
  }'
```

### Verify frontend

Open:

```text
http://localhost:3000
```

### Verify persistence

```bash
docker compose down
docker compose up -d
curl --fail http://localhost:5000/api/incidents
```

Confirm that the validation incident still exists.

---

## 9. Troubleshooting expectations

A DevOps engineer is expected to diagnose issues systematically rather than changing files randomly.

### Recommended debugging sequence

1. Validate the Compose model:

   ```bash
   docker compose config
   ```

2. Check container state:

   ```bash
   docker compose ps
   ```

3. Read service logs:

   ```bash
   docker compose logs backend
   docker compose logs database
   docker compose logs frontend
   ```

4. Inspect environment variables inside a service:

   ```bash
   docker compose exec backend env
   ```

5. Verify DNS and service connectivity from inside the relevant container.

6. Verify that the process listens on `0.0.0.0`, not only `127.0.0.1`.

7. Confirm the internal container port and published host port are not being confused.

8. Confirm PostgreSQL data permissions and the volume mount path.

### Common conceptual errors

- Using `localhost` to reach another container
- Assuming `EXPOSE` publishes a host port
- Using `depends_on` without checking readiness
- Storing database files only in the writable container layer
- Running a development server as the production frontend
- Copying `node_modules` from the host into an image
- Reinstalling dependencies on every source-code change because of poor layer ordering
- Baking passwords into images
- Publishing PostgreSQL unnecessarily
- Treating a running container as a healthy application

---
