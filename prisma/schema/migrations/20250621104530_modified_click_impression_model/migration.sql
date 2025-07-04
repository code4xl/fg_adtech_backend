/*
  Warnings:

  - You are about to drop the column `adSlotId` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `adSlotId` on the `ImpressionEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClickEvent" DROP COLUMN "adSlotId",
ADD COLUMN     "templateId" UUID;

-- AlterTable
ALTER TABLE "ImpressionEvent" DROP COLUMN "adSlotId",
ADD COLUMN     "templateId" UUID;
