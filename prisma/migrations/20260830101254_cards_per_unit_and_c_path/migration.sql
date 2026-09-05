-- DropIndex
DROP INDEX "NfcCard_orderItemId_key";

-- CreateIndex
CREATE INDEX "NfcCard_orderItemId_idx" ON "NfcCard"("orderItemId");
