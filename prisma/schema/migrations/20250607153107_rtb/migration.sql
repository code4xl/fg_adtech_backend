/*
  Warnings:

  - You are about to drop the column `auctionEndTime` on the `AuctionLog` table. All the data in the column will be lost.
  - You are about to drop the column `auctionStartTime` on the `AuctionLog` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `AuctionLog` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `AuctionLog` table. All the data in the column will be lost.
  - The `status` column on the `AuctionLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `browserType` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `targeting` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `BidRequest` table. All the data in the column will be lost.
  - You are about to drop the column `bidTimestamp` on the `BidResponse` table. All the data in the column will be lost.
  - You are about to drop the column `clickTrackingUrl` on the `BidResponse` table. All the data in the column will be lost.
  - You are about to drop the column `impressionTrackingUrl` on the `BidResponse` table. All the data in the column will be lost.
  - You are about to drop the column `responseTime` on the `BidResponse` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `BidResponse` table. All the data in the column will be lost.
  - You are about to drop the column `winNoticed` on the `BidResponse` table. All the data in the column will be lost.
  - The `status` column on the `BidResponse` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[bidRequestId]` on the table `AuctionLog` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalRequestId]` on the table `BidRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `auctionType` to the `AuctionLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adSlotContext` to the `BidRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalRequestId` to the `BidRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userContext` to the `BidRequest` table without a default value. This is not possible if the table is not empty.
  - Made the column `clientId` on table `Campaign` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'TIMEOUT', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'NO_BIDS', 'TIMEOUT', 'ERROR');

-- AlterEnum
ALTER TYPE "AuctionType" ADD VALUE 'HEADER_BIDDING';

-- DropForeignKey
ALTER TABLE "AuctionLog" DROP CONSTRAINT "AuctionLog_winningBidId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- DropIndex
DROP INDEX "AuctionLog_winningBidId_key";

-- DropIndex
DROP INDEX "BidRequest_requestId_key";

-- AlterTable
ALTER TABLE "AuctionLog" DROP COLUMN "auctionEndTime",
DROP COLUMN "auctionStartTime",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "auctionType" "AuctionType" NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validBids" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "AuctionStatus" NOT NULL DEFAULT 'PROCESSING';

-- AlterTable
ALTER TABLE "BidRequest" DROP COLUMN "browserType",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "createdAt",
DROP COLUMN "deviceType",
DROP COLUMN "floor",
DROP COLUMN "ipAddress",
DROP COLUMN "region",
DROP COLUMN "requestId",
DROP COLUMN "targeting",
DROP COLUMN "updatedAt",
DROP COLUMN "userAgent",
ADD COLUMN     "adSlotContext" JSONB NOT NULL,
ADD COLUMN     "externalRequestId" TEXT NOT NULL,
ADD COLUMN     "floorPrice" DECIMAL(10,4),
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "userContext" JSONB NOT NULL,
ALTER COLUMN "auctionType" SET DEFAULT 'SECOND_PRICE';

-- AlterTable
ALTER TABLE "BidResponse" DROP COLUMN "bidTimestamp",
DROP COLUMN "clickTrackingUrl",
DROP COLUMN "impressionTrackingUrl",
DROP COLUMN "responseTime",
DROP COLUMN "updatedAt",
DROP COLUMN "winNoticed",
ADD COLUMN     "clickUrls" TEXT[],
ADD COLUMN     "finalPrice" DECIMAL(10,4),
ADD COLUMN     "impressionUrls" TEXT[],
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "responseLatency" INTEGER,
ADD COLUMN     "winNotificationSent" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "status",
ADD COLUMN     "status" "BidStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "clientId" SET NOT NULL;

-- CreateTable
CREATE TABLE "TimestreamSyncLog" (
    "id" UUID NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastSyncTime" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimestreamSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpressionEvent" (
    "id" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "bidResponseId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "adSlotId" UUID,
    "price" DECIMAL(10,4),
    "publisherRevenue" DECIMAL(10,4),
    "userId" TEXT,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "osType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "viewable" BOOLEAN,
    "viewTime" INTEGER,
    "viewablePixels" INTEGER,
    "adSizePixels" TEXT,
    "isBot" BOOLEAN DEFAULT false,
    "fraudScore" DOUBLE PRECISION,
    "referrerUrl" TEXT,
    "pageUrl" TEXT,
    "pageCategory" TEXT,
    "syncedToTimestream" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ImpressionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" UUID NOT NULL,
    "impressionId" UUID,
    "creativeId" UUID NOT NULL,
    "bidResponseId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "adSlotId" UUID,
    "userId" TEXT,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "osType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "clickX" INTEGER,
    "clickY" INTEGER,
    "clickArea" TEXT,
    "landingUrl" TEXT,
    "landingLoaded" BOOLEAN,
    "isBot" BOOLEAN DEFAULT false,
    "fraudScore" DOUBLE PRECISION,
    "clickPattern" TEXT,
    "referrerUrl" TEXT,
    "pageUrl" TEXT,
    "timeFromImpression" INTEGER,
    "syncedToTimestream" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimestreamSyncLog_tableName_lastSyncTime_idx" ON "TimestreamSyncLog"("tableName", "lastSyncTime");

-- CreateIndex
CREATE INDEX "ImpressionEvent_creativeId_timestamp_idx" ON "ImpressionEvent"("creativeId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionEvent_campaignId_timestamp_idx" ON "ImpressionEvent"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionEvent_inventoryId_timestamp_idx" ON "ImpressionEvent"("inventoryId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionEvent_publisherId_timestamp_idx" ON "ImpressionEvent"("publisherId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionEvent_timestamp_idx" ON "ImpressionEvent"("timestamp");

-- CreateIndex
CREATE INDEX "ImpressionEvent_syncedToTimestream_idx" ON "ImpressionEvent"("syncedToTimestream");

-- CreateIndex
CREATE INDEX "ImpressionEvent_userId_campaignId_idx" ON "ImpressionEvent"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "ClickEvent_creativeId_timestamp_idx" ON "ClickEvent"("creativeId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickEvent_campaignId_timestamp_idx" ON "ClickEvent"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickEvent_inventoryId_timestamp_idx" ON "ClickEvent"("inventoryId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickEvent_publisherId_timestamp_idx" ON "ClickEvent"("publisherId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickEvent_impressionId_idx" ON "ClickEvent"("impressionId");

-- CreateIndex
CREATE INDEX "ClickEvent_timestamp_idx" ON "ClickEvent"("timestamp");

-- CreateIndex
CREATE INDEX "ClickEvent_syncedToTimestream_idx" ON "ClickEvent"("syncedToTimestream");

-- CreateIndex
CREATE INDEX "ClickEvent_userId_campaignId_idx" ON "ClickEvent"("userId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLog_bidRequestId_key" ON "AuctionLog"("bidRequestId");

-- CreateIndex
CREATE INDEX "AuctionLog_status_startedAt_idx" ON "AuctionLog"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AuctionLog_completedAt_idx" ON "AuctionLog"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BidRequest_externalRequestId_key" ON "BidRequest"("externalRequestId");

-- CreateIndex
CREATE INDEX "BidRequest_requestTimestamp_idx" ON "BidRequest"("requestTimestamp");

-- CreateIndex
CREATE INDEX "BidRequest_inventoryId_requestTimestamp_idx" ON "BidRequest"("inventoryId", "requestTimestamp");

-- CreateIndex
CREATE INDEX "BidRequest_publisherId_requestTimestamp_idx" ON "BidRequest"("publisherId", "requestTimestamp");

-- CreateIndex
CREATE INDEX "BidResponse_bidRequestId_idx" ON "BidResponse"("bidRequestId");

-- CreateIndex
CREATE INDEX "BidResponse_campaignId_createdAt_idx" ON "BidResponse"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "BidResponse_status_createdAt_idx" ON "BidResponse"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpressionEvent" ADD CONSTRAINT "ImpressionEvent_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpressionEvent" ADD CONSTRAINT "ImpressionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpressionEvent" ADD CONSTRAINT "ImpressionEvent_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpressionEvent" ADD CONSTRAINT "ImpressionEvent_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_impressionId_fkey" FOREIGN KEY ("impressionId") REFERENCES "ImpressionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
