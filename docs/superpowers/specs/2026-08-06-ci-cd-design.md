# CI/CD Pipeline Design

**Date:** 2026-08-06
**Status:** Approved, implemented

## Objective

Add a GitHub Actions pipeline for the DevOps Incident Management application
that validates every change and publishes container images to Docker Hub after
successful verification.

## Decisions

- **Scope:** CI on every pull request and push to `main`; publish images only on
  pushes to `main`.
- **Verification:** full-stack smoke test against the real compose stack, not
  unit tests (the project has no test suite).
- **Security scan:** Trivy scan of both images with a CRITICAL/HIGH threshold
  that fails the build on findings. Pinned to `aquasecurity/trivy-action@0.36.0`
  (versions up to `0.34.2` were compromised in the March 2026 supply-chain
  attack; `0.35.0` and newer are safe).
- **Registry:** Docker Hub (`ahmed63/devops-incident-management-{backend,frontend}`),
  tags `latest` and `sha-<commit>`.
- **Secrets:** `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, stored as GitHub
  Actions secrets. Nothing is hardcoded; CI uses compose defaults
  (`admin`/`admin`), which are acceptable on a throwaway runner.
- **No CD:** no deployment step.

## Pipeline

Four jobs, `build` -> `scan` + `smoke` -> `publish`:

| Job | Triggers | Steps |
| --- | --- | --- |
| `build` | PR + push to main | `docker compose config`, `docker compose build` |
| `scan` | after `build` | Trivy on both images (`severity: CRITICAL,HIGH`, `exit-code: 1`, `ignore-unfixed: true`) |
| `smoke` | after `build` | `docker compose up -d`, wait for `/health`, then curl: frontend serves, login, list, create, resolve, delete; `docker compose down -v` cleanup |
| `publish` | after `scan` + `smoke`, push to main only | login to Docker Hub, build, tag `latest` + `sha-<commit>`, push both images |

## Files

- `.github/workflows/ci.yml` — the pipeline.
- This design document.

## Verification

- Push to `main` and observe the workflow in the GitHub Actions tab.
- Confirm `ahmed63/devops-incident-management-backend` and
  `ahmed63/devops-incident-management-frontend` on hub.docker.com receive
  `latest` and `sha-...` tags.

## Follow-ups (not implemented)

- SHA-pin third-party actions for maximum supply-chain hardening.
- Add a note in the README pointing at the published images.
