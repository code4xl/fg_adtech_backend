/*
  Warnings:

  - The values [LOVE,HATE] on the enum `Language` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'DAILY_PAUSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreativeType" ADD VALUE 'HTML';
ALTER TYPE "CreativeType" ADD VALUE 'RICH_MEDIA';

-- AlterEnum
BEGIN;
CREATE TYPE "Language_new" AS ENUM ('ENGLISH', 'HINDI', 'SPANISH', 'FRENCH', 'GERMAN', 'CHINESE', 'JAPANESE', 'ARABIC', 'MARATHI');
ALTER TABLE "PublisherLanguage" ALTER COLUMN "language" TYPE "Language_new" USING ("language"::text::"Language_new");
ALTER TYPE "Language" RENAME TO "Language_old";
ALTER TYPE "Language_new" RENAME TO "Language";
DROP TYPE "Language_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_userId_fkey";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "User";
