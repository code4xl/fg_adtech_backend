/*
  Warnings:

  - You are about to drop the column `buyerTargeting` on the `FloorPrice` table. All the data in the column will be lost.
  - You are about to drop the column `timeTargeting` on the `FloorPrice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FloorPrice" DROP COLUMN "buyerTargeting",
DROP COLUMN "timeTargeting";
