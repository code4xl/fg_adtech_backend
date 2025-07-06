/*
  Warnings:

  - You are about to drop the column `clientId` on the `AdvertiserSpending` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AdvertiserSpending_clientId_campaignId_createdAt_idx";

-- DropIndex
DROP INDEX "AdvertiserSpending_clientId_createdAt_idx";

-- AlterTable
ALTER TABLE "AdvertiserSpending" DROP COLUMN "clientId";
