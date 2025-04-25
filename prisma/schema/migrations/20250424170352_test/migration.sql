-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "hqLocation" TEXT NOT NULL,
    "companySize" "AdvertiserCompanySize" NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "companyGSTIN" TEXT NOT NULL,
    "PAN" TEXT NOT NULL,
    "CIN" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
