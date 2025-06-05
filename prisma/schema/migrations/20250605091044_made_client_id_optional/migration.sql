-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- AlterTable
ALTER TABLE "AdInventory" ADD COLUMN     "containerHTML" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "cdnURL" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
