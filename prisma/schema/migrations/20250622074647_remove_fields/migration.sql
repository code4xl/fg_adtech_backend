/*
  Warnings:

  - You are about to drop the column `clickNumber` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `isFirstClick` on the `ClickEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClickEvent" DROP COLUMN "clickNumber",
DROP COLUMN "isFirstClick";
