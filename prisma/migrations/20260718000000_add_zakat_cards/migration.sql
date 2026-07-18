-- CreateTable
CREATE TABLE "ZakatCard" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "memberId" UUID NOT NULL,
    "zakatAmount" DOUBLE PRECISION NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardNumber" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "bankAccountId" UUID,
    "journalEntryId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZakatCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZakatCard_cardNumber_key" ON "ZakatCard"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ZakatCard_journalEntryId_key" ON "ZakatCard"("journalEntryId");

-- CreateIndex
CREATE INDEX "ZakatCard_memberId_idx" ON "ZakatCard"("memberId");

-- CreateIndex
CREATE INDEX "ZakatCard_cardNumber_idx" ON "ZakatCard"("cardNumber");

-- AddForeignKey
ALTER TABLE "ZakatCard" ADD CONSTRAINT "ZakatCard_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatCard" ADD CONSTRAINT "ZakatCard_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatCard" ADD CONSTRAINT "ZakatCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
