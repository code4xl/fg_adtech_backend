/*
  Warnings:

  - You are about to drop the column `emailVerifiedAt` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `rememberToken` on the `Admin` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "emailVerifiedAt",
DROP COLUMN "rememberToken";
