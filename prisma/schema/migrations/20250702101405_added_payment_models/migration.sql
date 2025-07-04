/*
  Warnings:

  - You are about to drop the `CampaignBudgetTracker` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PublisherTier" AS ENUM ('STANDARD', 'PREMIUM', 'ELITE');

-- CreateEnum
CREATE TYPE "RevenueEventType" AS ENUM ('IMPRESSION', 'CLICK');

-- DropForeignKey
ALTER TABLE "CampaignBudgetTracker" DROP CONSTRAINT "CampaignBudgetTracker_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_paymentMethodId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "campaignBudgetId" UUID;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "paymentThreshold" DECIMAL(10,4) NOT NULL DEFAULT 100.0000,
ADD COLUMN     "tier" "PublisherTier" NOT NULL DEFAULT 'STANDARD';

-- DropTable
DROP TABLE "CampaignBudgetTracker";

-- DropTable
DROP TABLE "PaymentMethod";

-- DropTable
DROP TABLE "Transaction";

-- DropTable
DROP TABLE "Wallet";

-- CreateTable
CREATE TABLE "CampaignBudget" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "totalBudget" DECIMAL(10,2) NOT NULL,
    "dailyBudget" DECIMAL(10,2) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDailyBudget" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "spentToday" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remainingToday" DECIMAL(10,2) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignDailyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublisherRevenue" (
    "id" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "impressionId" UUID,
    "clickId" UUID,
    "grossRevenue" DECIMAL(10,6) NOT NULL,
    "commissionRate" DECIMAL(3,2) NOT NULL,
    "netRevenue" DECIMAL(10,6) NOT NULL,
    "eventType" "RevenueEventType" NOT NULL,
    "inventoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemRevenue" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "impressionId" UUID,
    "clickId" UUID,
    "grossRevenue" DECIMAL(10,6) NOT NULL,
    "publisherShare" DECIMAL(10,6) NOT NULL,
    "systemCommission" DECIMAL(10,6) NOT NULL,
    "commissionRate" DECIMAL(3,2) NOT NULL,
    "eventType" "RevenueEventType" NOT NULL,
    "inventoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDailyRevenue" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalGrossRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPublisherPayout" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalSystemRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemDailyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetTransaction" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,6) NOT NULL,
    "description" TEXT,
    "impressionId" UUID,
    "clickId" UUID,
    "publisherId" UUID,
    "inventoryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignBudget_campaignId_key" ON "CampaignBudget"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignBudget_campaignId_idx" ON "CampaignBudget"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignDailyBudget_campaignId_date_idx" ON "CampaignDailyBudget"("campaignId", "date");

-- CreateIndex
CREATE INDEX "CampaignDailyBudget_date_campaignId_idx" ON "CampaignDailyBudget"("date", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignDailyBudget_campaignId_idx" ON "CampaignDailyBudget"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDailyBudget_campaignId_date_key" ON "CampaignDailyBudget"("campaignId", "date");

-- CreateIndex
CREATE INDEX "PublisherRevenue_publisherId_createdAt_idx" ON "PublisherRevenue"("publisherId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_campaignId_createdAt_idx" ON "PublisherRevenue"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "PublisherRevenue_createdAt_eventType_idx" ON "PublisherRevenue"("createdAt", "eventType");

-- CreateIndex
CREATE INDEX "SystemDailyRevenue_date_idx" ON "SystemDailyRevenue"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDailyRevenue_date_key" ON "SystemDailyRevenue"("date");

-- CreateIndex
CREATE INDEX "BudgetTransaction_campaignId_createdAt_idx" ON "BudgetTransaction"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetTransaction_type_createdAt_idx" ON "BudgetTransaction"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_campaignBudgetId_fkey" FOREIGN KEY ("campaignBudgetId") REFERENCES "CampaignBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDailyBudget" ADD CONSTRAINT "CampaignDailyBudget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherRevenue" ADD CONSTRAINT "PublisherRevenue_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemRevenue" ADD CONSTRAINT "SystemRevenue_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemRevenue" ADD CONSTRAINT "SystemRevenue_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemRevenue" ADD CONSTRAINT "SystemRevenue_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransaction" ADD CONSTRAINT "BudgetTransaction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
