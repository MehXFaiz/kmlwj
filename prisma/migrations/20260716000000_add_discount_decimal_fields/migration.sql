-- AlterTable
ALTER TABLE "HallBooking" RENAME COLUMN "amount" TO "hallCharges";
ALTER TABLE "HallBooking" ALTER COLUMN "hallCharges" TYPE DECIMAL(65,30);
ALTER TABLE "HallBooking" ALTER COLUMN "discount" TYPE DECIMAL(65,30);
ALTER TABLE "HallBooking" ALTER COLUMN "discount" SET DEFAULT 0;
ALTER TABLE "HallBooking" ALTER COLUMN "discount" SET NOT NULL;
ALTER TABLE "HallBooking" ALTER COLUMN "netAmount" TYPE DECIMAL(65,30);
ALTER TABLE "HallBooking" ALTER COLUMN "receivedAmount" TYPE DECIMAL(65,30);
ALTER TABLE "HallBooking" ADD COLUMN "remainingAmount" DECIMAL(65,30);
