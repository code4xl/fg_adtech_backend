-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_campaignBudgetId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "campaignBudgetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_campaignBudgetId_fkey" FOREIGN KEY ("campaignBudgetId") REFERENCES "CampaignBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
