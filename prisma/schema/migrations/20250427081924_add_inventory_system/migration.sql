/*
  Warnings:

  - Added the required column `updatedAt` to the `Publisher` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InventoryFormat" AS ENUM ('BANNER', 'NATIVE', 'VIDEO', 'INTERSTITIAL', 'REWARDED');

-- CreateEnum
CREATE TYPE "InventoryPosition" AS ENUM ('ABOVE_FOLD', 'BELOW_FOLD', 'SIDEBAR', 'FOOTER', 'HEADER', 'IN_CONTENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TargetingRuleType" AS ENUM ('DEVICE', 'GEOGRAPHIC', 'BROWSER', 'OS', 'TIME', 'AUDIENCE');

-- CreateEnum
CREATE TYPE "PublisherStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "status" "PublisherStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "AdInventory" (
    "id" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" "InventoryFormat" NOT NULL,
    "position" "InventoryPosition" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewabilityScore" DOUBLE PRECISION,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidRequest" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorPrice" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "timeTargeting" JSONB,
    "buyerTargeting" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impression" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Impression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAvailability" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalImpressions" INTEGER NOT NULL,
    "reservedImpressions" INTEGER NOT NULL DEFAULT 0,
    "availableImpressions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBlockedAdvertiser" (
    "inventoryId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBlockedAdvertiser_pkey" PRIMARY KEY ("inventoryId","advertiserId")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "inventoryId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("inventoryId","categoryId")
);

-- CreateTable
CREATE TABLE "InventoryTargetingRule" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "ruleType" "TargetingRuleType" NOT NULL,
    "ruleData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryTargetingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAvailability_inventoryId_date_key" ON "InventoryAvailability"("inventoryId", "date");

-- AddForeignKey
ALTER TABLE "AdInventory" ADD CONSTRAINT "AdInventory_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPrice" ADD CONSTRAINT "FloorPrice_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAvailability" ADD CONSTRAINT "InventoryAvailability_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBlockedAdvertiser" ADD CONSTRAINT "InventoryBlockedAdvertiser_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBlockedAdvertiser" ADD CONSTRAINT "InventoryBlockedAdvertiser_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTargetingRule" ADD CONSTRAINT "InventoryTargetingRule_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
