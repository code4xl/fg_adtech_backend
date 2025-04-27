-- CreateTable
CREATE TABLE "Click" (
    "id" UUID NOT NULL,
    "impressionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_impressionId_fkey" FOREIGN KEY ("impressionId") REFERENCES "Impression"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
