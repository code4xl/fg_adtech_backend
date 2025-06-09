/*
  Warnings:

  - You are about to drop the column `resetToken` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenExpiry` on the `clients` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[resetPasswordToken]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "resetToken",
DROP COLUMN "resetTokenExpiry",
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_resetPasswordToken_key" ON "clients"("resetPasswordToken");
