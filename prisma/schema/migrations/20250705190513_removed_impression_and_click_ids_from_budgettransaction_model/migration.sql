/*
  Warnings:

  - You are about to drop the column `clickId` on the `BudgetTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `impressionId` on the `BudgetTransaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "BudgetTransaction_clickId_idx";

-- DropIndex
DROP INDEX "BudgetTransaction_impressionId_idx";

-- AlterTable
ALTER TABLE "BudgetTransaction" DROP COLUMN "clickId",
DROP COLUMN "impressionId";
