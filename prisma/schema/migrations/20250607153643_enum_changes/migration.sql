/*
  Warnings:

  - The values [HEADER_BIDDING] on the enum `AuctionType` will be removed. If these variants are still used in the database, this will fail.
  - The `currency` column on the `BidResponse` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `FloorPrice` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'INR');

-- AlterEnum
BEGIN;
CREATE TYPE "AuctionType_new" AS ENUM ('FIRST_PRICE', 'SECOND_PRICE');
ALTER TABLE "BidRequest" ALTER COLUMN "auctionType" DROP DEFAULT;
ALTER TABLE "AuctionLog" ALTER COLUMN "auctionType" TYPE "AuctionType_new" USING ("auctionType"::text::"AuctionType_new");
ALTER TABLE "BidRequest" ALTER COLUMN "auctionType" TYPE "AuctionType_new" USING ("auctionType"::text::"AuctionType_new");
ALTER TYPE "AuctionType" RENAME TO "AuctionType_old";
ALTER TYPE "AuctionType_new" RENAME TO "AuctionType";
DROP TYPE "AuctionType_old";
ALTER TABLE "BidRequest" ALTER COLUMN "auctionType" SET DEFAULT 'SECOND_PRICE';
COMMIT;

-- AlterTable
ALTER TABLE "BidResponse" DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "FloorPrice" DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'INR';

-- DropEnum
DROP TYPE "FloorPriceCurrency";
