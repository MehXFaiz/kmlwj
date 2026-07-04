-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HallBooking_hallId_programDate_key" ON "HallBooking"("hallId", "programDate") WHERE status IN ('Confirmed', 'Pending', 'POSTED');
