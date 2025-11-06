# GitHub Actions Workflows

This directory contains the CI/CD workflows for ZeroDrive.

## Workflows

### 1. CI Workflow (`ci.yml`)
**Triggers:** Push to `main` or `feat/*` branches, Pull Requests to `main`

**What it does:**
- **Backend:**
  - Installs dependencies
  - Runs ESLint
  - Performs TypeScript type checking
  - Runs Jest tests with coverage
  - Builds the application
  - Uploads build artifacts

- **Frontend:**
  - Installs dependencies
  - Runs Jest tests
  - Builds the React application
  - Uploads build artifacts

**Status:** Both backend and frontend run in parallel for speed.

### 2. Code Coverage Workflow (`coverage.yml`)
**Triggers:** Pull Requests to `main`

**What it does:**
- Generates code coverage reports for both backend and frontend
- Posts coverage summary as a PR comment
- Checks against coverage thresholds (70% for backend)
- Uploads coverage artifacts

**Note:** Coverage results will appear in PR comments automatically.

### 3. Dependency Check Workflow (`dependency-check.yml`)
**Triggers:** Weekly (Mondays at 9 AM UTC), Manual dispatch

**What it does:**
- Runs `npm audit` on backend and frontend
- Checks for security vulnerabilities
- Lists outdated packages
- Creates GitHub issues for high/critical vulnerabilities
- Posts summary to workflow runs

**Security:** Automatically creates issues when vulnerabilities are found.

## Dependabot Configuration

File: `.github/dependabot.yml`

**What it does:**
- Automatically creates PRs for dependency updates
- Runs weekly for npm packages (Monday at 9 AM)
- Runs monthly for GitHub Actions
- Limits to 5 open PRs per ecosystem
- Auto-assigns PRs to maintainers

## Status Badges

Add these badges to your README.md:

```markdown
[![CI](https://github.com/shahadpichen/zerodrive/actions/workflows/ci.yml/badge.svg)](https://github.com/shahadpichen/zerodrive/actions/workflows/ci.yml)
[![Code Coverage](https://github.com/shahadpichen/zerodrive/actions/workflows/coverage.yml/badge.svg)](https://github.com/shahadpichen/zerodrive/actions/workflows/coverage.yml)
[![Dependency Check](https://github.com/shahadpichen/zerodrive/actions/workflows/dependency-check.yml/badge.svg)](https://github.com/shahadpichen/zerodrive/actions/workflows/dependency-check.yml)
```

## Local Testing

Before pushing, you can test locally:

**Backend:**
```bash
cd backend
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

**Frontend:**
```bash
cd app
npm install
CI=true npm test
npm run build
```

## Workflow Permissions

The workflows use the following GitHub Actions permissions:
- `actions/checkout@v4` - Read repository
- `actions/setup-node@v4` - Setup Node.js environment
- `actions/upload-artifact@v4` - Upload build artifacts
- `actions/github-script@v7` - Create issues and comments (requires `write` permission)

## Environment Variables

**Frontend Build:**
- `REACT_APP_API_URL` - Set to `http://localhost:3001` in CI
- `CI=true` - Ensures non-interactive test runs

**Note:** Add any secrets (API keys, tokens) via Repository Settings > Secrets and variables > Actions.

## Customization

### Changing Node Version
Edit the `matrix.node-version` in each workflow:
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]  # Add multiple versions
```

### Changing Coverage Thresholds
Edit `backend/jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    statements: 70,
    branches: 65,
    functions: 70,
    lines: 70,
  },
}
```

### Enabling Branch Protection
1. Go to Repository Settings > Branches
2. Add rule for `main` branch
3. Require status checks: `Backend CI`, `Frontend CI`
4. Enable "Require branches to be up to date"

## Troubleshooting

### Workflow Fails on Lint
Run locally:
```bash
cd backend
npm run lint:fix
```

### Tests Fail in CI but Pass Locally
Ensure `CI=true` is set:
```bash
CI=true npm test
```

### Coverage Below Threshold
Check coverage locally:
```bash
npm test -- --coverage
```

## Manual Workflow Triggers

Dependency Check can be triggered manually:
1. Go to Actions tab
2. Select "Dependency Check" workflow
3. Click "Run workflow"
4. Select branch and run

## Next Steps

- [ ] Add deployment workflows (production, staging)
- [ ] Set up container builds (Docker)
- [ ] Add end-to-end tests
- [ ] Configure secrets for external services
- [ ] Set up branch protection rules
