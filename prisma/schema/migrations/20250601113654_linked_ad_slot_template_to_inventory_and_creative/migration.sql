/*
  Warnings:

  - You are about to drop the column `format` on the `AdInventory` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `AdInventory` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `AdInventory` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `AdInventory` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `AdSlotTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Creative` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Creative` table. All the data in the column will be lost.
  - Added the required column `adSlotTemplateId` to the `AdInventory` table without a default value. This is not possible if the table is not empty.
  - Made the column `websiteId` on table `AdInventory` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `templateId` to the `Creative` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AdInventory" DROP CONSTRAINT "AdInventory_websiteId_fkey";

-- AlterTable
ALTER TABLE "AdInventory" DROP COLUMN "format",
DROP COLUMN "height",
DROP COLUMN "position",
DROP COLUMN "width",
ADD COLUMN     "adSlotTemplateId" UUID NOT NULL,
ALTER COLUMN "websiteId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AdSlotTemplate" DROP COLUMN "isActive";

-- AlterTable
ALTER TABLE "Creative" DROP COLUMN "height",
DROP COLUMN "width",
ADD COLUMN     "templateId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AdSlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInventory" ADD CONSTRAINT "AdInventory_adSlotTemplateId_fkey" FOREIGN KEY ("adSlotTemplateId") REFERENCES "AdSlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdInventory" ADD CONSTRAINT "AdInventory_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
