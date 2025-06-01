/*
  Warnings:

  - The values [SUSPENDED,PENDING] on the enum `PublisherStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PublisherStatus_new" AS ENUM ('ACTIVE', 'DEACTIVATED', 'DELETED');
ALTER TABLE "Publisher" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Publisher" ALTER COLUMN "status" TYPE "PublisherStatus_new" USING ("status"::text::"PublisherStatus_new");
ALTER TYPE "PublisherStatus" RENAME TO "PublisherStatus_old";
ALTER TYPE "PublisherStatus_new" RENAME TO "PublisherStatus";
DROP TYPE "PublisherStatus_old";
ALTER TABLE "Publisher" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
