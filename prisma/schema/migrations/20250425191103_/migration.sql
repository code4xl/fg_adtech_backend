/*
  Warnings:

  - The primary key for the `Client` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `CIN` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `PAN` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `companyGSTIN` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `Client` table. All the data in the column will be lost.
  - The `id` column on the `Client` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[mobile]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `companySize` on the `Advertiser` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `advertiserId` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `companySize` on the `Client` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('ONE_TO_TEN', 'ELEVEN_TO_FIFTY', 'FIFTY_ONE_TO_TWO_HUNDRED', 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED', 'FIVE_HUNDRED_ONE_TO_ONE_THOUSAND', 'ONE_THOUSAND_AND_ABOVE');

-- AlterTable
ALTER TABLE "Advertiser" DROP COLUMN "companySize",
ADD COLUMN     "companySize" "CompanySize" NOT NULL;

-- AlterTable
ALTER TABLE "Client" DROP CONSTRAINT "Client_pkey",
DROP COLUMN "CIN",
DROP COLUMN "PAN",
DROP COLUMN "companyGSTIN",
DROP COLUMN "website",
ADD COLUMN     "advertiserId" UUID NOT NULL,
ADD COLUMN     "cin" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "pan" TEXT,
DROP COLUMN "companySize",
ADD COLUMN     "companySize" "CompanySize" NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");

-- DropEnum
DROP TYPE "AdvertiserCompanySize";

-- CreateIndex
CREATE UNIQUE INDEX "Client_mobile_key" ON "Client"("mobile");

-- CreateIndex
CREATE INDEX "Client_advertiserId_idx" ON "Client"("advertiserId");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_gstin_idx" ON "Client"("gstin");

-- CreateIndex
CREATE INDEX "Client_pan_idx" ON "Client"("pan");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
