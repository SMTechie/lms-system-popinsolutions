# DevSecOps CI/CD Orchestration (Free, GitHub-Only)

These are reference templates for a separate multi-service installation. The current LMS is one Next.js application. Use `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `infra/docker-compose.prod.yml` and `infra/deploy.sh` for this repository. The templates below are not the active deployment configuration.

This package provides a secure, reusable CI/CD system using GitHub Actions, self-hosted runners, GHCR, and open-source security tooling.

**Key rules enforced**
- PR workflows run on GitHub-hosted runners only.
- Self-hosted runners run only on push to `main`, git tags, or `workflow_dispatch`.
- Builds fail on HIGH or CRITICAL vulnerabilities.
- Every image is signed with Cosign keyless.
- Deployments use only immutable tags `sha-<commit>`.

## Folder Structure
- `cicd/templates/.github/workflows`
- `cicd/examples/service-repo/.github/workflows`
- `cicd/orchestrator`

## Reusable Workflows (Template Repo)
Create a central repository in your GitHub org (example: `cicd-templates`) and place:
- `cicd/templates/.github/workflows/reusable-pr.yml`
- `cicd/templates/.github/workflows/reusable-build.yml`

## Example Service Repo Workflows
Use the example workflows as reference:
- `cicd/examples/service-repo/.github/workflows/ci-pr.yml`
- `cicd/examples/service-repo/.github/workflows/ci-build.yml`

These workflows call the reusable templates from the template repo.

## Orchestrator Repo
Create `popin-orchestrator` and copy:
- `cicd/orchestrator/.github/workflows/deploy.yml`
- `cicd/orchestrator/release-manifest.json`
- `cicd/orchestrator/deploy/docker-compose.yml`
- `cicd/orchestrator/scripts/*.sh`

The orchestrator controls production releases using the `release-manifest.json` file.

## Runner Registration
Install GitHub self-hosted runners on two separate machines:

BuildVM runners
- Names: `buildvm-runner-01`, `buildvm-runner-02`, `buildvm-runner-03`
- Labels: `self-hosted`, `linux`, `buildvm`, `docker`, `build`

LiveVM runner
- Name: `livevm-runner-01`
- Labels: `self-hosted`, `linux`, `livevm`, `docker`, `deploy`

Never allow BuildVM to deploy or LiveVM to build.

## Hybrid Versioning
Every build produces:
- Immutable: `sha-<commit>`
- Semver: `vMAJOR.MINOR.PATCH`
- Optional: `latest` for humans only

Only `sha-<commit>` is valid for production deployments.

## Semantic Version Auto-Increment
The build workflow determines the next version using commit messages:
- `BREAKING` -> MAJOR
- `feat:` -> MINOR
- `fix:` -> PATCH

The workflow creates a git tag for the new semver.

## Security Tooling
- Trivy container scans (fail on HIGH,CRITICAL)
- Trivy report artifacts (table + SARIF)
- Gitleaks secrets scan on PR
- Syft SBOM generation (SPDX JSON)
- Dependency Review Action on PR
- Cosign keyless signing

## Deployment Schedule
Deployments run on:
- `workflow_dispatch`
- nightly schedule `0 2 * * *` (02:00 UTC)

Only one deployment runs at a time:
- `concurrency: production-deploy`

## Release Manifest Rules
Only SHA tags are allowed in `release-manifest.json`:
```
{
  "api": "sha-3f1c8a4",
  "web": "sha-b7d21fa",
  "worker": "sha-9f2c12a"
}
```

The deploy workflow validates this rule and fails if any tag is mutable.

## Rollback Behavior
`release-manifest.previous.json` should contain the last known good release.
If smoke tests fail, the deployment workflow runs `scripts/rollback.sh` to redeploy the previous manifest.

## Required Secrets
- `GITHUB_TOKEN` (built-in)
- No paid services or external secrets required

## Notes
- PR workflows must never run on self-hosted runners.
- LiveVM verifies Cosign signatures before running images.
- BuildVM only builds, scans, signs, and pushes.
