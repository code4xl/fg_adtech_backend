/*
  Warnings:

  - You are about to drop the column `entityId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `userRole` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `userType` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ADVERTISER', 'PUBLISHER', 'CLIENT', 'ADMIN');

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_read_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "entityId",
DROP COLUMN "entityType",
DROP COLUMN "priority",
DROP COLUMN "read",
DROP COLUMN "type",
DROP COLUMN "userRole",
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userType" "UserType" NOT NULL;

-- DropEnum
DROP TYPE "NotificationPriority";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE INDEX "Notification_userId_userType_idx" ON "Notification"("userId", "userType");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
