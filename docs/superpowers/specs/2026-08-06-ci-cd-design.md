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

Five jobs, `build` -> `scan` + `quality` + `smoke` -> `publish`:

| Job | Triggers | Steps |
| --- | --- | --- |
| `build` | PR + push to main | `docker compose config`, `docker compose build` |
| `scan` | after `build` | Trivy on both images (`severity: CRITICAL,HIGH`, `exit-code: 1`, `ignore-unfixed: true`) |
| `quality` | after `build` | SonarQube Cloud analysis via `SonarSource/sonarqube-scan-action@v8.2.0` (`SONAR_TOKEN` + `GITHUB_TOKEN`); report-only, does not gate `publish` |
| `smoke` | after `build` | `docker compose up -d`, wait for `/health`, then curl: frontend serves, login, list, create, resolve, delete; `docker compose down -v` cleanup |
| `publish` | after `scan` + `smoke`, push to main only | login to Docker Hub, build, tag `latest` + `sha-<commit>`, push both images |

### SonarQube Cloud (added 2026-08-06)

- Hosted on SonarCloud (no Docker image; the SonarQube Docker image is only
  relevant for self-hosting).
- One combined project analyzing `backend/src` and `frontend/src`.
- Config in `sonar-project.properties` (org/project keys are placeholders to
  be filled from the SonarCloud onboarding wizard).
- Static analysis only — no test coverage yet (no test suite exists).
- Quality gate is report-only (PR decoration + dashboard); it does not block
  `publish`.
- Uses `SonarSource/sonarqube-scan-action@v8.2.0`: the old
  `sonarcloud-github-action` is archived; v8 GPG-verifies the scanner download.
- Requires one-time setup: create the project in SonarCloud, add the
  `SONAR_TOKEN` repo secret, authorize the SonarQube Cloud GitHub App.
- **Setup prerequisite (found 2026-08-07):** disable **Automatic Analysis** on
  the project (Administration -> Analysis Method). SonarQube Cloud rejects CI
  analysis with `ERROR You are running CI analysis while Automatic Analysis is
  enabled` (scanner exit code 3) until it is turned off.

## Files

- `.github/workflows/ci.yml` — the pipeline.
- This design document.

## Verification

- Push to `main` and observe the workflow in the GitHub Actions tab.
- Confirm `ahmed63/devops-incident-management-backend` and
  `ahmed63/devops-incident-management-frontend` on hub.docker.com receive
  `latest` and `sha-...` tags.

## Follow-ups (not implemented)

- Add a note in the README pointing at the published images.

## Action pinning (2026-08-06)

All third-party actions in `ci.yml` are pinned to full commit SHAs
(sonarqube-scan-action@713881670b6b3676cda39549040e2d88c70d582e triggered the
finding; the same rule applies to every `uses:` line, so all were pinned):

| Action | SHA | Release |
| --- | --- | --- |
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
| `aquasecurity/trivy-action` | `ed142fd0673e97e23eac54620cfb913e5ce36c25` | v0.36.0 |
| `SonarSource/sonarqube-scan-action` | `713881670b6b3676cda39549040e2d88c70d582e` | v8.2.0 |
| `docker/login-action` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | v3.7.0 |

The release tag is kept as a trailing `# vX.Y.Z` comment for reviewability.

## First-run hardening (2026-08-06)

Trivy initially failed on both images; root causes and fixes:

| Image | Finding | Fix |
| --- | --- | --- |
| backend | CRITICAL `tar` CVE-2026-59873 + 8 HIGH, all in npm bundled in `node:22-alpine` | Removed global npm from the runtime image and switched `CMD` from `npm start` to `node src/server.js` (npm is unused at runtime) |
| backend | HIGH `path-to-regexp` CVE-2026-4867 (0.1.12) | Upgraded express 4.21.2 -> 4.22.2 (pins `~0.1.12`, allowing 0.1.13) and re-resolved the lockfile to `path-to-regexp@0.1.13` |
| frontend | 2 CRITICAL (`libcrypto3`/`libssl3` CVE-2026-31789) + 33 HIGH, stale alpine packages | Added `apk upgrade --no-cache` in the nginx runtime stage |

Both images now scan clean at CRITICAL/HIGH severity (`ignore-unfixed`), and the
full-stack smoke test passes on the rebuilt images.
