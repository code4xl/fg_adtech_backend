/*
  Warnings:

  - You are about to drop the `SystemDailyRevenue` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `websiteId` to the `PublisherRevenue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PublisherRevenue" ADD COLUMN     "websiteId" UUID NOT NULL;

-- DropTable
DROP TABLE "SystemDailyRevenue";

-- CreateTable
CREATE TABLE "AdvertiserSpending" (
    "id" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "amount" DECIMAL(10,6) NOT NULL,
    "impressionId" UUID,
    "clickId" UUID,
    "eventType" "RevenueEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserSpending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertiserSpending_advertiserId_createdAt_idx" ON "AdvertiserSpending"("advertiserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_campaignId_createdAt_idx" ON "AdvertiserSpending"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_eventType_createdAt_idx" ON "AdvertiserSpending"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_creativeId_createdAt_idx" ON "AdvertiserSpending"("creativeId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_clientId_createdAt_idx" ON "AdvertiserSpending"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertiserSpending_eventType_idx" ON "AdvertiserSpending"("eventType");

-- CreateIndex
CREATE INDEX "BudgetTransaction_impressionId_idx" ON "BudgetTransaction"("impressionId");

-- CreateIndex
CREATE INDEX "BudgetTransaction_clickId_idx" ON "BudgetTransaction"("clickId");

-- CreateIndex
CREATE INDEX "BudgetTransaction_publisherId_idx" ON "BudgetTransaction"("publisherId");

-- CreateIndex
CREATE INDEX "BudgetTransaction_inventoryId_idx" ON "BudgetTransaction"("inventoryId");

-- CreateIndex
CREATE INDEX "PublisherRevenue_inventoryId_createdAt_idx" ON "PublisherRevenue"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_websiteId_createdAt_idx" ON "PublisherRevenue"("websiteId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_eventType_idx" ON "PublisherRevenue"("eventType");

-- CreateIndex
CREATE INDEX "SystemRevenue_campaignId_createdAt_idx" ON "SystemRevenue"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_publisherId_createdAt_idx" ON "SystemRevenue"("publisherId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_eventType_createdAt_idx" ON "SystemRevenue"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_inventoryId_createdAt_idx" ON "SystemRevenue"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_eventType_campaignId_createdAt_idx" ON "SystemRevenue"("eventType", "campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemRevenue_impressionId_idx" ON "SystemRevenue"("impressionId");

-- CreateIndex
CREATE INDEX "SystemRevenue_clickId_idx" ON "SystemRevenue"("clickId");

-- CreateIndex
CREATE INDEX "SystemRevenue_publisherId_eventType_createdAt_idx" ON "SystemRevenue"("publisherId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "PublisherRevenue" ADD CONSTRAINT "PublisherRevenue_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherRevenue" ADD CONSTRAINT "PublisherRevenue_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherRevenue" ADD CONSTRAINT "PublisherRevenue_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserSpending" ADD CONSTRAINT "AdvertiserSpending_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
