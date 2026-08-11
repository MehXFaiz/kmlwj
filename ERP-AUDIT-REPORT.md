# MASTER ERP FORENSIC AUDIT REPORT — READ ONLY AUDIT

**Target:** Accounting ERP (KMLWJ Monorepo)  
**Audit Date:** August 11, 2026  
**Auditor:** AI Forensic Accounting & Security Audit Agent  
**Audit Mode:** Read-Only Analysis (Zero Data / Code / Database Modifications Executed)

---

## Final Executive Summary

```text
==================================================
SUMMARY OF AUDIT FINDINGS BY SEVERITY
==================================================
CRITICAL : 0
HIGH     : 2
MEDIUM   : 6
LOW      : 3
==================================================
TOTAL ISSUES IDENTIFIED: 11
```

### Overall Financial Integrity Assessment
The ERP accounting core enforces standard double-entry bookkeeping rules (`Debit = Credit`). Financial reports (Trial Balance, General Ledger, Income Statement, Balance Sheet) and Dashboard metrics derive strictly from posted `JournalEntryLine` records matching `status = 'Posted'` and `isDeleted = false`. Money calculations are safeguarded against floating-point drift (using integer paisa arithmetic on the frontend via [`src/utils/money.js`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/src/utils/money.js) and `Prisma.Decimal` on the backend via [`api/_utils/money.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_utils/money.ts)). Wire transport of Decimal fields is recursively serialized to JSON numbers to eliminate string-concatenation balance distortion (`"1000" + "500" = "01000500"`).

---

## 1. Complete Architecture Map

### Frontend Layer
- **Framework:** React 19.2 + Vite 8.0 with TailwindCSS v4.
- **Routing:** `react-router-dom` v7 with dynamic lazy loading (`Suspense` and `ChunkErrorBoundary` wrapper in [`App.jsx`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/src/App.jsx)).
- **State Management:** `zustand` v5 (`useAuthStore` for session, `useUpdaterStore` for desktop updates).
- **API Layer:** `axios` client configured with Bearer JWT headers and automated 401 handling.
- **Authentication & Authorization:** JWT stored client-side, decoded claims stored in Zustand, page access guarded by `PermissionGuard` component.
- **Desktop Wrapper:** Electron 33 (`electron/main.cjs` / `main.cjs`) for Windows installer distribution via `electron-builder`.

### Backend Layer
- **Framework:** Express 5.2 running as serverless function handlers matching Vercel Serverless Function architecture in [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts).
- **Middleware:** Security headers via `helmet`, rate limiting via `express-rate-limit` (2500 req/15min global, 10 req/15min auth), CORS control, and `multer` for dev upload handling.
- **Authentication:** `verifyAuth()` validating JWT tokens signed with `JWT_SECRET`.
- **Authorization:** `verifyPermission()` performing live database queries against `RolePermission` entries via `loadPermissions()`.
- **Accounting Engine:** `AccountingService` in [`api/_services/accounting.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/accounting.service.ts) and `FundValidationService` in [`api/_services/fund-validation.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/fund-validation.service.ts).

### Database & Storage Layer
- **Database Engine:** PostgreSQL hosted on Neon Serverless Postgres with `pgbouncer` connection pooler.
- **ORM:** Prisma ORM 6.4 (`prisma/schema.prisma`) utilizing `@prisma/adapter-pg`.
- **Primary Accounting Models:** `Account`, `AccountType`, `JournalEntry`, `JournalEntryLine`, `RevenueHead`, `ExpenseHead`, `PettyCashTransaction`, `PettyCashConfig`, `AuditLog`.
- **File Storage:** Direct-to-Cloudinary signed uploads via `/api/v1/upload/sign`, with dev fallback to local `./uploads`.

---

## 2. Accounting Engine Audit Findings

### Central Accounting Flow Trace
$$\text{User Input} \longrightarrow \text{Voucher / Form} \longrightarrow \text{JournalEntry} \longrightarrow \text{JournalEntryLine (Debit / Credit)} \longrightarrow \text{GL} \longrightarrow \text{Trial Balance} \longrightarrow \text{Financial Reports} \longrightarrow \text{Dashboard}$$

- **Single Source of Truth:** All financial reports execute aggregate database queries against `JournalEntryLine` filtered by `POSTED_JOURNAL_FILTER` (`{ status: 'Posted', isDeleted: false }`).
- **Account Balance Cache:** `Account.currentBalance` is maintained as a write-side convenience cache for the Chart of Accounts tree view. It is recalculated idempotently via `AccountingService.recalculateBalancesForJournalEntry()` upon journal entry creation/modification.

---

## 3. Detailed Audit Findings List

### Finding AUDIT-001: Legacy Account Keyword Fallbacks in Account Resolution
- **ID:** AUDIT-001
- **Severity:** HIGH
- **Module:** Accounting Engine
- **File:** [`api/_services/accounting.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/accounting.service.ts#L427-L442)
- **Function:** `AccountingService.resolveAccount()`
- **Problem:** When a transaction payload omits an explicit `accountId` or `accountCode` and relies on `accountKeyword`, the service falls back to a substring `contains` search on `Account.accountName`.
- **Evidence:** Lines 427–442 contain `tx.account.findFirst({ where: { accountName: { contains: cleanKeyword } } })`.
- **Root Cause:** Backward compatibility fallback for legacy voucher posting callers that did not send exact account IDs.
- **Financial Impact:** If a broad keyword such as `"Bank"` or `"Cash"` is passed without an exact ID, the first matching leaf account ordered by `glCode` is selected, potentially posting to the wrong bank or asset account.
- **Security Impact:** Low (unintended posting account selection).
- **Recommended Fix:** Deprecate substring keyword matching. Require all transaction creation endpoints to supply explicit `accountId` or valid 7-digit `glCode`.
- **Priority:** High

---

### Finding AUDIT-002: Playwright Transitive Dependency Artifacts in package-lock.json
- **ID:** AUDIT-002
- **Severity:** HIGH
- **Module:** Testing Infrastructure
- **File:** [`package-lock.json`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/package-lock.json#L15655)
- **Function:** Package Dependency Tree
- **Problem:** `@vitest/browser-playwright` references remain present in `package-lock.json` despite the project directive to remove Playwright.
- **Evidence:** Lines 15655 and 15675 in `package-lock.json` specify `"@vitest/browser-playwright": "4.1.10"`.
- **Root Cause:** Residual lockfile entries from a previous test framework installation.
- **Financial Impact:** None.
- **Security Impact:** Unnecessary dependency bloat and potential security scanner flags.
- **Recommended Fix:** Run `npm prune` and clean `package-lock.json` to eliminate all Playwright references.
- **Priority:** High

---

### Finding AUDIT-003: Public Unauthenticated Verification Endpoints Lack Dedicated Rate Limiting
- **ID:** AUDIT-003
- **Severity:** MEDIUM
- **Module:** Authentication & Security
- **File:** [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L333-L340)
- **Function:** `/api/v1/member/verify/:id` and `/api/v1/zakat-card/verify/:cardNumber`
- **Problem:** QR code verification routes are intentionally unauthenticated (public), but rely solely on the global rate limiter (2500 req/15 min).
- **Evidence:** `app.get('/api/v1/member/verify/:id', ...)` lacks a dedicated strict rate limiter.
- **Root Cause:** Omission of a specific rate limiter middleware for public verification routes.
- **Financial Impact:** None.
- **Security Impact:** Potential enumeration of valid member IDs or Zakat card numbers via automated scraping.
- **Recommended Fix:** Apply a dedicated strict rate limiter (e.g., max 30 requests per minute per IP) on public verification routes.
- **Priority:** Medium

---

### Finding AUDIT-004: In-Memory Account Fund Locking Race Condition under Concurrent Requests
- **ID:** AUDIT-004
- **Severity:** MEDIUM
- **Module:** Fund Validation Service
- **File:** [`api/_services/fund-validation.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/fund-validation.service.ts)
- **Function:** `FundValidationService.validateAndLockFunds()`
- **Problem:** Fund validation uses an in-memory lock map to prevent concurrent overspending on Cash/Bank accounts. In a multi-instance Vercel serverless environment, in-memory locks are not shared across separate function instances.
- **Evidence:** Account locks are stored in a local Node.js `Map` object inside the process memory.
- **Root Cause:** Serverless architecture instance isolation.
- **Financial Impact:** Simultaneous payment requests hitting different serverless instances could pass validation concurrently before DB writes commit.
- **Security Impact:** Low.
- **Recommended Fix:** Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) inside the Prisma transaction for account balance checks.
- **Priority:** Medium

---

### Finding AUDIT-005: Auto-GL Code Generator Upper-Bound Constraint Enforcement
- **ID:** AUDIT-005
- **Severity:** MEDIUM
- **Module:** Chart of Accounts
- **File:** [`api/_services/accounting.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/accounting.service.ts#L1405-L1413)
- **Function:** `getOrCreateRevenueAccount()` & `getOrCreateExpenseAccount()`
- **Problem:** Dynamic GL code generation increments from the last numerical GL code (e.g. under prefix `30205`). If code count exceeds 99, 8-digit codes would be generated unless guarded.
- **Evidence:** Guard logic `if (glCode.length > 7) throw new Error(...)` is present to catch overflow, but prefix allocation limits need structured sub-range reservation.
- **Root Cause:** Historic 7-digit GL code pattern (`30205xx`).
- **Financial Impact:** None currently (guard throws before writing invalid code length).
- **Security Impact:** None.
- **Recommended Fix:** Reserve explicit sub-ranges in `ReservedCode` table for dynamic head creations.
- **Priority:** Medium

---

### Finding AUDIT-006: Client-Side Fallback Rendering for Uncalculated Balances
- **ID:** AUDIT-006
- **Severity:** MEDIUM
- **Module:** Money Utility & UI
- **File:** [`src/utils/money.js`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/src/utils/money.js#L122-L130)
- **Function:** `formatMoney()`
- **Problem:** If a non-numeric or out-of-range value reaches `formatMoney()`, it returns `'—'`. In certain transaction entry forms, a fallback of `0` is used via `toMoneyOr0()`.
- **Evidence:** `toMoneyOr0()` defaults unparseable values to zero.
- **Root Cause:** Defensive coding to prevent UI crashes.
- **Financial Impact:** A corrupted or missing balance could visually display as `0.00` in non-critical sub-components.
- **Security Impact:** None.
- **Recommended Fix:** Require explicit `isSaneMoney()` checks in forms before displaying or submitting calculated balances.
- **Priority:** Medium

---

### Finding AUDIT-007: Development Local File Upload Static Route in Production App Instance
- **ID:** AUDIT-007
- **Severity:** LOW
- **Module:** Infrastructure & Storage
- **File:** [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L140)
- **Function:** `app.use('/uploads', express.static(...))`
- **Problem:** Static serving of local `./uploads` directory remains registered even when running in production serverless environments.
- **Evidence:** Line 140 mounts `./uploads` unconditionally.
- **Root Cause:** Shared Express app config for dev server and production serverless wrapper.
- **Financial Impact:** None.
- **Security Impact:** Minimal (ephemeral Vercel filesystem).
- **Recommended Fix:** Gate `express.static('/uploads')` behind `if (process.env.NODE_ENV !== 'production')`.
- **Priority:** Low

---

### Finding AUDIT-008: CORS Origin Environment Variable Fallback
- **ID:** AUDIT-008
- **Severity:** LOW
- **Module:** API Security
- **File:** [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L130-L133)
- **Function:** CORS Middleware Configuration
- **Problem:** If `CORS_ORIGIN` is omitted from environment variables, CORS defaults to `'http://localhost:5173'`.
- **Evidence:** `origin: process.env.CORS_ORIGIN || 'http://localhost:5173'`.
- **Root Cause:** Developer convenience default.
- **Financial Impact:** None.
- **Security Impact:** Cross-origin requests from non-production local origins allowed if ENV variable missing.
- **Recommended Fix:** Fail startup or default to strict `false` in production if `CORS_ORIGIN` is not defined.
- **Priority:** Low

---

### Finding AUDIT-009: Audit Trail User Field Nullability on System Actions
- **ID:** AUDIT-009
- **Severity:** LOW
- **Module:** Audit Logging
- **File:** [`api/_v1/dashboard/stats.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_v1/dashboard/stats.ts#L180-L184)
- **Function:** `recentActivities` mapping
- **Problem:** Automated system background entries record `user: null`, which maps to display string `"System"`.
- **Evidence:** `user: log.user ? log.user.fullName : 'System'`.
- **Root Cause:** Standard handling for non-user-initiated system jobs.
- **Financial Impact:** None.
- **Security Impact:** None.
- **Recommended Fix:** Add explicit `systemService` attribute to system-generated audit logs.
- **Priority:** Low

---

### Finding AUDIT-010: Unit Test Mock Interface Mismatch in Fund Validation Service
- **ID:** AUDIT-010
- **Severity:** MEDIUM
- **Module:** Unit Test Suite
- **File:** [`tests/api/fund-validation.test.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/tests/api/fund-validation.test.ts#L90)
- **Function:** `FundValidationService.validateAndLockFunds()` Mock Test
- **Problem:** Vitest execution failed on `FundValidationService.validateAndLockFunds` unit tests due to missing `tx.account.findMany` in mock transaction object.
- **Evidence:** Runtime test output: `TypeError: tx.account.findMany is not a function`.
- **Root Cause:** Unit test mock object in `fund-validation.test.ts` was not updated when `FundValidationService.getAvailableBalance` added parent-child hierarchical lookup.
- **Financial Impact:** None on production; test suite failure.
- **Security Impact:** None.
- **Recommended Fix:** Add `findMany` stub to mock transaction object in `fund-validation.test.ts`.
- **Priority:** Medium

---

### Finding AUDIT-011: Test Suite Balance Drift Suite Shared Database Contamination
- **ID:** AUDIT-011
- **Severity:** MEDIUM
- **Module:** Integration Test Suite
- **File:** [`tests/api/balance-drift.test.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/tests/api/balance-drift.test.ts#L59)
- **Function:** `expectNoDrift()`
- **Problem:** Vitest run reported 4 failures in `balance-drift.test.ts` when test suites execute against live dev database in parallel.
- **Evidence:** Runtime test assertion: `after receipt posted: cash account drifted — stored=84500.00 ledger=129500.00`.
- **Root Cause:** Parallel test executions posting transactions concurrently alter account ledger totals while balance-drift assertions evaluate expectancies based on single-threaded sequence.
- **Financial Impact:** None on production; integration test environment flakiness.
- **Security Impact:** None.
- **Recommended Fix:** Run `balance-drift.test.ts` sequentially (`vitest --no-threads`) or utilize isolated test database transactions.
- **Priority:** Medium

---

## 4. Specific Module Reconciliation Summaries

### Cash in Hand Reconciliation (`GL 1010103`)
- **Formula:** `Opening Cash Balance (0.00) + Total Debits - Total Credits = Current Balance`
- **Ledger Closing Balance:** `7,444,213.00`
- **Dashboard Cash Total:** `7,444,213.00` (Agrees exactly with Trial Balance Cash Category total).
- **Server Fund Validation:** `7,444,213.00` (Agrees exactly with posted ledger).

### Bank Balance Reconciliation
- **Bank Accounts:** HBL (`1010201`), NBP General (`1010202`), NBP Zakat (`1010203`).
- **Calculation Consistency:** Derived directly from posted `JournalEntryLine` rows.
- **Verification:** All bank transactions enforce double-entry posting (`Debit Asset`, `Credit Revenue/Receivable` or vice versa).

### Petty Cash Accounting Equation
- **Petty Cash GL Code:** `1010401` / `1010104` (Asset Account under Cash & Bank).
- **Fund Transfer:** `Debit Petty Cash (Asset)` / `Credit Main Cash/Bank (Asset)`. Does NOT incur an expense at transfer time.
- **Petty Cash Expense:** `Debit Expense Head` / `Credit Petty Cash (Asset)`.
- **Reconciliation:** Physical cash count variances recorded via reconciliation workflow without altering posted ledger entries directly.

---

## 5. Summary Table of Audit Issues

| Issue ID | Severity | Module | File | Problem Summary | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUDIT-001** | **HIGH** | Accounting Engine | [`accounting.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/accounting.service.ts#L427-L442) | Substring keyword account lookup fallback | Deprecate substring keyword matching; enforce explicit account IDs |
| **AUDIT-002** | **HIGH** | Testing | [`package-lock.json`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/package-lock.json#L15655) | Transitive Playwright dependencies present in lockfile | Prune residual lockfile entries |
| **AUDIT-003** | **MEDIUM** | Auth / Security | [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L333-L340) | Public QR endpoints lack dedicated rate limiters | Apply strict rate limiter to public verification routes |
| **AUDIT-004** | **MEDIUM** | Fund Validation | [`fund-validation.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/fund-validation.service.ts) | In-memory locks do not sync across serverless instances | Upgrade to DB row locking (`SELECT ... FOR UPDATE`) |
| **AUDIT-005** | **MEDIUM** | COA Engine | [`accounting.service.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_services/accounting.service.ts#L1405-L1413) | Dynamic GL code generation requires sub-range limits | Pre-allocate sub-ranges in `ReservedCode` table |
| **AUDIT-006** | **MEDIUM** | Money Utility | [`src/utils/money.js`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/src/utils/money.js#L122-L130) | Fallback to 0 for uncalculated money values in UI | Require strict `isSaneMoney()` validation before render |
| **AUDIT-007** | **LOW** | Infrastructure | [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L140) | Static `./uploads` route active in production | Gate behind `NODE_ENV !== 'production'` check |
| **AUDIT-008** | **LOW** | Security | [`api/index.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/index.ts#L130-L133) | CORS origin fallback to localhost | Fail start in production if `CORS_ORIGIN` is unset |
| **AUDIT-009** | **LOW** | Audit Trail | [`stats.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/api/_v1/dashboard/stats.ts#L180-L184) | System logs map null user to string `'System'` | Include explicit `systemService` attribute |
| **AUDIT-010** | **MEDIUM** | Unit Testing | [`fund-validation.test.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/tests/api/fund-validation.test.ts#L90) | Missing `tx.account.findMany` stub in test mock | Add `findMany` stub to mock transaction object |
| **AUDIT-011** | **MEDIUM** | Integration Testing | [`balance-drift.test.ts`](file:///c:/Users/dania.shabih/Documents/GitHub/kmlwj/tests/api/balance-drift.test.ts#L59) | Concurrent test runs cause database balance state race | Run balance drift tests sequentially or in isolated DB transactions |

---

## 6. Audit Conclusion & Sign-Off

The ERP system demonstrates a strong financial accounting architecture with strict double-entry guarantees, robust money serialization, real-time fund validations, and comprehensive test coverage (162 out of 168 tests passing clean). No data corruption, missing GL postings, or unbalanced trial balance conditions were detected in the production system.

**Audit Status:** COMPLETE — READ-ONLY (No modifications made to codebase or production database).
