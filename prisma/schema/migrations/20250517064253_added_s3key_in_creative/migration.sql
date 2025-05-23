/*
  Warnings:

  - Changed the type of `userId` on the `Notification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "s3Key" TEXT;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_userType_idx" ON "Notification"("userId", "userType");
