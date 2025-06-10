/*
  Warnings:

  - You are about to drop the column `syncedToTimestream` on the `ClickEvent` table. All the data in the column will be lost.
  - You are about to drop the `TimestreamSyncLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "ClickEvent_syncedToTimestream_idx";

-- AlterTable
ALTER TABLE "ClickEvent" DROP COLUMN "syncedToTimestream",
ADD COLUMN     "syncedToTimescale" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "TimestreamSyncLog";

-- CreateTable
CREATE TABLE "TimescaleSyncLog" (
    "id" UUID NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastSyncTime" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimescaleSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimescaleSyncLog_tableName_lastSyncTime_idx" ON "TimescaleSyncLog"("tableName", "lastSyncTime");

-- CreateIndex
CREATE INDEX "ClickEvent_syncedToTimescale_idx" ON "ClickEvent"("syncedToTimescale");
