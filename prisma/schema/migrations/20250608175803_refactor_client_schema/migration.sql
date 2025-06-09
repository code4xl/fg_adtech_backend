/*
  Warnings:

  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_advertiserId_fkey";

-- DropTable
DROP TABLE "Client";

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "hqLocation" TEXT NOT NULL,
    "companySize" "CompanySize" NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "companyGSTIN" TEXT NOT NULL,
    "PAN" TEXT NOT NULL,
    "CIN" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "advertiserId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_campaigns" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID NOT NULL,

    CONSTRAINT "client_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_mobile_key" ON "clients"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "clients_companyGSTIN_key" ON "clients"("companyGSTIN");

-- CreateIndex
CREATE UNIQUE INDEX "clients_PAN_key" ON "clients"("PAN");

-- CreateIndex
CREATE UNIQUE INDEX "clients_CIN_key" ON "clients"("CIN");

-- CreateIndex
CREATE UNIQUE INDEX "client_campaigns_clientId_campaignId_key" ON "client_campaigns"("clientId", "campaignId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_campaigns" ADD CONSTRAINT "client_campaigns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_campaigns" ADD CONSTRAINT "client_campaigns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_campaigns" ADD CONSTRAINT "client_campaigns_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
