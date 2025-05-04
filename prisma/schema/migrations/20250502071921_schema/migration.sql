/*
  Warnings:

  - Added the required column `audienceCSV` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `businessCategory` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `websiteUrl` to the `Campaign` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('AUTOMOTIVE', 'BEAUTY', 'BUSINESS_SERVICES', 'CONSUMER_ELECTRONICS', 'EDUCATION', 'FINANCE', 'FOOD_AND_BEVERAGE', 'HEALTH_AND_FITNESS', 'HOME_AND_GARDEN', 'INSURANCE', 'LEGAL_SERVICES', 'REAL_ESTATE', 'RETAIL', 'TECHNOLOGY', 'TRAVEL_AND_TOURISM');

-- CreateEnum
CREATE TYPE "CampaignInterest" AS ENUM ('ART_AND_ENTERTAINMENT', 'BUSINESS_AND_FINANCE', 'FOOD_AND_DRINK', 'HEALTH_AND_FITNESS', 'HOBBIES_AND_INTERESTS', 'HOME_AND_GARDEN', 'NEWS_AND_MEDIA', 'PERSONAL_CARE_AND_STYLE', 'PETS_AND_ANIMALS', 'SCIENCE_AND_NATURE', 'SPORTS', 'TECHNOLOGY', 'TRAVEL_AND_LOCAL');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "audienceCSV" TEXT NOT NULL,
ADD COLUMN     "businessCategory" "BusinessCategory" NOT NULL,
ADD COLUMN     "interests" "CampaignInterest"[],
ADD COLUMN     "websiteUrl" TEXT NOT NULL;
