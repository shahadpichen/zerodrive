# Contributing to ZeroDrive

Thanks for your interest in contributing. This document describes the branching workflow and what's expected in a PR.

## Branching model

ZeroDrive uses a **two-branch workflow**:

- **`main`** — stable. Every commit on main corresponds to a tagged release (`v1.0.0`, `v1.1.0`, ...). Do not push directly.
- **`develop`** — the default branch. All active work lands here.

All feature, fix, and chore branches are cut from `develop` and merged back into `develop` via pull request. When `develop` reaches a release-worthy state, it is merged into `main` and tagged with a new version.

```
main     ───●──────────────●─────────●────→   (stable / tagged releases)
             ╲            ╱  ╲      ╱
              develop ───●────●────●──────→   (integration / active work)
                          ╲   ╱ ╲
                           feat/* branches
```

## Branch naming

Use one of these prefixes, followed by a short kebab-case description:

| Prefix    | When to use                                    | Example                          |
|-----------|------------------------------------------------|----------------------------------|
| `feat/`   | New feature or user-visible enhancement        | `feat/remove-credits`            |
| `fix/`    | Bug fix                                        | `fix/jwt-expiry-mid-upload`      |
| `chore/`  | Tooling, deps, refactors, no behavior change   | `chore/update-eslint-config`     |
| `docs/`   | Documentation-only changes                     | `docs/add-architecture-diagram`  |
| `test/`   | Test-only changes                              | `test/cover-invitation-flow`     |

## Workflow

```bash
# 1. Make sure your local develop is up to date
git checkout develop
git pull origin develop

# 2. Create your branch
git checkout -b feat/your-feature

# 3. Make commits following the commit conventions below
git add ...
git commit -m "feat: short description"

# 4. Push and open a PR targeting develop
git push -u origin feat/your-feature
gh pr create --base develop

# 5. After merge, delete the branch (GitHub will offer this on merge)
```

## Commit conventions

ZeroDrive uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — a new feature
- `fix:` — a bug fix
- `chore:` — maintenance, tooling, dependency updates
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests
- `docs:` — documentation changes

Keep commit messages concise on the first line (under ~72 chars). Add more detail in the body if the *why* is not obvious.

## Pull requests

- Target `develop`, not `main`
- Fill in the PR template (Summary, Changes, Test Plan)
- Link related issues with `Closes #NN` or `Refs #NN`
- Keep PRs focused — one concern per PR where possible
- Self-review the diff before requesting review from others

## Releases

When `develop` is ready to ship:

```bash
git checkout main
git pull origin main
git merge --no-ff develop -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z: release notes"
git push origin main vX.Y.Z
```

Version numbers follow [Semantic Versioning](https://semver.org/):

- **Major** (`1.x.x` → `2.x.x`) — breaking changes to API, crypto protocol, or user data
- **Minor** (`x.1.x` → `x.2.x`) — new features, backwards compatible
- **Patch** (`x.x.1` → `x.x.2`) — bug fixes only

## Zero-knowledge invariants

ZeroDrive's security model depends on a few invariants that must never be violated:

1. **File content never leaves the browser unencrypted.** All encryption happens client-side before upload. The server must never see plaintext.
2. **Encryption keys never touch the server.** The 12-word mnemonic, derived wrapping key, AES file keys, and RSA private keys all stay on the user's device.
3. **Shared keys are wrapped per-recipient.** A file's AES key is encrypted with the recipient's public key; the server only ever sees the wrapped form.
4. **Metadata is minimized.** The server stores email hashes (salted), file IDs, and share expiry — never file names, file content, or unwrapped keys.

Any PR that could weaken these invariants should be flagged in the PR description and reviewed with extra care.

## Local development

See [`CLAUDE.md`](./CLAUDE.md) at the repo root for the project layout and quick-start commands.

```bash
# Infrastructure
docker-compose up -d

# Backend
cd backend && npm install && npm run dev

# Frontend
cd app && npm install && npm start
```

## Questions

Open an issue or start a discussion on GitHub. Thanks for contributing.
