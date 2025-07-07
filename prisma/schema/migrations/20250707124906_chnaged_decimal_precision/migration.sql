/*
  Warnings:

  - You are about to alter the column `totalSpend` on the `AdvertiserDailySpending` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,6)` to `Decimal(15,4)`.
  - You are about to alter the column `amount` on the `AdvertiserSpending` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `cpi` on the `BidResponse` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,10)` to `Decimal(10,4)`.
  - You are about to alter the column `amount` on the `BudgetTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `bidAmount` on the `Campaign` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `totalBudget` on the `CampaignBudget` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `dailyBudget` on the `CampaignBudget` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `spentToday` on the `CampaignDailyBudget` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `remainingToday` on the `CampaignDailyBudget` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `spend` on the `CampaignStatistics` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `basePrice` on the `FloorPrice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `grossRevenue` on the `PublisherDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,6)` to `Decimal(15,4)`.
  - You are about to alter the column `netRevenue` on the `PublisherDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,6)` to `Decimal(15,4)`.
  - You are about to alter the column `commissionPaid` on the `PublisherDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,6)` to `Decimal(15,4)`.
  - You are about to alter the column `grossRevenue` on the `PublisherRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `netRevenue` on the `PublisherRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `totalGrossRevenue` on the `SystemDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,6)` to `Decimal(18,4)`.
  - You are about to alter the column `totalCommissionEarned` on the `SystemDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,6)` to `Decimal(18,4)`.
  - You are about to alter the column `totalPublisherPayout` on the `SystemDailyRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,6)` to `Decimal(18,4)`.
  - You are about to alter the column `grossRevenue` on the `SystemRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `publisherShare` on the `SystemRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.
  - You are about to alter the column `systemEarning` on the `SystemRevenue` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,6)` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE "AdvertiserDailySpending" ALTER COLUMN "totalSpend" SET DATA TYPE DECIMAL(15,4);

-- AlterTable
ALTER TABLE "AdvertiserSpending" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "BidResponse" ALTER COLUMN "cpi" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "BudgetTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "bidAmount" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "CampaignBudget" ALTER COLUMN "totalBudget" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "dailyBudget" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "CampaignDailyBudget" ALTER COLUMN "spentToday" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "remainingToday" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "CampaignStatistics" ALTER COLUMN "spend" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "FloorPrice" ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "PublisherDailyRevenue" ALTER COLUMN "grossRevenue" SET DATA TYPE DECIMAL(15,4),
ALTER COLUMN "netRevenue" SET DATA TYPE DECIMAL(15,4),
ALTER COLUMN "commissionPaid" SET DATA TYPE DECIMAL(15,4);

-- AlterTable
ALTER TABLE "PublisherRevenue" ALTER COLUMN "grossRevenue" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "netRevenue" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "SystemDailyRevenue" ALTER COLUMN "totalGrossRevenue" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalCommissionEarned" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalPublisherPayout" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "SystemRevenue" ALTER COLUMN "grossRevenue" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "publisherShare" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "systemEarning" SET DATA TYPE DECIMAL(12,4);
