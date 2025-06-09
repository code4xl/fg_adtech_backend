/*
  Warnings:

  - Made the column `clientId` on table `Campaign` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- AlterTable
ALTER TABLE "Advertiser" ADD COLUMN     "status" "AdvertiserStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "clientId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
