/*
  Warnings:

  - You are about to drop the column `clickId` on the `SystemRevenue` table. All the data in the column will be lost.
  - You are about to drop the column `impressionId` on the `SystemRevenue` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "SystemRevenue_clickId_idx";

-- DropIndex
DROP INDEX "SystemRevenue_eventType_campaignId_createdAt_idx";

-- DropIndex
DROP INDEX "SystemRevenue_eventType_createdAt_idx";

-- DropIndex
DROP INDEX "SystemRevenue_impressionId_idx";

-- DropIndex
DROP INDEX "SystemRevenue_publisherId_eventType_createdAt_idx";

-- AlterTable
ALTER TABLE "SystemRevenue" DROP COLUMN "clickId",
DROP COLUMN "impressionId";
