-- CreateTable
CREATE TABLE "IncomeCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddIncomeRecord" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "bankAccountId" UUID,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "attachmentUrl" TEXT,
    "journalEntryId" UUID,
    "createdById" UUID,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddIncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncomeCategory_name_key" ON "IncomeCategory"("name");
CREATE INDEX "IncomeCategory_isDeleted_idx" ON "IncomeCategory"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "AddIncomeRecord_journalEntryId_key" ON "AddIncomeRecord"("journalEntryId");
CREATE INDEX "AddIncomeRecord_isDeleted_idx" ON "AddIncomeRecord"("isDeleted");
CREATE INDEX "AddIncomeRecord_date_idx" ON "AddIncomeRecord"("date");
CREATE INDEX "AddIncomeRecord_categoryId_idx" ON "AddIncomeRecord"("categoryId");
CREATE INDEX "AddIncomeRecord_bankAccountId_idx" ON "AddIncomeRecord"("bankAccountId");

-- AddForeignKey
ALTER TABLE "IncomeCategory" ADD CONSTRAINT "IncomeCategory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddIncomeRecord" ADD CONSTRAINT "AddIncomeRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncomeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddIncomeRecord" ADD CONSTRAINT "AddIncomeRecord_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddIncomeRecord" ADD CONSTRAINT "AddIncomeRecord_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddIncomeRecord" ADD CONSTRAINT "AddIncomeRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
