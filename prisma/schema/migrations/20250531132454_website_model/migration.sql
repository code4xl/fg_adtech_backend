-- CreateTable
CREATE TABLE "Website" (
    "id" UUID NOT NULL,
    "url" TEXT,
    "websiteName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publisherId" UUID NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteCategory" (
    "websiteId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteCategory_pkey" PRIMARY KEY ("websiteId","categoryId")
);

-- CreateTable
CREATE TABLE "_AdInventoryToWebsite" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AdInventoryToWebsite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Website_url_key" ON "Website"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Website_websiteName_key" ON "Website"("websiteName");

-- CreateIndex
CREATE UNIQUE INDEX "Website_url_publisherId_key" ON "Website"("url", "publisherId");

-- CreateIndex
CREATE INDEX "_AdInventoryToWebsite_B_index" ON "_AdInventoryToWebsite"("B");

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteCategory" ADD CONSTRAINT "WebsiteCategory_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteCategory" ADD CONSTRAINT "WebsiteCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdInventoryToWebsite" ADD CONSTRAINT "_AdInventoryToWebsite_A_fkey" FOREIGN KEY ("A") REFERENCES "AdInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdInventoryToWebsite" ADD CONSTRAINT "_AdInventoryToWebsite_B_fkey" FOREIGN KEY ("B") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
