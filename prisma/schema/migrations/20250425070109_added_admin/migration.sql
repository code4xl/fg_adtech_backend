/*
  Warnings:

  - The primary key for the `Advertiser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Publisher` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Advertiser` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Publisher` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Advertiser" DROP CONSTRAINT "Advertiser_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Publisher" DROP CONSTRAINT "Publisher_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "rememberToken" TEXT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
