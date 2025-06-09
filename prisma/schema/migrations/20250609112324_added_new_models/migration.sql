-- CreateEnum
CREATE TYPE "BidEligibilityReason" AS ENUM ('ELIGIBLE', 'NO_BUDGET', 'TARGETING_MISMATCH', 'FREQUENCY_CAP_EXCEEDED', 'CAMPAIGN_PAUSED', 'CREATIVE_REJECTED', 'FLOOR_PRICE_TOO_HIGH');

-- CreateTable
CREATE TABLE "BidEligibility" (
    "id" UUID NOT NULL,
    "bidRequestId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "isEligible" BOOLEAN NOT NULL,
    "reason" "BidEligibilityReason" NOT NULL,
    "checkTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimestreamBatch" (
    "id" UUID NOT NULL,
    "batchType" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "TimestreamBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BidEligibility_bidRequestId_idx" ON "BidEligibility"("bidRequestId");

-- CreateIndex
CREATE INDEX "BidEligibility_campaignId_checkTime_idx" ON "BidEligibility"("campaignId", "checkTime");

-- CreateIndex
CREATE INDEX "TimestreamBatch_batchType_status_idx" ON "TimestreamBatch"("batchType", "status");

-- CreateIndex
CREATE INDEX "TimestreamBatch_startTime_idx" ON "TimestreamBatch"("startTime");

-- AddForeignKey
ALTER TABLE "BidEligibility" ADD CONSTRAINT "BidEligibility_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidEligibility" ADD CONSTRAINT "BidEligibility_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
