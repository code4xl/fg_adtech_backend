/*
  Warnings:

  - You are about to drop the column `ageMax` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `ageMin` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `budget` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `dailyBudget` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `deviceTypes` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `genders` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `locations` on the `Campaign` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "ageMax",
DROP COLUMN "ageMin",
DROP COLUMN "budget",
DROP COLUMN "dailyBudget",
DROP COLUMN "deviceTypes",
DROP COLUMN "genders",
DROP COLUMN "locations";
