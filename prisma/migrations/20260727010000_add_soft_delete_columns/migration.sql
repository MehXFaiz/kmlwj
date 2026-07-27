-- Wave 3: enterprise soft delete.
-- Adds isDeleted / deletedAt / deletedBy to every business entity so records
-- can be Deleted (soft), Restored, or Permanently Deleted (hard) without ever
-- affecting historical financial data. All defaults are false/null so existing
-- rows are unaffected and remain visible everywhere.

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "RevenueHead" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RevenueHead" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "RevenueHead" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "ExpenseHead" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExpenseHead" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ExpenseHead" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Beneficiary" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Beneficiary" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Beneficiary" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "SimpleIncome" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SimpleIncome" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "SimpleIncome" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "SimpleExpense" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SimpleExpense" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "SimpleExpense" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "HallBooking" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HallBooking" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "HallBooking" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "RevenueCollection" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RevenueCollection" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "RevenueCollection" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "FamilyRelationship" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyRelationship" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "FamilyRelationship" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "ZakatCard" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ZakatCard" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ZakatCard" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

ALTER TABLE "DonationReceived" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DonationReceived" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "DonationReceived" ADD COLUMN IF NOT EXISTS "deletedBy" UUID;

-- Indexes: every list/report query now filters WHERE "isDeleted" = false.
CREATE INDEX IF NOT EXISTS "Account_isDeleted_idx" ON "Account"("isDeleted");
CREATE INDEX IF NOT EXISTS "RevenueHead_isDeleted_idx" ON "RevenueHead"("isDeleted");
CREATE INDEX IF NOT EXISTS "ExpenseHead_isDeleted_idx" ON "ExpenseHead"("isDeleted");
CREATE INDEX IF NOT EXISTS "JournalEntry_isDeleted_idx" ON "JournalEntry"("isDeleted");
CREATE INDEX IF NOT EXISTS "Beneficiary_isDeleted_idx" ON "Beneficiary"("isDeleted");
CREATE INDEX IF NOT EXISTS "Donation_isDeleted_idx" ON "Donation"("isDeleted");
CREATE INDEX IF NOT EXISTS "SimpleIncome_isDeleted_idx" ON "SimpleIncome"("isDeleted");
CREATE INDEX IF NOT EXISTS "SimpleExpense_isDeleted_idx" ON "SimpleExpense"("isDeleted");
CREATE INDEX IF NOT EXISTS "HallBooking_isDeleted_idx" ON "HallBooking"("isDeleted");
CREATE INDEX IF NOT EXISTS "Customer_isDeleted_idx" ON "Customer"("isDeleted");
CREATE INDEX IF NOT EXISTS "Invoice_isDeleted_idx" ON "Invoice"("isDeleted");
CREATE INDEX IF NOT EXISTS "RevenueCollection_isDeleted_idx" ON "RevenueCollection"("isDeleted");
CREATE INDEX IF NOT EXISTS "Member_isDeleted_idx" ON "Member"("isDeleted");
CREATE INDEX IF NOT EXISTS "FamilyRelationship_isDeleted_idx" ON "FamilyRelationship"("isDeleted");
CREATE INDEX IF NOT EXISTS "ZakatCard_isDeleted_idx" ON "ZakatCard"("isDeleted");
CREATE INDEX IF NOT EXISTS "Donor_isDeleted_idx" ON "Donor"("isDeleted");
CREATE INDEX IF NOT EXISTS "DonationReceived_isDeleted_idx" ON "DonationReceived"("isDeleted");
