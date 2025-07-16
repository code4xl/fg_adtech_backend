-- DropForeignKey
ALTER TABLE "FloorPrice" DROP CONSTRAINT "FloorPrice_inventoryId_fkey";

-- DropIndex
DROP INDEX "FloorPrice_inventoryId_key";

-- AddForeignKey
ALTER TABLE "FloorPrice" ADD CONSTRAINT "FloorPrice_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
