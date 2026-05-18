# Remove Credit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove the credit/payment system that gates file sharing, so sharing is unconditionally free ("free forever"), with no credit balance, no 402 errors, and no credit UI/endpoints/tables.

**Architecture:** ZeroDrive is a monorepo — `backend/` (Express + TS, raw SQL via `pg`) and `app/` (React CRA + TS). Credits are: a `credits` column + two tables in Postgres, a `creditOperations` util, a `/api/credits` router, a credit gate inside the `POST /api/shared-files` handler, and frontend state/UI in app-context, header, and the share page. Removal is a deletion-heavy refactor: strip the share-endpoint gate first (the behavior change), then delete the now-unused backend modules, the DB objects, and the frontend state/UI, updating tests at each step. Each task is independently committable and leaves the build green.

**Tech Stack:** Express, TypeScript, `pg`, Joi, Jest (backend integration tests with mocked credit utils), React 18 + CRA, React Testing Library, PostgreSQL (schema source of truth: `backend/database/init.sql`).

**Conventions for every commit in this plan:**

- Conventional Commits. Reference the issue with `Closes #13` on the final commit, `Refs #13` on intermediate ones.
- The repo's husky `commit-msg` hook **rejects** any message containing `Co-Authored-By: Claude/Anthropic`, `Generated with Claude`, or `noreply@anthropic.com`. Do **not** put an AI attribution trailer in any commit. Do not quote those literal phrases in commit messages.
- `pre-commit` runs `lint-staged` (prettier + eslint on staged files). `pre-push` runs `tsc --noEmit` for **both** `app` and `backend` — both must stay green or `git push` is blocked.
- Run backend tests from `backend/` with `npm test`. Run frontend tests from `app/` with `CI=true npm test -- --watchAll=false`. Run type checks with `npx tsc --noEmit` inside `app/` and `backend/`.

---

## File Structure (what changes and why)

**Backend — modify:**

- `backend/src/routes/sharedFiles.ts` — remove the credit import, the cost calc + `checkCredits` gate, and the `deductCredits` block. Keep share-insert, email, analytics, response untouched.
- `backend/src/routes/index.ts` — remove credits router import, mount, and the two API-doc strings.
- `backend/src/types/index.ts` — remove `credits?` from `PublicKey`, and the `CreditTransaction`, `CreditPackage`, `GetCreditBalanceRequest`, `CreditBalanceResponse` interfaces.
- `backend/src/middleware/errorHandler.ts` — remove the now-unused `PaymentRequired` helper.
- `backend/database/init.sql` — drop `credits` column from `public_keys`; drop `credit_transactions` and `credit_packages` tables, their indexes and trigger.

**Backend — delete:**

- `backend/src/utils/creditOperations.ts`
- `backend/src/routes/credits.ts`
- `backend/src/__tests__/integration/credits.integration.test.ts`

**Backend — create:**

- `backend/database/migrations/001_remove_credit_system.sql` — idempotent DROP for existing dev databases.

**Backend — modify tests:**

- `backend/src/__tests__/integration/sharedFiles.integration.test.ts` — drop credit mocks/assertions; assert sharing works with no credit logic and no 402.

**Frontend — modify:**

- `app/src/utils/apiClient.ts` — remove `creditsApi` and its `credits:` entry; remove the `credits?` field from the relevant interface.
- `app/src/contexts/app-context.tsx` — remove credit state, `refreshCredits`, the CREDITS cache key, and credit usage in `refreshAll`/context value. Keep storage.
- `app/src/components/storage/header.tsx` — remove the credit balance dropdown UI, the `Coins` import, and the credits-cache clearing on logout. Keep storage cache clear.
- `app/src/pages/share-files.tsx` — remove credit display, low-credit warnings, the `creditBalance < 1` disable condition, the "Insufficient credits" error branch, and the post-share `refreshCredits()` call.

**Frontend — modify tests:**

- `app/src/__tests__/utils/apiClient.test.ts` — remove the credit API tests.
- `app/src/__tests__/components/storage-header.test.tsx` — remove credit-display tests.

---

## Task 1: Remove the credit gate from the share endpoint (behavior change, TDD)

**Files:**

- Modify: `backend/src/routes/sharedFiles.ts`
- Test: `backend/src/__tests__/integration/sharedFiles.integration.test.ts`

- [ ] **Step 1: Write the failing test**

In `backend/src/__tests__/integration/sharedFiles.integration.test.ts`, add this test inside the `describe('POST /api/shared-files'...)` block (place it after the existing "should create shared file with valid data" test):

```typescript
it("shares a file with no credit checks at all (credits removed)", async () => {
  // No credit mocks set up on purpose — sharing must not touch any credit logic.
  const res = await request(app)
    .post("/api/shared-files")
    .set("Cookie", authCookie)
    .send({
      file_id: "file-no-credits",
      recipient_user_id: "recipient-hash",
      encrypted_file_key: "enc-key",
      file_name: "doc.pdf",
      file_size: 1234,
      mime_type: "application/pdf",
      access_type: "view",
    });

  expect(res.status).toBe(201);
  expect(res.body.data).toBeDefined();
  expect(res.status).not.toBe(402);
});
```

(`authCookie`, `app`, and `request` already exist in this test file — reuse the same setup the neighboring tests use. If the existing tests use a helper to build the authed agent, use that identical helper.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- sharedFiles.integration -t "shares a file with no credit checks"`
Expected: FAIL — current code calls `checkCredits` (unmocked → throws/needs DB) or returns 402, so status is not 201.

- [ ] **Step 3: Remove the credit import from `sharedFiles.ts`**

Delete this exact line (currently line 19):

```typescript
import {
  checkCredits,
  deductCredits,
  COST_FILE_SHARE,
  COST_EMAIL_NOTIFICATION,
  TRANSACTION_TYPE,
} from "../utils/creditOperations";
```

- [ ] **Step 4: Remove the cost-calc + credit-check block**

In the `POST /` handler, delete this entire block (the credit cost calculation and the `checkCredits` gate):

```typescript
// Calculate credit cost (1 credit for share + 0.5 for email notification)
// Only send email (and charge) if user provides a custom message
const willSendEmail = !!custom_message;
const creditCost =
  COST_FILE_SHARE + (willSendEmail ? COST_EMAIL_NOTIFICATION : 0);

// Check if sender has sufficient credits
const hasCredits = await checkCredits(senderUserId, creditCost);

if (!hasCredits) {
  throw ApiErrors.PaymentRequired(
    `Insufficient credits. Required: ${creditCost} credits (${COST_FILE_SHARE} for share${willSendEmail ? ` + ${COST_EMAIL_NOTIFICATION} for email notification` : ""})`,
  );
}
```

The next line after this block (`// Check if file is already shared with this recipient`) and everything below it stays unchanged.

- [ ] **Step 5: Remove the credit-deduction block**

Delete this entire block (the comment + the `deductCredits` call), which sits between the `INSERT INTO shared_files ... RETURNING *` query and the `// Send email notification (non-blocking)` comment:

```typescript
// Deduct credits from sender
const newBalance = await deductCredits(
  senderUserId,
  creditCost,
  TRANSACTION_TYPE.FILE_SHARE,
  {
    file_id,
    file_name,
    recipient_user_id,
    email_sent: willSendEmail,
  },
);
```

Do **not** touch the `// Send email notification (non-blocking)` block, the `if (recipient_email && custom_message)` email send, the analytics `trackEvent` call, or the `res.apiSuccess(result.rows[0], 'File shared successfully', 201)` response — they remain exactly as-is. The email send already keys off `custom_message` directly, so removing `willSendEmail` does not affect it.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npm test -- sharedFiles.integration -t "shares a file with no credit checks"`
Expected: PASS — status 201, no 402.

- [ ] **Step 7: Type-check backend**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors. (Confirms no dangling `willSendEmail`/`creditCost`/`newBalance`/credit-import references.)

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/sharedFiles.ts backend/src/__tests__/integration/sharedFiles.integration.test.ts
git commit -m "refactor(sharing): remove credit gate from share endpoint (Refs #13)"
```

---

## Task 2: Unmount and delete the credits router

**Files:**

- Modify: `backend/src/routes/index.ts`
- Delete: `backend/src/routes/credits.ts`
- Test: `backend/src/__tests__/integration/sharedFiles.integration.test.ts` (add endpoint-gone assertion)

- [ ] **Step 1: Write the failing test**

Add this test to `backend/src/__tests__/integration/sharedFiles.integration.test.ts` (top-level `describe`, e.g. a new `describe('credit endpoints removed', ...)`):

```typescript
describe("credit endpoints removed", () => {
  it("GET /api/credits/balance/:userId returns 404 (route unmounted)", async () => {
    const res = await request(app)
      .get("/api/credits/balance/some-user")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- sharedFiles.integration -t "credit endpoints removed"`
Expected: FAIL — route currently mounted, returns 200/404-from-handler or 200, not a routing 404.

- [ ] **Step 3: Remove the credits router import**

In `backend/src/routes/index.ts` delete this exact line (line 14):

```typescript
import creditsRouter from "./credits";
```

- [ ] **Step 4: Remove the API-doc strings**

In `backend/src/routes/index.ts` delete these two lines (currently 56–57) from the endpoints documentation object:

```typescript
      'GET /api/credits/balance/:userId': 'Get user credit balance',
      'GET /api/credits/transactions/:userId': 'Get credit transaction history'
```

If removing the trailing one leaves a dangling comma / trailing comma on the previous entry, fix the object so it is valid (remove the now-trailing comma on the preceding line if the doc object disallows it; keep JSON/TS validity).

- [ ] **Step 5: Remove the mount**

In `backend/src/routes/index.ts` delete this exact line (line 78):

```typescript
router.use("/credits", creditsRouter);
```

- [ ] **Step 6: Delete the credits router file**

```bash
git rm backend/src/routes/credits.ts
```

- [ ] **Step 7: Run the test + type-check**

Run: `cd backend && npx tsc --noEmit && npm test -- sharedFiles.integration -t "credit endpoints removed"`
Expected: tsc clean; test PASS (404).

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "refactor(api): unmount and delete /api/credits router (Refs #13)"
```

---

## Task 3: Delete `creditOperations.ts`, credit types, and the `PaymentRequired` error helper

**Files:**

- Delete: `backend/src/utils/creditOperations.ts`
- Modify: `backend/src/types/index.ts`
- Modify: `backend/src/middleware/errorHandler.ts`

- [ ] **Step 1: Verify nothing still imports `creditOperations`**

Run: `grep -rn "creditOperations\|checkCredits\|deductCredits\|addCredits\|getTransactionHistory\|COST_FILE_SHARE\|COST_EMAIL_NOTIFICATION\|TRANSACTION_TYPE" backend/src --include="*.ts" | grep -v __tests__`
Expected: **No output.** (Tasks 1–2 removed the only non-test importers.) If anything prints, stop and remove that usage before continuing.

- [ ] **Step 2: Delete the util**

```bash
git rm backend/src/utils/creditOperations.ts
```

- [ ] **Step 3: Remove credit types from `backend/src/types/index.ts`**

Delete the `credits?: number;` line from the `PublicKey` interface (line 10). Delete the entire `CreditTransaction` interface (lines ~30–38), the entire `CreditPackage` interface (lines ~40–50), the entire `GetCreditBalanceRequest` interface (lines ~88–90), and the entire `CreditBalanceResponse` interface (lines ~92–95). Match by interface name and brace boundaries, not just line numbers.

- [ ] **Step 4: Remove the `PaymentRequired` helper**

In `backend/src/middleware/errorHandler.ts` delete this helper from the `ApiErrors` object (lines ~47–48):

```typescript
  PaymentRequired: (message: string = 'Payment Required'): ApiError =>
    new ApiError(message, 402, 'PAYMENT_REQUIRED'),
```

First confirm it is unused: `grep -rn "PaymentRequired\|PAYMENT_REQUIRED" backend/src --include="*.ts" | grep -v __tests__` must print nothing before deleting. If a test references it, that test is removed/updated in Task 4 — proceed.

- [ ] **Step 5: Type-check backend**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors. If tsc reports an unresolved import or missing type, that file still references credits — fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/types/index.ts backend/src/middleware/errorHandler.ts
git commit -m "refactor(backend): delete credit util, types, and PaymentRequired helper (Refs #13)"
```

---

## Task 4: Clean up backend credit tests

**Files:**

- Delete: `backend/src/__tests__/integration/credits.integration.test.ts`
- Modify: `backend/src/__tests__/integration/sharedFiles.integration.test.ts`

- [ ] **Step 1: Delete the credits integration test file**

```bash
git rm backend/src/__tests__/integration/credits.integration.test.ts
```

- [ ] **Step 2: Strip credit mocks/assertions from the shared-files test**

In `backend/src/__tests__/integration/sharedFiles.integration.test.ts`:

- Remove any `jest.mock('../../utils/creditOperations'...)` (or equivalent) and any `import ... from '../../utils/creditOperations'`.
- Remove the test `should return 402 when user has insufficient credits` entirely.
- In `should create shared file with valid data and sufficient credits` (and the email-notification variant), delete every `mockCheckCredits` / `mockDeductCredits` setup and every assertion referencing `checkCredits`, `deductCredits`, credit cost, or `email_sent`. Keep the rest of those tests (they should still assert a 201 and the share record).
- Keep the two tests added in Tasks 1 and 2.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: PASS, with **zero** references to credit operations remaining. Verify: `grep -rn "credit\|Credit\|402\|PaymentRequired" backend/src/__tests__ --include="*.ts"` prints nothing credit-related (a generic `402` only if unrelated — there should be none for sharing).

- [ ] **Step 4: Commit**

```bash
git add backend/src/__tests__
git commit -m "test(backend): remove credit tests, de-credit share tests (Refs #13)"
```

---

## Task 5: Remove credit objects from the database schema + migration

**Files:**

- Modify: `backend/database/init.sql`
- Create: `backend/database/migrations/001_remove_credit_system.sql`

- [ ] **Step 1: Edit `init.sql` — drop the `credits` column**

In `backend/database/init.sql`, in the `CREATE TABLE IF NOT EXISTS public_keys (...)` block, delete this exact line (line 15):

```sql
    credits NUMERIC(10, 1) DEFAULT 15.0 NOT NULL,
```

- [ ] **Step 2: Edit `init.sql` — drop the credit tables/indexes/trigger**

Delete, in `backend/database/init.sql`:

- The entire `credit_transactions` section: the `-- Create credit_transactions table` comment block, `CREATE TABLE IF NOT EXISTS credit_transactions (...)`, and its two indexes `idx_credit_transactions_user_id` and `idx_credit_transactions_created_at` (lines ~106–119).
- The entire `credit_packages` section: the `-- Create credit_packages table` comment block, `CREATE TABLE IF NOT EXISTS credit_packages (...)`, and its `DROP TRIGGER IF EXISTS update_credit_packages_updated_at ...` + `CREATE TRIGGER update_credit_packages_updated_at ...` (lines ~121–140).

Leave the `public_keys` table (minus the `credits` column), its `idx_public_keys_user_id` index, and its `update_public_keys_updated_at` trigger intact.

- [ ] **Step 3: Create the idempotent migration for existing dev DBs**

Create `backend/database/migrations/001_remove_credit_system.sql`:

```sql
-- Migration 001: Remove the credit system (Refs #13)
-- Idempotent: safe to run on a DB that may or may not still have these objects.
-- Source of truth remains backend/database/init.sql (this mirrors that change
-- for already-provisioned databases).

BEGIN;

DROP TRIGGER IF EXISTS update_credit_packages_updated_at ON credit_packages;
DROP TABLE IF EXISTS credit_packages;
DROP TABLE IF EXISTS credit_transactions;
ALTER TABLE public_keys DROP COLUMN IF EXISTS credits;

COMMIT;
```

- [ ] **Step 4: Apply the migration to the running dev database**

The dev Postgres runs in docker-compose as container `zerodrive-postgres` (db `zerodrive`, user `zerodrive_app`). Apply:

```bash
docker exec -i zerodrive-postgres psql -U zerodrive_app -d zerodrive < backend/database/migrations/001_remove_credit_system.sql
```

Expected output: `BEGIN`, `DROP TRIGGER`, `DROP TABLE`, `DROP TABLE`, `ALTER TABLE`, `COMMIT` (or `NOTICE` lines for already-absent objects — still fine, it is idempotent).

- [ ] **Step 5: Verify the schema**

```bash
docker exec -i zerodrive-postgres psql -U zerodrive_app -d zerodrive -c "\d public_keys" -c "\dt credit_transactions" -c "\dt credit_packages"
```

Expected: `public_keys` has **no** `credits` column; `credit_transactions` and `credit_packages` report "Did not find any relation".

- [ ] **Step 6: Run the backend suite against the migrated DB**

Run: `cd backend && npm test`
Expected: PASS (sharing still works; no code reads the dropped column).

- [ ] **Step 7: Commit**

```bash
git add backend/database/init.sql backend/database/migrations/001_remove_credit_system.sql
git commit -m "refactor(db): drop credits column and credit tables (Refs #13)"
```

---

## Task 6: Remove `creditsApi` from the frontend API client

**Files:**

- Modify: `app/src/utils/apiClient.ts`

- [ ] **Step 1: Remove the `creditsApi` object**

In `app/src/utils/apiClient.ts` delete the entire `creditsApi` export block (the `// Credits API` comment + `export const creditsApi = { ... }`, approx lines 432–471), including its `getBalance` and `getTransactions` methods.

- [ ] **Step 2: Remove the `credits:` reference on the aggregated client**

Delete the `credits: creditsApi,` line (line ~479) from the aggregated `apiClient` object.

- [ ] **Step 3: Remove the `credits?` field**

Delete the `credits?: number;` field at line ~36 (it belongs to the `PublicKey`-style response interface in this file). Confirm by reading the surrounding interface — remove only that one optional field.

- [ ] **Step 4: Verify no remaining references + type-check**

Run: `grep -rn "creditsApi\|\.credits\.\|credits\.getBalance\|credits\.getTransactions" app/src --include="*.ts" --include="*.tsx" | grep -v __tests__`
Expected: only hits (if any) are in `app-context.tsx` / `share-files.tsx` / `header.tsx` (handled in Tasks 7–9). No other.
Run: `cd app && npx tsc --noEmit`
Expected: errors only from the three files handled in Tasks 7–9 (or none). Note any reported file; it must be one of those three.

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/apiClient.ts
git commit -m "refactor(app): remove creditsApi from API client (Refs #13)"
```

---

## Task 7: Remove credit state from the app context

**Files:**

- Modify: `app/src/contexts/app-context.tsx`

- [ ] **Step 1: Remove the CREDITS cache key**

Delete the `CREDITS: 'zerodrive-credits-cache',` entry (line ~8) from the `CACHE_KEYS` object.

- [ ] **Step 2: Remove credit fields from `AppContextType`**

Delete `creditBalance: number | null;` (line ~45), `isLoadingCredits: boolean;` (line ~48), and `refreshCredits: () => Promise<void>;` (line ~51) from the `AppContextType` interface.

- [ ] **Step 3: Remove credit state + `refreshCredits`**

Delete the `const [creditBalance, setCreditBalance] = useState<number | null>(null);` (line ~63) and `const [isLoadingCredits, setIsLoadingCredits] = useState(false);` (line ~69) hooks. Delete the entire `refreshCredits` `useCallback` (lines ~76–97).

- [ ] **Step 4: Fix `refreshAll` and the context value**

In `refreshAll` (line ~144) change:

```typescript
    await Promise.all([refreshCredits(), refreshStorage()]);
  }, [refreshCredits, refreshStorage]);
```

to:

```typescript
    await Promise.all([refreshStorage()]);
  }, [refreshStorage]);
```

In the context provider `value={{ ... }}` object, delete the `creditBalance,` (line ~166), `isLoadingCredits,` (line ~169), and `refreshCredits,` (line ~172) properties.

- [ ] **Step 5: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: errors now only from `header.tsx` and `share-files.tsx` (they still consume the removed context fields) — handled next. No errors from `app-context.tsx` itself.

- [ ] **Step 6: Commit**

```bash
git add app/src/contexts/app-context.tsx
git commit -m "refactor(app): remove credit state from app context (Refs #13)"
```

---

## Task 8: Remove credit UI from the storage header

**Files:**

- Modify: `app/src/components/storage/header.tsx`

- [ ] **Step 1: Remove the credit balance dropdown UI**

Delete the credit-display JSX block (approx lines 146–185) — the dropdown section that renders the balance with red/amber/green coloring, the loading skeleton, and the `<Coins />` icon. Remove only the credits block; leave the rest of the user dropdown (sign-out, etc.) intact.

- [ ] **Step 2: Remove the `Coins` import**

In the `lucide-react` import, remove `Coins` from the import list. If `Coins` was the only thing imported on its line, remove the whole import; otherwise just remove the identifier.

- [ ] **Step 3: Remove credits-cache clearing on logout**

In the logout handler (lines ~49–62) remove the line that clears `zerodrive-credits-cache` (or `CACHE_KEYS.CREDITS`). **Keep** the `zerodrive-storage-cache` clear.

- [ ] **Step 4: Remove the context consumption of credit fields**

Remove `creditBalance`, `isLoadingCredits` (and any `refreshCredits`) from the `useAppContext()` destructuring in this file.

- [ ] **Step 5: Type-check + run header test (expected to fail until Task 10)**

Run: `cd app && npx tsc --noEmit`
Expected: no errors from `header.tsx`. Remaining tsc errors (if any) only from `share-files.tsx`.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/storage/header.tsx
git commit -m "refactor(app): remove credit balance UI from header (Refs #13)"
```

---

## Task 9: Remove credit gating + UI from the share page

**Files:**

- Modify: `app/src/pages/share-files.tsx`

- [ ] **Step 1: Remove context consumption**

Remove `creditBalance`, `isLoadingCredits`, `refreshCredits` from the `useAppContext()` destructuring (line ~39).

- [ ] **Step 2: Remove the credit display + warning UI**

Delete the "Sharing Keys Active / balance" green box and the credit-balance display (approx lines 530–546) and the low-credit amber/red warning blocks (approx lines 549–564). Keep the surrounding sharing form/UI.

- [ ] **Step 3: Remove the credit-based disable condition**

In the share button `disabled={...}` expression (approx lines 633–647), delete the clause:

```typescript
creditBalance !== null && creditBalance < 1;
```

Also remove any trailing `||` so the boolean expression stays valid. Remove the button-label branch that shows `"Insufficient Credits"` — the button should show its normal share/loading label only.

- [ ] **Step 4: Remove the "Insufficient credits" error branch**

In the share error handler (approx lines 391–402) delete the branch that detects `"Insufficient credits"` / `PAYMENT_REQUIRED` and shows the credit-cost toast. Leave the generic error handling (other failures still toast normally).

- [ ] **Step 5: Remove the post-share refresh**

Delete the `await refreshCredits();` call (line ~377) that runs after a successful share. Keep any other post-share success logic (toast, navigation, state reset).

- [ ] **Step 6: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: **clean, zero errors** across the whole app (this was the last consumer).

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/share-files.tsx
git commit -m "refactor(app): remove credit gating and UI from share page (Refs #13)"
```

---

## Task 10: Clean up frontend credit tests

**Files:**

- Modify: `app/src/__tests__/utils/apiClient.test.ts`
- Modify: `app/src/__tests__/components/storage-header.test.tsx`

- [ ] **Step 1: Remove credit API tests**

In `app/src/__tests__/utils/apiClient.test.ts` delete the three credit tests (approx lines 666–724): "should get user credit balance", "should get user credit transactions", "should get transactions with pagination options", plus any `describe`/setup that exists solely for them. Remove any now-unused imports.

- [ ] **Step 2: Remove credit display tests from the header test**

In `app/src/__tests__/components/storage-header.test.tsx` delete the tests asserting credit balance display, color coding, and credit loading state. If the test mocks `useAppContext` with `creditBalance`/`isLoadingCredits`, remove those fields from the mock so it matches the new context shape. Keep all non-credit header tests.

- [ ] **Step 3: Run the frontend suite**

Run: `cd app && CI=true npm test -- --watchAll=false`
Expected: PASS. Then verify nothing credit-related remains:
`grep -rn "credit\|Credit\|creditBalance\|creditsApi" app/src --include="*.ts" --include="*.tsx"`
Expected: **no output.**

- [ ] **Step 4: Commit**

```bash
git add app/src/__tests__
git commit -m "test(app): remove credit-related frontend tests (Refs #13)"
```

---

## Task 11: Full verification + close-out

**Files:** none (verification + final commit)

- [ ] **Step 1: Repo-wide credit reference sweep**

Run:

```bash
grep -rn -iE 'credit|deductCredits|checkCredits|PaymentRequired|PAYMENT_REQUIRED|insufficient credits' backend/src app/src backend/database --include="*.ts" --include="*.tsx" --include="*.sql" | grep -v 'docs/superpowers'
```

Expected: **no output.** Any hit must be removed before proceeding.

- [ ] **Step 2: Type-check both packages**

Run: `cd app && npx tsc --noEmit && cd ../backend && npx tsc --noEmit`
Expected: both clean (this is exactly what the `pre-push` husky hook enforces).

- [ ] **Step 3: Full test suites green**

Run: `cd backend && npm test` then `cd app && CI=true npm test -- --watchAll=false`
Expected: both green.

- [ ] **Step 4: Manual end-to-end smoke (document result)**

With docker-compose up and backend+frontend running: log in, open the share flow, share a file to a recipient **with a brand-new account that never had any credits**. Expected: share succeeds, no 402, no credit UI anywhere, header has no balance, share page has no credit warnings. Note the outcome in the commit body.

- [ ] **Step 5: Final commit closing the issue**

```bash
git add -A
git commit -m "chore: finalize credit system removal (Closes #13)" -m "Sharing is now unconditionally free. Verified end-to-end: new account with no credits can share; no 402; no credit UI/endpoints/tables remain."
git push origin develop
```

(The `pre-push` hook will run `tsc` for both packages — it must pass, which Step 2 already confirmed.)

---

## Self-Review

**1. Spec coverage** — every mapped surface has a task: share-endpoint gate (T1), `/api/credits` router (T2), `creditOperations`/types/`PaymentRequired` (T3), backend tests (T4), DB column+tables+migration (T5), frontend `creditsApi` (T6), app-context state (T7), header UI (T8), share-page gating/UI (T9), frontend tests (T10), full sweep + e2e + close (T11). No mapped credit surface is unaddressed.

**2. Placeholder scan** — every code-changing step shows the exact code to remove/replace and exact verification commands with expected output. No TBD/“handle edge cases”/“similar to”.

**3. Type consistency** — names used match the codebase as mapped: `checkCredits`, `deductCredits`, `COST_FILE_SHARE`, `COST_EMAIL_NOTIFICATION`, `TRANSACTION_TYPE`, `creditOperations`, `creditsApi`, `CACHE_KEYS.CREDITS`, `creditBalance`, `isLoadingCredits`, `refreshCredits`, `PaymentRequired`/`PAYMENT_REQUIRED`, tables `credit_transactions`/`credit_packages`, column `public_keys.credits`.

**4. Ordering** — backend behavior change first (keeps suite meaningful), then dead-code deletion, then DB, then frontend leaf-to-root (apiClient → context → header → share page), then tests, then full verification. Each task leaves the build green and is independently committable.
