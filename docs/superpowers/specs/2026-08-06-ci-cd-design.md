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
  attack; `0.35.0` and newer are safe). The version tag uses the `v` prefix
  (`v0.36.0`).
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

## First-run hardening (2026-08-06)

Trivy initially failed on both images; root causes and fixes:

| Image | Finding | Fix |
| --- | --- | --- |
| backend | CRITICAL `tar` CVE-2026-59873 + 8 HIGH, all in npm bundled in `node:22-alpine` | Removed global npm from the runtime image and switched `CMD` from `npm start` to `node src/server.js` (npm is unused at runtime) |
| backend | HIGH `path-to-regexp` CVE-2026-4867 (0.1.12) | Upgraded express 4.21.2 -> 4.22.2 (pins `~0.1.12`, allowing 0.1.13) and re-resolved the lockfile to `path-to-regexp@0.1.13` |
| frontend | 2 CRITICAL (`libcrypto3`/`libssl3` CVE-2026-31789) + 33 HIGH, stale alpine packages | Added `apk upgrade --no-cache` in the nginx runtime stage |

Both images now scan clean at CRITICAL/HIGH severity (`ignore-unfixed`), and the
full-stack smoke test passes on the rebuilt images.
