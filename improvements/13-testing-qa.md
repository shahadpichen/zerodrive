# Testing & Quality Assurance

## Current Issues

- No unit tests
- No integration tests
- No E2E tests
- No CI/CD pipeline
- No error tracking

---

## Improvements

### **P1: Add error tracking (Sentry)**
```typescript
// Install: npm install @sentry/react

// app/src/index.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Wrap app
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</Sentry.ErrorBoundary>
```

**Why:** Know when and why app crashes for users

---

### **P1: Add unit tests**
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

**Test coverage targets:**
- Utilities: 80% coverage
- Components: 60% coverage
- API client: 90% coverage

**Examples:**
```typescript
// cryptoUtils.test.ts
describe('encryptFile', () => {
  it('encrypts file correctly', async () => {
    const file = new File(['test'], 'test.txt');
    const key = await generateKey();
    const encrypted = await encryptFile(file, key);
    expect(encrypted).toBeDefined();
  });

  it('throws error for invalid key', async () => {
    const file = new File(['test'], 'test.txt');
    await expect(encryptFile(file, null)).rejects.toThrow();
  });
});

// apiClient.test.ts
describe('apiClient.sharedFiles', () => {
  it('creates share successfully', async () => {
    const share = await apiClient.sharedFiles.create({
      file_id: '123',
      recipient_user_id: 'user@example.com',
      // ...
    });
    expect(share.id).toBeDefined();
  });

  it('handles 404 errors', async () => {
    await expect(
      apiClient.sharedFiles.getById('nonexistent')
    ).rejects.toThrow('NOT_FOUND');
  });
});
```

---

### **P2: Add integration tests**
```typescript
// Test full user flows
describe('File Upload Flow', () => {
  it('uploads and encrypts file', async () => {
    // Setup
    const user = await createTestUser();
    const key = await generateKey();
    await storeKey(key);

    // Upload
    const file = new File(['test content'], 'test.txt');
    const result = await uploadAndSyncFile(file, user.email);

    // Verify
    expect(result).toBe(true);
    const files = await getAllFilesForUser(user.email);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.txt');
  });
});

describe('File Sharing Flow', () => {
  it('shares file end-to-end', async () => {
    // Create sender and recipient
    const sender = await createTestUser('sender@test.com');
    const recipient = await createTestUser('recipient@test.com');

    // Generate keys
    await generateUserKeyPair(sender.email);
    await generateUserKeyPair(recipient.email);

    // Share file
    const file = new File(['secret'], 'secret.txt');
    const preparation = await prepareFileForSharing(
      file,
      recipient.email,
      sender.email
    );

    // Store share
    const shareId = crypto.randomUUID();
    await storeFileShare(shareId, 'encrypted-share', preparation);

    // Verify recipient can access
    const shares = await findFilesSharedWithRecipient(recipient.email);
    expect(shares).toHaveLength(1);
  });
});
```

---

### **P2: Add E2E tests (Playwright)**
```bash
npm install --save-dev @playwright/test
```

```typescript
// e2e/file-upload.spec.ts
import { test, expect } from '@playwright/test';

test('user can upload and download file', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000');
  await page.click('text=Sign in with Google');
  // ... handle OAuth

  // Generate key
  await page.goto('/key-management');
  await page.click('text=Generate New Key');
  await page.check('text=I have saved this phrase');
  await page.click('text=Continue');

  // Upload file
  await page.goto('/storage');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=Upload Files')
  ]);
  await fileChooser.setFiles('./test-files/document.pdf');

  // Verify upload
  await expect(page.locator('text=document.pdf')).toBeVisible();

  // Download file
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=document.pdf')
  ]);

  expect(download.suggestedFilename()).toBe('document.pdf');
});

test('user can share file', async ({ page, context }) => {
  // Setup two users
  const senderPage = page;
  const recipientPage = await context.newPage();

  // ... setup sender and recipient
  // ... share file
  // ... verify recipient receives notification
  // ... recipient downloads file
});
```

---

### **P1: Setup CI/CD pipeline**
```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies (backend)
        run: cd backend && npm ci

      - name: Run backend tests
        run: cd backend && npm test

      - name: Run backend linter
        run: cd backend && npm run lint

      - name: Install dependencies (frontend)
        run: cd app && npm ci

      - name: Run frontend tests
        run: cd app && npm test -- --coverage

      - name: Run E2E tests
        run: cd app && npx playwright test

      - name: Build frontend
        run: cd app && npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: |
          cd backend && npm audit --audit-level=high
          cd ../app && npm audit --audit-level=high

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy-staging:
    needs: [test, security]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # Deploy commands here

  deploy-production:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deploy commands here
```

---

### **P3: Add test coverage reporting**
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/*.stories.tsx"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 50,
        "functions": 50,
        "lines": 60,
        "statements": 60
      }
    }
  }
}
```

---

### **P3: Add performance testing**
```typescript
// Use Lighthouse CI
npm install --save-dev @lhci/cli

// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
  },
};
```

---

## Files to Create

- `app/src/__tests__/` - Test directory
- `backend/src/__tests__/` - Test directory
- `e2e/` - E2E test directory
- `.github/workflows/ci.yml` - CI/CD config
- `jest.config.js` - Jest configuration
- `playwright.config.ts` - Playwright configuration

---

## Testing Checklist

- [ ] Unit tests pass (>60% coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] CI/CD pipeline runs on PR
- [ ] Deployment automated
- [ ] Error tracking captures issues
- [ ] Security scans find no vulnerabilities
- [ ] Performance tests meet thresholds
- [ ] Tests run in <5 minutes
