-- AlterTable
ALTER TABLE "ClickEvent" ADD COLUMN     "clickNumber" INTEGER,
ADD COLUMN     "isFirstClick" BOOLEAN DEFAULT false,
ADD COLUMN     "slotId" VARCHAR(50),
ADD COLUMN     "userFingerprint" VARCHAR(50);

-- AlterTable
ALTER TABLE "ImpressionEvent" ADD COLUMN     "bidPrice" DOUBLE PRECISION,
ADD COLUMN     "slotId" VARCHAR(50),
ADD COLUMN     "userFingerprint" VARCHAR(50);
