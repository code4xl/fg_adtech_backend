/*
  Warnings:

  - You are about to drop the `WebsiteCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WebsiteCategory" DROP CONSTRAINT "WebsiteCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "WebsiteCategory" DROP CONSTRAINT "WebsiteCategory_websiteId_fkey";

-- DropTable
DROP TABLE "WebsiteCategory";

-- CreateTable
CREATE TABLE "_ContentCategoryToWebsite" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ContentCategoryToWebsite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ContentCategoryToWebsite_B_index" ON "_ContentCategoryToWebsite"("B");

-- AddForeignKey
ALTER TABLE "_ContentCategoryToWebsite" ADD CONSTRAINT "_ContentCategoryToWebsite_A_fkey" FOREIGN KEY ("A") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentCategoryToWebsite" ADD CONSTRAINT "_ContentCategoryToWebsite_B_fkey" FOREIGN KEY ("B") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
