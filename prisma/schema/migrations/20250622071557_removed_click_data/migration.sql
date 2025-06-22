/*
  Warnings:

  - You are about to drop the column `clickArea` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `clickX` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the column `clickY` on the `ClickEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClickEvent" DROP COLUMN "clickArea",
DROP COLUMN "clickX",
DROP COLUMN "clickY";
