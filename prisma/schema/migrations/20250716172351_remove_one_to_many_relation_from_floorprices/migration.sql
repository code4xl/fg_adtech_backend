/*
  Warnings:

  - A unique constraint covering the columns `[inventoryId]` on the table `FloorPrice` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "FloorPrice" DROP CONSTRAINT "FloorPrice_inventoryId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "FloorPrice_inventoryId_key" ON "FloorPrice"("inventoryId");

-- AddForeignKey
ALTER TABLE "FloorPrice" ADD CONSTRAINT "FloorPrice_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
