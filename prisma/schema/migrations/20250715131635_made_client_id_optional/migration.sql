-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
