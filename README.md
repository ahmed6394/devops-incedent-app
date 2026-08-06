# DevOps Incident Management

This repository is a practical DevOps engineering lab that combines a containerized full-stack application with a production-style CI/CD workflow. The application is a small incident management platform, but the main focus of this project is demonstrating modern DevOps practices such as containerization, orchestration, automated verification, image scanning, and release automation.

## What this project demonstrates

- Containerization of a multi-service application with Docker and Docker Compose
- Infrastructure-friendly service orchestration with health checks and persistent storage
- CI/CD automation in GitHub Actions
- Vulnerability scanning with Trivy
- A clear path to add SonarQube for static analysis and code quality gates
- End-to-end smoke testing against the real stack

## Application architecture

```text
User -> Frontend (React + Nginx) -> Backend (Express + Node.js) -> PostgreSQL
```

The stack is composed of three main services:

- Frontend: a React application served through Nginx in production mode
- Backend: an Express API with session-based authentication and incident management logic
- Database: PostgreSQL with persistent storage and health checks

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Nginx |
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Orchestration | Docker Compose |
| CI/CD | GitHub Actions |
| Security | Trivy |
| Quality | SonarQube (planned integration) |

## Repository structure

```text
docker-lab/
├── backend/              # Express API service and Dockerfile
├── frontend/             # React frontend and Nginx config
├── docs/                 # design specs and engineering notes
├── .github/workflows/    # CI/CD pipeline definition
├── docker-compose.yaml   # local multi-container environment
├── README.md             # DevOps-focused project documentation
```

## Local development and operations

### Prerequisites

- Docker Engine
- Docker Compose v2
- Git

### Start the stack locally

```bash
docker compose up -d --build
```

### Useful commands

```bash
docker compose ps
docker compose logs -f backend
docker compose down
docker compose down -v
```

### Access points

| Service | URL |
| --- | --- |
| Application | http://localhost:3000 |
| Backend health | http://localhost:5000/health |
| Adminer (optional) | http://localhost:8080 |

## Environment configuration

The application uses environment variables through Docker Compose. A local `.env` file can be created from the example file if custom values are needed.

```bash
cp .env.example .env
```

Key variables include:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## CI/CD pipeline

The GitHub Actions pipeline in [.github/workflows/ci.yml](.github/workflows/ci.yml) is designed as a release-quality workflow for this project.

### Current pipeline stages

1. Build
   - Validates the Compose configuration
   - Builds both application images

2. Static analysis with SonarQube
   - Runs code quality and maintainability checks
   - Helps detect bugs, vulnerabilities, and code smells early in the pipeline

3. Security scanning with Trivy
   - Scans the backend and frontend images for vulnerabilities
   - Fails the pipeline on CRITICAL and HIGH issues

4. Smoke testing
   - Starts the full stack with Docker Compose
   - Verifies the frontend, backend health endpoint, and API flows
   - Tears down the environment after verification

5. Publish
   - On pushes to `main`, publishes images to Docker Hub with `latest` and `sha-<commit>` tags

### CI/CD intent

This workflow reflects the core DevOps loop:

- Build reliably
- Validate changes automatically
- Scan for vulnerabilities
- Test in a near-production environment
- Publish verified artifacts

## Security and quality engineering

### Trivy

Trivy is already integrated into the pipeline for container image vulnerability scanning. The workflow is configured to stop the build when CRITICAL or HIGH issues are detected, helping enforce a stronger security gate before release.

### SonarQube

SonarQube is the next logical quality gate for this project. It can be used to provide:

- Static code analysis
- Code smells and maintainability metrics
- Security hotspots review
- Quality thresholds for pull requests

In practice, this repository is structured so that SonarQube can be added as an additional pipeline step alongside Trivy without changing the overall delivery model.

## Operational notes

- The backend waits for the PostgreSQL service to become healthy before starting.
- Health checks are defined for the major services to support orchestration reliability.
- Container images are built locally and can also be published to a registry from CI.
- Named Docker volumes preserve database state between restarts unless explicitly removed.

## Troubleshooting

- If the backend fails to start, check whether the database service is healthy.
- If ports are already in use, update the host port mappings in the environment file.
- If the app is running but API calls fail, verify that the backend is healthy and that the session cookie is present.
- To reset the local environment completely, run:

```bash
docker compose down -v
```

## Summary

This project serves as a compact but realistic example of DevOps engineering in practice: application delivery, containerization, automation, security, testing, and release workflow all live in one repository.
