/*
  Warnings:

  - You are about to drop the `CampaignTargetingRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryTargetingRule` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `websiteId` on table `BidRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "BidRequest" DROP CONSTRAINT "BidRequest_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignTargetingRule" DROP CONSTRAINT "CampaignTargetingRule_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTargetingRule" DROP CONSTRAINT "InventoryTargetingRule_inventoryId_fkey";

-- AlterTable
ALTER TABLE "BidRequest" ALTER COLUMN "websiteId" SET NOT NULL;

-- DropTable
DROP TABLE "CampaignTargetingRule";

-- DropTable
DROP TABLE "InventoryTargetingRule";

-- CreateTable
CREATE TABLE "DemographicTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "genders" TEXT[],
    "languages" "Language"[],
    "incomeMin" INTEGER,
    "incomeMax" INTEGER,
    "education" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemographicTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeographicTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "countries" TEXT[],
    "states" TEXT[],
    "cities" TEXT[],
    "postalCodes" TEXT[],
    "radius" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isInclude" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeographicTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "deviceTypes" TEXT[],
    "operatingSystems" TEXT[],
    "browsers" TEXT[],
    "connectionTypes" TEXT[],
    "minOSVersion" TEXT,
    "maxOSVersion" TEXT,
    "deviceModels" TEXT[],
    "isInclude" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextualTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "contentCategories" "BusinessCategory"[],
    "keywords" TEXT[],
    "urlPatterns" TEXT[],
    "pageTypes" TEXT[],
    "brandSafety" TEXT[],
    "blockedKeywords" TEXT[],
    "isInclude" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextualTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehavioralTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "interests" "CampaignInterest"[],
    "purchaseIntent" TEXT[],
    "lifestyleSegments" TEXT[],
    "avgOrderValue" DECIMAL(10,2),
    "purchaseFrequency" TEXT,
    "sessionDuration" INTEGER,
    "pageViews" INTEGER,
    "isInclude" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehavioralTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "startHour" INTEGER,
    "endHour" INTEGER,
    "daysOfWeek" INTEGER[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "holidays" BOOLEAN,
    "workingDays" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrequencyTargeting" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "maxImpressions" INTEGER NOT NULL,
    "timeWindowHours" INTEGER NOT NULL,
    "maxClicksPerUser" INTEGER,
    "minTimeBetween" INTEGER,
    "scopeLevel" TEXT NOT NULL DEFAULT 'campaign',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrequencyTargeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemographicTargeting_campaignId_idx" ON "DemographicTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "DemographicTargeting_inventoryId_idx" ON "DemographicTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "DemographicTargeting_ageMin_ageMax_idx" ON "DemographicTargeting"("ageMin", "ageMax");

-- CreateIndex
CREATE INDEX "GeographicTargeting_campaignId_idx" ON "GeographicTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "GeographicTargeting_inventoryId_idx" ON "GeographicTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "GeographicTargeting_countries_idx" ON "GeographicTargeting"("countries");

-- CreateIndex
CREATE INDEX "GeographicTargeting_cities_idx" ON "GeographicTargeting"("cities");

-- CreateIndex
CREATE INDEX "DeviceTargeting_campaignId_idx" ON "DeviceTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "DeviceTargeting_inventoryId_idx" ON "DeviceTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "DeviceTargeting_deviceTypes_idx" ON "DeviceTargeting"("deviceTypes");

-- CreateIndex
CREATE INDEX "ContextualTargeting_campaignId_idx" ON "ContextualTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "ContextualTargeting_inventoryId_idx" ON "ContextualTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "ContextualTargeting_contentCategories_idx" ON "ContextualTargeting"("contentCategories");

-- CreateIndex
CREATE INDEX "BehavioralTargeting_campaignId_idx" ON "BehavioralTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "BehavioralTargeting_inventoryId_idx" ON "BehavioralTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "BehavioralTargeting_interests_idx" ON "BehavioralTargeting"("interests");

-- CreateIndex
CREATE INDEX "TimeTargeting_campaignId_idx" ON "TimeTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "TimeTargeting_inventoryId_idx" ON "TimeTargeting"("inventoryId");

-- CreateIndex
CREATE INDEX "TimeTargeting_startHour_endHour_idx" ON "TimeTargeting"("startHour", "endHour");

-- CreateIndex
CREATE INDEX "FrequencyTargeting_campaignId_idx" ON "FrequencyTargeting"("campaignId");

-- CreateIndex
CREATE INDEX "FrequencyTargeting_inventoryId_idx" ON "FrequencyTargeting"("inventoryId");

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemographicTargeting" ADD CONSTRAINT "DemographicTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemographicTargeting" ADD CONSTRAINT "DemographicTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeographicTargeting" ADD CONSTRAINT "GeographicTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeographicTargeting" ADD CONSTRAINT "GeographicTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTargeting" ADD CONSTRAINT "DeviceTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTargeting" ADD CONSTRAINT "DeviceTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextualTargeting" ADD CONSTRAINT "ContextualTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextualTargeting" ADD CONSTRAINT "ContextualTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralTargeting" ADD CONSTRAINT "BehavioralTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralTargeting" ADD CONSTRAINT "BehavioralTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTargeting" ADD CONSTRAINT "TimeTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTargeting" ADD CONSTRAINT "TimeTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrequencyTargeting" ADD CONSTRAINT "FrequencyTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrequencyTargeting" ADD CONSTRAINT "FrequencyTargeting_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
