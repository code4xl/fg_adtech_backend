/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `Advertiser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetPasswordToken]` on the table `Advertiser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Advertiser" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "verificationToken" TEXT,
ALTER COLUMN "emailVerifiedAt" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_verificationToken_key" ON "Advertiser"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_resetPasswordToken_key" ON "Advertiser"("resetPasswordToken");
