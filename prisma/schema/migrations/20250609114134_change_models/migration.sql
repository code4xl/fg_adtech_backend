/*
  Warnings:

  - You are about to drop the `BidEligibility` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TimestreamBatch` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RTBCacheType" AS ENUM ('ELIGIBLE_CAMPAIGNS', 'CAMPAIGN_BUDGET', 'TARGETING_RULES', 'FLOOR_PRICES');

-- DropForeignKey
ALTER TABLE "BidEligibility" DROP CONSTRAINT "BidEligibility_bidRequestId_fkey";

-- DropForeignKey
ALTER TABLE "BidEligibility" DROP CONSTRAINT "BidEligibility_campaignId_fkey";

-- DropTable
DROP TABLE "BidEligibility";

-- DropTable
DROP TABLE "TimestreamBatch";

-- DropEnum
DROP TYPE "BidEligibilityReason";

-- CreateTable
CREATE TABLE "RTBCache" (
    "id" UUID NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "cacheType" "RTBCacheType" NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RTBCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RTBMetrics" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bidRequestId" UUID,
    "auctionLatency" INTEGER,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "fillRate" DOUBLE PRECISION,
    "avgBidPrice" DECIMAL(10,4),

    CONSTRAINT "RTBMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RTBCache_cacheKey_key" ON "RTBCache"("cacheKey");

-- CreateIndex
CREATE INDEX "RTBCache_cacheType_expiresAt_idx" ON "RTBCache"("cacheType", "expiresAt");

-- CreateIndex
CREATE INDEX "RTBMetrics_timestamp_idx" ON "RTBMetrics"("timestamp");
