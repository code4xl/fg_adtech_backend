/*
  Warnings:

  - You are about to drop the `RTBCache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RTBMetrics` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `campaignBudgetId` on table `Campaign` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_campaignBudgetId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "campaignBudgetId" SET NOT NULL;

-- DropTable
DROP TABLE "RTBCache";

-- DropTable
DROP TABLE "RTBMetrics";

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_campaignBudgetId_fkey" FOREIGN KEY ("campaignBudgetId") REFERENCES "CampaignBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
