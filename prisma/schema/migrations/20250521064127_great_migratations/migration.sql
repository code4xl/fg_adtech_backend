/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `Publisher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetPasswordToken]` on the table `Publisher` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "mfaCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaVerificationCode" TEXT;

-- AlterTable
ALTER TABLE "Advertiser" ADD COLUMN     "mfaCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaVerificationCode" TEXT;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "mfaCodeExpiry" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaVerificationCode" TEXT,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "verificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_verificationToken_key" ON "Publisher"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_resetPasswordToken_key" ON "Publisher"("resetPasswordToken");
