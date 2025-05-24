-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('ONE_TO_TEN', 'ELEVEN_TO_FIFTY', 'FIFTY_ONE_TO_TWO_HUNDRED', 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED', 'FIVE_HUNDRED_ONE_TO_ONE_THOUSAND', 'ONE_THOUSAND_AND_ABOVE');

-- CreateEnum
CREATE TYPE "InventoryFormat" AS ENUM ('BANNER', 'NATIVE', 'VIDEO', 'INTERSTITIAL', 'REWARDED');

-- CreateEnum
CREATE TYPE "InventoryPosition" AS ENUM ('ABOVE_FOLD', 'BELOW_FOLD', 'SIDEBAR', 'FOOTER', 'HEADER', 'IN_CONTENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TargetingRuleType" AS ENUM ('DEMOGRAPHIC', 'GEOGRAPHIC', 'DEVICE', 'CONTEXTUAL', 'BEHAVIORAL', 'TIME', 'FREQUENCY');

-- CreateEnum
CREATE TYPE "PublisherStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'DAILY_PAUSED', 'PAUSED', 'COMPLETED', 'CANCELED', 'REJECTED', 'BUDGET_EXHAUSTED');

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION');

-- CreateEnum
CREATE TYPE "CampaignPacing" AS ENUM ('STANDARD', 'ACCELERATED');

-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('AUTOMOTIVE', 'BEAUTY', 'BUSINESS_SERVICES', 'CONSUMER_ELECTRONICS', 'EDUCATION', 'FINANCE', 'FOOD_AND_BEVERAGE', 'HEALTH_AND_FITNESS', 'HOME_AND_GARDEN', 'INSURANCE', 'LEGAL_SERVICES', 'REAL_ESTATE', 'RETAIL', 'TECHNOLOGY', 'TRAVEL_AND_TOURISM');

-- CreateEnum
CREATE TYPE "CampaignInterest" AS ENUM ('ART_AND_ENTERTAINMENT', 'BUSINESS_AND_FINANCE', 'FOOD_AND_DRINK', 'HEALTH_AND_FITNESS', 'HOBBIES_AND_INTERESTS', 'HOME_AND_GARDEN', 'NEWS_AND_MEDIA', 'PERSONAL_CARE_AND_STYLE', 'PETS_AND_ANIMALS', 'SCIENCE_AND_NATURE', 'SPORTS', 'TECHNOLOGY', 'TRAVEL_AND_LOCAL');

-- CreateEnum
CREATE TYPE "BidStrategy" AS ENUM ('LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('IMAGE', 'HTML5', 'VIDEO', 'HTML', 'RICH_MEDIA');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HINDI', 'SPANISH', 'FRENCH', 'GERMAN', 'CHINESE', 'JAPANESE', 'ARABIC', 'MARATHI');

-- CreateEnum
CREATE TYPE "AuctionLogStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'NO_BIDS');

-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('FIRST_PRICE', 'SECOND_PRICE');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ADVERTISER', 'PUBLISHER', 'CLIENT', 'ADMIN');

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
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaVerificationCode" TEXT,
    "mfaCodeExpiry" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "rememberToken" TEXT,
    "mobile" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "hqLocation" TEXT NOT NULL,
    "companySize" "CompanySize" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaVerificationCode" TEXT,
    "mfaCodeExpiry" TIMESTAMP(3),

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "BidRequest" (
    "id" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "inventoryId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "requestTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "floor" DECIMAL(10,4),
    "auctionType" "AuctionType" NOT NULL DEFAULT 'FIRST_PRICE',
    "timeout" INTEGER NOT NULL DEFAULT 200,
    "targeting" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidRequest_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "advertiserId" UUID NOT NULL,
    "clientId" UUID,
    "budget" DECIMAL(10,2) NOT NULL,
    "dailyBudget" DECIMAL(10,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" "CampaignObjective" NOT NULL,
    "bidStrategy" "BidStrategy" NOT NULL DEFAULT 'LOWEST_COST',
    "bidAmount" DECIMAL(10,2),
    "pacing" "CampaignPacing" NOT NULL DEFAULT 'STANDARD',
    "businessCategory" "BusinessCategory" NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "interests" "CampaignInterest"[],
    "audienceCSV" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Click" (
    "id" UUID NOT NULL,
    "impressionId" UUID NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "referrer" TEXT,
    "clickTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "mobile" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "hqLocation" TEXT NOT NULL,
    "companySize" "CompanySize" NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "companyGSTIN" TEXT NOT NULL,
    "PAN" TEXT NOT NULL,
    "CIN" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "advertiserId" UUID,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Creative" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "s3Key" TEXT,
    "landingUrl" TEXT NOT NULL,
    "status" "CreativeStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "HourlyMetrics" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "inventoryId" UUID,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,4) NOT NULL,
    "revenue" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "HourlyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impression" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "bidResponseId" UUID,
    "publisherId" UUID NOT NULL,
    "advertiserId" UUID NOT NULL,
    "revenue" DECIMAL(10,6) NOT NULL,
    "cost" DECIMAL(10,6) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "viewable" BOOLEAN NOT NULL DEFAULT false,
    "viewableDuration" INTEGER,
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

-- CreateTable
CREATE TABLE "PublisherCategory" (
    "publisherId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherCategory_pkey" PRIMARY KEY ("publisherId","categoryId")
);

-- CreateTable
CREATE TABLE "PublisherLanguage" (
    "publisherId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherLanguage_pkey" PRIMARY KEY ("publisherId","language")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" "UserType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "rememberToken" TEXT,
    "domain" TEXT,
    "status" "PublisherStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaVerificationCode" TEXT,
    "mfaCodeExpiry" TIMESTAMP(3),

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpressionTrack" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creativeId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "bidRequestId" UUID,
    "bidResponseId" UUID,
    "price" DECIMAL(10,4),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "viewable" BOOLEAN,
    "viewTime" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "ImpressionTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickTrack" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creativeId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "publisherId" UUID NOT NULL,
    "impressionTrackId" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "browserType" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ClickTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyStats" (
    "id" UUID NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "publisherId" UUID,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION,
    "cpc" DECIMAL(10,4),
    "ecpm" DECIMAL(10,4),

    CONSTRAINT "HourlyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" UUID,
    "inventoryId" UUID,
    "publisherId" UUID,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ecpm" DECIMAL(10,4) NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_email_key" ON "Advertiser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_mobile_key" ON "Advertiser"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_verificationToken_key" ON "Advertiser"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_resetPasswordToken_key" ON "Advertiser"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLog_winningBidId_key" ON "AuctionLog"("winningBidId");

-- CreateIndex
CREATE UNIQUE INDEX "BidRequest_requestId_key" ON "BidRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStatistics_campaignId_date_key" ON "CampaignStatistics"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyMetrics_campaignId_inventoryId_date_hour_key" ON "HourlyMetrics"("campaignId", "inventoryId", "date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAvailability_inventoryId_date_key" ON "InventoryAvailability"("inventoryId", "date");

-- CreateIndex
CREATE INDEX "Notification_userId_userType_idx" ON "Notification"("userId", "userType");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_email_key" ON "Publisher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_verificationToken_key" ON "Publisher"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_resetPasswordToken_key" ON "Publisher"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "ImpressionTrack_timestamp_idx" ON "ImpressionTrack"("timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_campaignId_timestamp_idx" ON "ImpressionTrack"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_inventoryId_timestamp_idx" ON "ImpressionTrack"("inventoryId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_publisherId_timestamp_idx" ON "ImpressionTrack"("publisherId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_creativeId_campaignId_timestamp_idx" ON "ImpressionTrack"("creativeId", "campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_inventoryId_publisherId_timestamp_idx" ON "ImpressionTrack"("inventoryId", "publisherId", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_country_region_timestamp_idx" ON "ImpressionTrack"("country", "region", "timestamp");

-- CreateIndex
CREATE INDEX "ImpressionTrack_deviceType_timestamp_idx" ON "ImpressionTrack"("deviceType", "timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_timestamp_idx" ON "ClickTrack"("timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_campaignId_timestamp_idx" ON "ClickTrack"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_inventoryId_timestamp_idx" ON "ClickTrack"("inventoryId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_publisherId_timestamp_idx" ON "ClickTrack"("publisherId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_creativeId_campaignId_timestamp_idx" ON "ClickTrack"("creativeId", "campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ClickTrack_country_timestamp_idx" ON "ClickTrack"("country", "timestamp");

-- CreateIndex
CREATE INDEX "HourlyStats_hour_idx" ON "HourlyStats"("hour");

-- CreateIndex
CREATE INDEX "HourlyStats_campaignId_hour_idx" ON "HourlyStats"("campaignId", "hour");

-- CreateIndex
CREATE INDEX "HourlyStats_inventoryId_hour_idx" ON "HourlyStats"("inventoryId", "hour");

-- CreateIndex
CREATE INDEX "HourlyStats_publisherId_hour_idx" ON "HourlyStats"("publisherId", "hour");

-- CreateIndex
CREATE INDEX "HourlyStats_hour_campaignId_inventoryId_idx" ON "HourlyStats"("hour", "campaignId", "inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyStats_hour_campaignId_inventoryId_publisherId_key" ON "HourlyStats"("hour", "campaignId", "inventoryId", "publisherId");

-- CreateIndex
CREATE INDEX "DailyStats_date_idx" ON "DailyStats"("date");

-- CreateIndex
CREATE INDEX "DailyStats_campaignId_date_idx" ON "DailyStats"("campaignId", "date");

-- CreateIndex
CREATE INDEX "DailyStats_inventoryId_date_idx" ON "DailyStats"("inventoryId", "date");

-- CreateIndex
CREATE INDEX "DailyStats_publisherId_date_idx" ON "DailyStats"("publisherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_campaignId_inventoryId_publisherId_key" ON "DailyStats"("date", "campaignId", "inventoryId", "publisherId");

-- AddForeignKey
ALTER TABLE "AdInventory" ADD CONSTRAINT "AdInventory_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLog" ADD CONSTRAINT "AuctionLog_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLog" ADD CONSTRAINT "AuctionLog_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "BidResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Click" ADD CONSTRAINT "Click_impressionId_fkey" FOREIGN KEY ("impressionId") REFERENCES "Impression"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPrice" ADD CONSTRAINT "FloorPrice_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyMetrics" ADD CONSTRAINT "HourlyMetrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyMetrics" ADD CONSTRAINT "HourlyMetrics_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_bidResponseId_fkey" FOREIGN KEY ("bidResponseId") REFERENCES "BidResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impression" ADD CONSTRAINT "Impression_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "PublisherCategory" ADD CONSTRAINT "PublisherCategory_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherCategory" ADD CONSTRAINT "PublisherCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherLanguage" ADD CONSTRAINT "PublisherLanguage_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
