/*
  Warnings:

  - The `purchaseIntent` column on the `BehavioralTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lifestyleSegments` column on the `BehavioralTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `purchaseFrequency` column on the `BehavioralTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pageTypes` column on the `ContextualTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `brandSafety` column on the `ContextualTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `incomeMax` on the `DemographicTargeting` table. All the data in the column will be lost.
  - You are about to drop the column `incomeMin` on the `DemographicTargeting` table. All the data in the column will be lost.
  - The `genders` column on the `DemographicTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `education` column on the `DemographicTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deviceTypes` column on the `DeviceTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `operatingSystems` column on the `DeviceTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `browsers` column on the `DeviceTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `connectionTypes` column on the `DeviceTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `scopeLevel` on the `FrequencyTargeting` table. All the data in the column will be lost.
  - You are about to drop the column `timeWindowHours` on the `FrequencyTargeting` table. All the data in the column will be lost.
  - You are about to drop the column `holidays` on the `TimeTargeting` table. All the data in the column will be lost.
  - You are about to drop the column `workingDays` on the `TimeTargeting` table. All the data in the column will be lost.
  - The `daysOfWeek` column on the `TimeTargeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `frequencyScope` to the `FrequencyTargeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequencyWindow` to the `FrequencyTargeting` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "Education" AS ENUM ('HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'PHD', 'PROFESSIONAL_DEGREE', 'TECHNICAL_CERTIFICATION');

-- CreateEnum
CREATE TYPE "IncomeRange" AS ENUM ('BELOW_25K', 'RANGE_25K_50K', 'RANGE_50K_100K', 'RANGE_100K_200K', 'RANGE_200K_500K', 'ABOVE_500K');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'SMART_TV', 'GAMING_CONSOLE', 'WEARABLE');

-- CreateEnum
CREATE TYPE "OperatingSystem" AS ENUM ('ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'LINUX', 'CHROME_OS', 'KINDLE_OS', 'FIRE_OS');

-- CreateEnum
CREATE TYPE "BrowserType" AS ENUM ('CHROME', 'FIREFOX', 'SAFARI', 'EDGE', 'OPERA', 'BRAVE', 'SAMSUNG_INTERNET', 'UC_BROWSER', 'OTHER');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('WIFI', 'CELLULAR_2G', 'CELLULAR_3G', 'CELLULAR_4G', 'CELLULAR_5G', 'ETHERNET', 'FIBER', 'DSL', 'SATELLITE');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOMEPAGE', 'ARTICLE', 'PRODUCT', 'CATEGORY', 'CHECKOUT', 'SEARCH_RESULTS', 'USER_PROFILE', 'CONTACT', 'ABOUT', 'BLOG', 'NEWS', 'GALLERY');

-- CreateEnum
CREATE TYPE "BrandSafety" AS ENUM ('SAFE', 'MODERATE', 'ADULT_CONTENT', 'UNSAFE');

-- CreateEnum
CREATE TYPE "PurchaseIntent" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'RESEARCH_PHASE', 'READY_TO_BUY');

-- CreateEnum
CREATE TYPE "LifestyleSegment" AS ENUM ('FITNESS_ENTHUSIAST', 'TECH_SAVVY', 'FAMILY_ORIENTED', 'BUDGET_CONSCIOUS', 'LUXURY_SHOPPER', 'ECO_CONSCIOUS', 'EARLY_ADOPTER', 'HEALTH_CONSCIOUS', 'TRAVEL_ENTHUSIAST', 'FOODIE', 'GAMING_ENTHUSIAST', 'FASHION_FORWARD');

-- CreateEnum
CREATE TYPE "PurchaseFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'RARELY', 'FIRST_TIME_BUYER');

-- CreateEnum
CREATE TYPE "SessionEngagement" AS ENUM ('HIGH_ENGAGEMENT', 'MEDIUM_ENGAGEMENT', 'LOW_ENGAGEMENT', 'BOUNCE');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('EARLY_MORNING', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'LATE_NIGHT');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL_HOLIDAYS', 'RELIGIOUS_HOLIDAYS', 'SHOPPING_HOLIDAYS', 'SEASONAL_HOLIDAYS', 'LOCAL_HOLIDAYS');

-- CreateEnum
CREATE TYPE "FrequencyScope" AS ENUM ('CAMPAIGN', 'CREATIVE', 'ADVERTISER', 'AD_GROUP', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "FrequencyWindow" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('IN', 'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG', 'AE');

-- CreateEnum
CREATE TYPE "IndianState" AS ENUM ('ANDHRA_PRADESH', 'ARUNACHAL_PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL_PRADESH', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA_PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL_NADU', 'TELANGANA', 'TRIPURA', 'UTTAR_PRADESH', 'UTTARAKHAND', 'WEST_BENGAL', 'ANDAMAN_AND_NICOBAR', 'CHANDIGARH', 'DADRA_AND_NAGAR_HAVELI_AND_DAMAN_AND_DIU', 'DELHI', 'JAMMU_AND_KASHMIR', 'LADAKH', 'LAKSHADWEEP', 'PUDUCHERRY');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('LOOKALIKE', 'CUSTOM', 'INTEREST_BASED', 'BEHAVIORAL', 'DEMOGRAPHIC', 'RETARGETING', 'SIMILAR_TO_CONVERTERS');

-- CreateEnum
CREATE TYPE "UserSegment" AS ENUM ('NEW_VISITORS', 'RETURNING_VISITORS', 'LOYAL_CUSTOMERS', 'HIGH_VALUE_CUSTOMERS', 'CART_ABANDONERS', 'RECENT_PURCHASERS', 'INACTIVE_USERS', 'MOBILE_USERS', 'DESKTOP_USERS');

-- DropIndex
DROP INDEX "GeographicTargeting_cities_idx";

-- AlterTable
ALTER TABLE "BehavioralTargeting" ADD COLUMN     "audienceTypes" "AudienceType"[],
ADD COLUMN     "sessionEngagement" "SessionEngagement"[],
ADD COLUMN     "userSegments" "UserSegment"[],
DROP COLUMN "purchaseIntent",
ADD COLUMN     "purchaseIntent" "PurchaseIntent"[],
DROP COLUMN "lifestyleSegments",
ADD COLUMN     "lifestyleSegments" "LifestyleSegment"[],
DROP COLUMN "purchaseFrequency",
ADD COLUMN     "purchaseFrequency" "PurchaseFrequency"[];

-- AlterTable
ALTER TABLE "ContextualTargeting" DROP COLUMN "pageTypes",
ADD COLUMN     "pageTypes" "PageType"[],
DROP COLUMN "brandSafety",
ADD COLUMN     "brandSafety" "BrandSafety"[];

-- AlterTable
ALTER TABLE "DemographicTargeting" DROP COLUMN "incomeMax",
DROP COLUMN "incomeMin",
ADD COLUMN     "incomeRange" "IncomeRange"[],
DROP COLUMN "genders",
ADD COLUMN     "genders" "Gender"[],
DROP COLUMN "education",
ADD COLUMN     "education" "Education"[];

-- AlterTable
ALTER TABLE "DeviceTargeting" DROP COLUMN "deviceTypes",
ADD COLUMN     "deviceTypes" "DeviceType"[],
DROP COLUMN "operatingSystems",
ADD COLUMN     "operatingSystems" "OperatingSystem"[],
DROP COLUMN "browsers",
ADD COLUMN     "browsers" "BrowserType"[],
DROP COLUMN "connectionTypes",
ADD COLUMN     "connectionTypes" "ConnectionType"[];

-- AlterTable
ALTER TABLE "FrequencyTargeting" DROP COLUMN "scopeLevel",
DROP COLUMN "timeWindowHours",
ADD COLUMN     "customTimeWindowHours" INTEGER,
ADD COLUMN     "frequencyScope" "FrequencyScope" NOT NULL,
ADD COLUMN     "frequencyWindow" "FrequencyWindow" NOT NULL;

-- AlterTable
ALTER TABLE "TimeTargeting" DROP COLUMN "holidays",
DROP COLUMN "workingDays",
ADD COLUMN     "holidayTypes" "HolidayType"[],
ADD COLUMN     "includeHolidays" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timeSlots" "TimeSlot"[],
ADD COLUMN     "workingDaysOnly" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "daysOfWeek",
ADD COLUMN     "daysOfWeek" "DayOfWeek"[];

-- DropEnum
DROP TYPE "TargetingRuleType";

-- CreateIndex
CREATE INDEX "DeviceTargeting_deviceTypes_idx" ON "DeviceTargeting"("deviceTypes");
