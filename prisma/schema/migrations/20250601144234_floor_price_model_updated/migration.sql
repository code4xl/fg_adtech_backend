/*
  Warnings:

  - Changed the type of `currency` on the `FloorPrice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FloorPriceCurrency" AS ENUM ('USD', 'INR');

-- AlterTable
ALTER TABLE "FloorPrice" DROP COLUMN "currency",
ADD COLUMN     "currency" "FloorPriceCurrency" NOT NULL;
