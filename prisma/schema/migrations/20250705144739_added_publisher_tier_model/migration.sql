/*
  Warnings:

  - You are about to drop the column `tier` on the `Publisher` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Publisher" DROP COLUMN "tier",
ADD COLUMN     "tierId" UUID;

-- DropEnum
DROP TYPE "PublisherTier";

-- CreateTable
CREATE TABLE "PublisherTier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublisherTier_name_key" ON "PublisherTier"("name");

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PublisherTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
