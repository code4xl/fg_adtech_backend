/*
  Warnings:

  - You are about to drop the column `syncedToTimestream` on the `ImpressionEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ImpressionEvent_syncedToTimestream_idx";

-- AlterTable
ALTER TABLE "ImpressionEvent" DROP COLUMN "syncedToTimestream",
ADD COLUMN     "syncedToTimescale" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ImpressionEvent_syncedToTimescale_idx" ON "ImpressionEvent"("syncedToTimescale");
