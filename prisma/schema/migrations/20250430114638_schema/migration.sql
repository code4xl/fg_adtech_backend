/*
  Warnings:

  - Added the required column `inventoryId` to the `Creative` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "inventoryId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
