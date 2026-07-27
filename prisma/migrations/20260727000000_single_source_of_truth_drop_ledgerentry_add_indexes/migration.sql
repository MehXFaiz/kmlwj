-- Wave 1: Single source of truth for the accounting engine.
--
-- 1. Drop the denormalized LedgerEntry table. Postings now live ONLY as
--    JournalEntry + JournalEntryLine rows; no report reads LedgerEntry, and the
--    parallel copy could only ever drift. This is a destructive drop of a table
--    that carried no authoritative data (it was a mirror of JournalEntryLine).
-- 2. Add indexes on the hot posted-ledger query paths.

-- ── 1. Drop LedgerEntry ──────────────────────────────────────────────────────
-- Drop the FK first (Prisma named it "LedgerEntry_accountId_fkey"); IF EXISTS
-- keeps this idempotent whether or not the constraint/table are present.
ALTER TABLE IF EXISTS "LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_accountId_fkey";
DROP TABLE IF EXISTS "LedgerEntry";

-- ── 2. Add missing indexes ───────────────────────────────────────────────────
-- The single hottest query in the system: getPostedAggregates filters posted
-- lines by their parent entry's status + posting-date window.
CREATE INDEX IF NOT EXISTS "JournalEntry_status_postingDate_idx" ON "JournalEntry"("status", "postingDate");
CREATE INDEX IF NOT EXISTS "JournalEntry_voucherType_postingDate_idx" ON "JournalEntry"("voucherType", "postingDate");

-- getPostedAggregates groups by accountId; delete/recalc paths filter by journalEntryId.
CREATE INDEX IF NOT EXISTS "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");

-- Chart-of-accounts tree building (parent lookups) and level-scoped scans.
CREATE INDEX IF NOT EXISTS "Account_parentId_idx" ON "Account"("parentId");
CREATE INDEX IF NOT EXISTS "Account_accountLevel_idx" ON "Account"("accountLevel");
