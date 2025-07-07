/*
  Warnings:

  - The values [COST_CAP,BID_CAP,TARGET_COST] on the enum `BidStrategy` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BidStrategy_new" AS ENUM ('LOWEST_COST');
ALTER TABLE "Campaign" ALTER COLUMN "bidStrategy" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "bidStrategy" TYPE "BidStrategy_new" USING ("bidStrategy"::text::"BidStrategy_new");
ALTER TYPE "BidStrategy" RENAME TO "BidStrategy_old";
ALTER TYPE "BidStrategy_new" RENAME TO "BidStrategy";
DROP TYPE "BidStrategy_old";
ALTER TABLE "Campaign" ALTER COLUMN "bidStrategy" SET DEFAULT 'LOWEST_COST';
COMMIT;
