/*
  Warnings:

  - The primary key for the `Campaign` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `advertiserId` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `budget` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `objective` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Campaign` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED', 'REJECTED', 'BUDGET_EXHAUSTED');

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION');

-- CreateEnum
CREATE TYPE "CampaignPacing" AS ENUM ('STANDARD', 'ACCELERATED');

-- CreateEnum
CREATE TYPE "BidStrategy" AS ENUM ('LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('IMAGE', 'HTML5', 'VIDEO');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_pkey",
ADD COLUMN     "advertiserId" UUID NOT NULL,
ADD COLUMN     "bidAmount" DECIMAL(10,2),
ADD COLUMN     "bidStrategy" "BidStrategy" NOT NULL DEFAULT 'LOWEST_COST',
ADD COLUMN     "budget" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "clientId" UUID,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dailyBudget" DECIMAL(10,2),
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "objective" "CampaignObjective" NOT NULL,
ADD COLUMN     "pacing" "CampaignPacing" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "CampaignInventory" (
    "campaignId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "maxBid" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignInventory_pkey" PRIMARY KEY ("campaignId","inventoryId")
);

-- CreateTable
CREATE TABLE "CampaignStatistics" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION,
    "cpc" DECIMAL(10,4),

    CONSTRAINT "CampaignStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTargetingRule" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "ruleType" "TargetingRuleType" NOT NULL,
    "ruleData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTargetingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "landingUrl" TEXT NOT NULL,
    "status" "CreativeStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStatistics_campaignId_date_key" ON "CampaignStatistics"("campaignId", "date");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInventory" ADD CONSTRAINT "CampaignInventory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInventory" ADD CONSTRAINT "CampaignInventory_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStatistics" ADD CONSTRAINT "CampaignStatistics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTargetingRule" ADD CONSTRAINT "CampaignTargetingRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
