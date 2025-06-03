/*
  Warnings:

  - You are about to drop the column `audienceCSV` on the `Campaign` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AdInventory" ADD COLUMN     "adSlotScript" TEXT;

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "audienceCSV";
