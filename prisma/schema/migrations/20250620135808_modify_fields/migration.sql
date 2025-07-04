-- AlterTable
ALTER TABLE "ClickEvent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "ImpressionEvent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "region" TEXT;
