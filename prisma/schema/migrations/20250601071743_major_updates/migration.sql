/*
  Warnings:

  - You are about to drop the column `parentId` on the `ContentCategory` table. All the data in the column will be lost.
  - You are about to drop the column `inventoryId` on the `Creative` table. All the data in the column will be lost.
  - You are about to drop the column `domain` on the `Publisher` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Website` table. All the data in the column will be lost.
  - You are about to drop the column `websiteName` on the `Website` table. All the data in the column will be lost.
  - You are about to drop the `CampaignInventory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Click` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Impression` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryAvailability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryBlockedAdvertiser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PublisherCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PublisherLanguage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AdInventoryToWebsite` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `ContentCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[domain]` on the table `Website` will be added. If there are existing duplicate values, this will fail.
  - Made the column `clientId` on table `Campaign` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `domain` to the `Website` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Website` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI', 'WALLET');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignInventory" DROP CONSTRAINT "CampaignInventory_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignInventory" DROP CONSTRAINT "CampaignInventory_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "Click" DROP CONSTRAINT "Click_impressionId_fkey";

-- DropForeignKey
ALTER TABLE "ContentCategory" DROP CONSTRAINT "ContentCategory_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Creative" DROP CONSTRAINT "Creative_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_advertiserId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_bidResponseId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_creativeId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "Impression" DROP CONSTRAINT "Impression_publisherId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryAvailability" DROP CONSTRAINT "InventoryAvailability_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBlockedAdvertiser" DROP CONSTRAINT "InventoryBlockedAdvertiser_advertiserId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBlockedAdvertiser" DROP CONSTRAINT "InventoryBlockedAdvertiser_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryCategory" DROP CONSTRAINT "InventoryCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryCategory" DROP CONSTRAINT "InventoryCategory_inventoryId_fkey";

-- DropForeignKey
ALTER TABLE "PublisherCategory" DROP CONSTRAINT "PublisherCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PublisherCategory" DROP CONSTRAINT "PublisherCategory_publisherId_fkey";

-- DropForeignKey
ALTER TABLE "PublisherLanguage" DROP CONSTRAINT "PublisherLanguage_publisherId_fkey";

-- DropForeignKey
ALTER TABLE "_AdInventoryToWebsite" DROP CONSTRAINT "_AdInventoryToWebsite_A_fkey";

-- DropForeignKey
ALTER TABLE "_AdInventoryToWebsite" DROP CONSTRAINT "_AdInventoryToWebsite_B_fkey";

-- DropIndex
DROP INDEX "Website_url_key";

-- DropIndex
DROP INDEX "Website_url_publisherId_key";

-- DropIndex
DROP INDEX "Website_websiteName_key";

-- AlterTable
ALTER TABLE "AdInventory" ADD COLUMN     "websiteId" UUID;

-- AlterTable
ALTER TABLE "BidRequest" ADD COLUMN     "websiteId" UUID;

-- AlterTable
ALTER TABLE "BidResponse" ADD COLUMN     "clickTrackingUrl" TEXT,
ADD COLUMN     "impressionTrackingUrl" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "ageMax" INTEGER,
ADD COLUMN     "ageMin" INTEGER,
ADD COLUMN     "deviceTypes" TEXT[],
ADD COLUMN     "genders" TEXT[],
ADD COLUMN     "locations" TEXT[],
ALTER COLUMN "clientId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ContentCategory" DROP COLUMN "parentId",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Creative" DROP COLUMN "inventoryId",
ADD COLUMN     "contentSafetyThreshold" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Publisher" DROP COLUMN "domain";

-- AlterTable
ALTER TABLE "Website" DROP COLUMN "url",
DROP COLUMN "websiteName",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT NOT NULL,
ADD COLUMN     "initScript" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL;

-- DropTable
DROP TABLE "CampaignInventory";

-- DropTable
DROP TABLE "Click";

-- DropTable
DROP TABLE "Impression";

-- DropTable
DROP TABLE "InventoryAvailability";

-- DropTable
DROP TABLE "InventoryBlockedAdvertiser";

-- DropTable
DROP TABLE "InventoryCategory";

-- DropTable
DROP TABLE "PublisherCategory";

-- DropTable
DROP TABLE "PublisherLanguage";

-- DropTable
DROP TABLE "_AdInventoryToWebsite";

-- CreateTable
CREATE TABLE "CampaignBudgetTracker" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "totalBudget" DECIMAL(10,2) NOT NULL,
    "dailyBudget" DECIMAL(10,2) NOT NULL,
    "spentToday" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remainingBudget" DECIMAL(10,2) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBudgetTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSlotTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" "InventoryFormat" NOT NULL,
    "position" "InventoryPosition" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSlotTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" "UserType" NOT NULL,
    "type" "PaymentType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "cardExpiry" TEXT,
    "bankName" TEXT,
    "accountLast4" TEXT,
    "ifscCode" TEXT,
    "upiId" TEXT,
    "gatewayCustomerId" TEXT,
    "gatewayMethodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" "UserType" NOT NULL,
    "paymentMethodId" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "TransactionStatus" NOT NULL,
    "description" TEXT,
    "gatewayTransactionId" TEXT,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "campaignId" UUID,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" "UserType" NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignBudgetTracker_campaignId_date_key" ON "CampaignBudgetTracker"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCategory_name_key" ON "ContentCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Website_domain_key" ON "Website"("domain");

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetTracker" ADD CONSTRAINT "CampaignBudgetTracker_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInventory" ADD CONSTRAINT "AdInventory_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
