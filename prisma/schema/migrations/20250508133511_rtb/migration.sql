/*
  Warnings:

  - A unique constraint covering the columns `[requestId]` on the table `BidRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publisherId` to the `BidRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestId` to the `BidRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `BidRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuctionLogStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'NO_BIDS');

-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('FIRST_PRICE', 'SECOND_PRICE');

-- AlterTable
ALTER TABLE "BidRequest" ADD COLUMN     "auctionType" "AuctionType" NOT NULL DEFAULT 'FIRST_PRICE',
ADD COLUMN     "browserType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "floor" DECIMAL(10,4),
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "publisherId" UUID NOT NULL,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "requestId" TEXT NOT NULL,
ADD COLUMN     "requestTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "targeting" JSONB,
ADD COLUMN     "timeout" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "AuctionLog" (
    "id" UUID NOT NULL,
    "bidRequestId" UUID NOT NULL,
    "winningBidId" UUID,
    "floorPrice" DECIMAL(10,4),
    "finalPrice" DECIMAL(10,4),
    "totalBids" INTEGER NOT NULL DEFAULT 0,
    "auctionStartTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionEndTime" TIMESTAMP(3),
    "auctionDuration" INTEGER,
    "status" "AuctionLogStatus" NOT NULL DEFAULT 'STARTED',
    "errorMessage" TEXT,
    "debugData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidResponse" (
    "id" UUID NOT NULL,
    "bidRequestId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "bidPrice" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bidTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseTime" INTEGER,
    "winNoticed" BOOLEAN NOT NULL DEFAULT false,
    "adMarkup" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLog_winningBidId_key" ON "AuctionLog"("winningBidId");

-- CreateIndex
CREATE UNIQUE INDEX "BidRequest_requestId_key" ON "BidRequest"("requestId");

-- AddForeignKey
ALTER TABLE "AuctionLog" ADD CONSTRAINT "AuctionLog_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLog" ADD CONSTRAINT "AuctionLog_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "BidResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidResponse" ADD CONSTRAINT "BidResponse_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidResponse" ADD CONSTRAINT "BidResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidResponse" ADD CONSTRAINT "BidResponse_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidResponse" ADD CONSTRAINT "BidResponse_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
