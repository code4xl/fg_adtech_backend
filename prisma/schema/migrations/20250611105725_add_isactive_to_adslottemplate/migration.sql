/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `AdSlotTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AdSlotTemplate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "AdSlotTemplate_name_key" ON "AdSlotTemplate"("name");
