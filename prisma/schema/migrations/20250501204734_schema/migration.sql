-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HINDI', 'SPANISH', 'FRENCH', 'GERMAN', 'CHINESE', 'JAPANESE', 'ARABIC', 'LOVE', 'HATE');

-- CreateTable
CREATE TABLE "PublisherCategory" (
    "publisherId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherCategory_pkey" PRIMARY KEY ("publisherId","categoryId")
);

-- CreateTable
CREATE TABLE "PublisherLanguage" (
    "publisherId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublisherLanguage_pkey" PRIMARY KEY ("publisherId","language")
);

-- AddForeignKey
ALTER TABLE "PublisherCategory" ADD CONSTRAINT "PublisherCategory_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherCategory" ADD CONSTRAINT "PublisherCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherLanguage" ADD CONSTRAINT "PublisherLanguage_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
