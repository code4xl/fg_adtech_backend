/*
  Warnings:

  - You are about to drop the column `clickId` on the `AdvertiserSpending` table. All the data in the column will be lost.
  - You are about to drop the column `impressionId` on the `AdvertiserSpending` table. All the data in the column will be lost.
  - You are about to drop the column `clickId` on the `PublisherRevenue` table. All the data in the column will be lost.
  - You are about to drop the column `impressionId` on the `PublisherRevenue` table. All the data in the column will be lost.
  - You are about to drop the column `systemCommission` on the `SystemRevenue` table. All the data in the column will be lost.
  - Added the required column `advertiserId` to the `SystemRevenue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creativeId` to the `SystemRevenue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `systemEarning` to the `SystemRevenue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdvertiserSpending" DROP COLUMN "clickId",
DROP COLUMN "impressionId",
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "BudgetTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "PublisherRevenue" DROP COLUMN "clickId",
DROP COLUMN "impressionId",
ALTER COLUMN "grossRevenue" SET DATA TYPE DECIMAL(12,6),
ALTER COLUMN "commissionRate" SET DATA TYPE DECIMAL(5,4),
ALTER COLUMN "netRevenue" SET DATA TYPE DECIMAL(12,6);

-- AlterTable
ALTER TABLE "SystemRevenue" DROP COLUMN "systemCommission",
ADD COLUMN     "advertiserId" UUID NOT NULL,
ADD COLUMN     "creativeId" UUID NOT NULL,
ADD COLUMN     "systemEarning" DECIMAL(12,6) NOT NULL,
ALTER COLUMN "grossRevenue" SET DATA TYPE DECIMAL(12,6),
ALTER COLUMN "publisherShare" SET DATA TYPE DECIMAL(12,6),
ALTER COLUMN "commissionRate" SET DATA TYPE DECIMAL(5,4);

-- CreateTable
CREATE TABLE "PublisherDailyRevenue" (
    "id" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "commissionPaid" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherDailyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserDailySpending" (
    "id" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "campaignId" UUID,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalSpend" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserDailySpending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDailyRevenue" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalGrossRevenue" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalCommissionEarned" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalPublisherPayout" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "activeCampaigns" INTEGER NOT NULL DEFAULT 0,
    "activePublishers" INTEGER NOT NULL DEFAULT 0,
    "activeAdvertisers" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDailyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublisherDailyRevenue_publisherId_date_idx" ON "PublisherDailyRevenue"("publisherId", "date");

-- CreateIndex
CREATE INDEX "PublisherDailyRevenue_date_idx" ON "PublisherDailyRevenue"("date");

-- CreateIndex
CREATE INDEX "PublisherDailyRevenue_date_grossRevenue_idx" ON "PublisherDailyRevenue"("date", "grossRevenue");

-- CreateIndex
CREATE INDEX "PublisherDailyRevenue_date_totalImpressions_idx" ON "PublisherDailyRevenue"("date", "totalImpressions");

-- CreateIndex
CREATE INDEX "PublisherDailyRevenue_publisherId_grossRevenue_idx" ON "PublisherDailyRevenue"("publisherId", "grossRevenue");

-- CreateIndex
CREATE UNIQUE INDEX "PublisherDailyRevenue_publisherId_date_key" ON "PublisherDailyRevenue"("publisherId", "date");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_advertiserId_date_idx" ON "AdvertiserDailySpending"("advertiserId", "date");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_campaignId_date_idx" ON "AdvertiserDailySpending"("campaignId", "date");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_date_idx" ON "AdvertiserDailySpending"("date");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_date_totalSpend_idx" ON "AdvertiserDailySpending"("date", "totalSpend");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_campaignId_totalSpend_idx" ON "AdvertiserDailySpending"("campaignId", "totalSpend");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_date_totalImpressions_idx" ON "AdvertiserDailySpending"("date", "totalImpressions");

-- CreateIndex
CREATE INDEX "AdvertiserDailySpending_advertiserId_totalSpend_idx" ON "AdvertiserDailySpending"("advertiserId", "totalSpend");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserDailySpending_advertiserId_campaignId_date_key" ON "AdvertiserDailySpending"("advertiserId", "campaignId", "date");

-- CreateIndex
CREATE INDEX "SystemDailyRevenue_date_idx" ON "SystemDailyRevenue"("date");

-- CreateIndex
CREATE INDEX "SystemDailyRevenue_totalGrossRevenue_idx" ON "SystemDailyRevenue"("totalGrossRevenue");

-- CreateIndex
CREATE INDEX "SystemDailyRevenue_totalImpressions_idx" ON "SystemDailyRevenue"("totalImpressions");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDailyRevenue_date_key" ON "SystemDailyRevenue"("date");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_advertiserId_campaignId_createdAt_idx" ON "AdvertiserSpending"("advertiserId", "campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_campaignId_creativeId_createdAt_idx" ON "AdvertiserSpending"("campaignId", "creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_advertiserId_eventType_createdAt_idx" ON "AdvertiserSpending"("advertiserId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_clientId_campaignId_createdAt_idx" ON "AdvertiserSpending"("clientId", "campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_creativeId_eventType_createdAt_idx" ON "AdvertiserSpending"("creativeId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetTransaction_type_amount_idx" ON "BudgetTransaction"("type", "amount");

-- CreateIndex
CREATE INDEX "BudgetTransaction_campaignId_amount_idx" ON "BudgetTransaction"("campaignId", "amount");

-- CreateIndex
CREATE INDEX "BudgetTransaction_campaignId_type_createdAt_idx" ON "BudgetTransaction"("campaignId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetTransaction_publisherId_type_createdAt_idx" ON "BudgetTransaction"("publisherId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetTransaction_inventoryId_type_createdAt_idx" ON "BudgetTransaction"("inventoryId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_publisherId_createdAt_eventType_idx" ON "PublisherRevenue"("publisherId", "createdAt", "eventType");

-- CreateIndex
CREATE INDEX "PublisherRevenue_campaignId_inventoryId_createdAt_idx" ON "PublisherRevenue"("campaignId", "inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_inventoryId_eventType_createdAt_idx" ON "PublisherRevenue"("inventoryId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_publisherId_campaignId_createdAt_idx" ON "PublisherRevenue"("publisherId", "campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_websiteId_eventType_createdAt_idx" ON "PublisherRevenue"("websiteId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_campaignId_eventType_createdAt_idx" ON "PublisherRevenue"("campaignId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_advertiserId_createdAt_idx" ON "SystemRevenue"("advertiserId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_creativeId_eventType_createdAt_idx" ON "SystemRevenue"("creativeId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_commissionRate_createdAt_idx" ON "SystemRevenue"("commissionRate", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_eventType_createdAt_idx" ON "SystemRevenue"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_publisherId_campaignId_createdAt_idx" ON "SystemRevenue"("publisherId", "campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_inventoryId_eventType_createdAt_idx" ON "SystemRevenue"("inventoryId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_advertiserId_publisherId_createdAt_idx" ON "SystemRevenue"("advertiserId", "publisherId", "createdAt");

-- AddForeignKey
ALTER TABLE "PublisherDailyRevenue" ADD CONSTRAINT "PublisherDailyRevenue_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserDailySpending" ADD CONSTRAINT "AdvertiserDailySpending_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserDailySpending" ADD CONSTRAINT "AdvertiserDailySpending_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
