/*
  Warnings:

  - You are about to drop the column `browserType` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `clickPattern` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `landingLoaded` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `osType` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `pageUrl` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `referrerUrl` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `adSizePixels` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `browserType` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `osType` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `pageCategory` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `pageUrl` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `publisherRevenue` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `referrerUrl` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ImpressionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `viewablePixels` on the `ImpressionEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ClickEvent_userId_campaignId_idx";

-- DropIndex
DROP INDEX "ImpressionEvent_userId_campaignId_idx";

-- AlterTable
ALTER TABLE "ClickEvent" DROP COLUMN "browserType",
DROP COLUMN "city",
DROP COLUMN "clickPattern",
DROP COLUMN "country",
DROP COLUMN "landingLoaded",
DROP COLUMN "osType",
DROP COLUMN "pageUrl",
DROP COLUMN "referrerUrl",
DROP COLUMN "region",
DROP COLUMN "sessionId",
DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "ImpressionEvent" DROP COLUMN "adSizePixels",
DROP COLUMN "browserType",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "osType",
DROP COLUMN "pageCategory",
DROP COLUMN "pageUrl",
DROP COLUMN "price",
DROP COLUMN "publisherRevenue",
DROP COLUMN "referrerUrl",
DROP COLUMN "region",
DROP COLUMN "sessionId",
DROP COLUMN "userId",
DROP COLUMN "viewablePixels";
