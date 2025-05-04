/*
  Warnings:

  - The values [BROWSER,OS,AUDIENCE] on the enum `TargetingRuleType` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `endDate` on table `Campaign` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TargetingRuleType_new" AS ENUM ('DEMOGRAPHIC', 'GEOGRAPHIC', 'DEVICE', 'CONTEXTUAL', 'BEHAVIORAL', 'TIME', 'FREQUENCY');
ALTER TABLE "CampaignTargetingRule" ALTER COLUMN "ruleType" TYPE "TargetingRuleType_new" USING ("ruleType"::text::"TargetingRuleType_new");
ALTER TABLE "InventoryTargetingRule" ALTER COLUMN "ruleType" TYPE "TargetingRuleType_new" USING ("ruleType"::text::"TargetingRuleType_new");
ALTER TYPE "TargetingRuleType" RENAME TO "TargetingRuleType_old";
ALTER TYPE "TargetingRuleType_new" RENAME TO "TargetingRuleType";
DROP TYPE "TargetingRuleType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "endDate" SET NOT NULL;
