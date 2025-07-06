/*
  Warnings:

  - You are about to alter the column `cpi` on the `BidResponse` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,10)`.

*/
-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'RESERVATION';

-- AlterTable
ALTER TABLE "BidResponse" ALTER COLUMN "cpi" SET DATA TYPE DECIMAL(10,10);
