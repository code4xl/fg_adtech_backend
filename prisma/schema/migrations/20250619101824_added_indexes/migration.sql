-- CreateIndex
CREATE INDEX "inventory_publisher_idx" ON "AdInventory"("id", "publisherId");

-- CreateIndex
CREATE INDEX "inventory_template_active_idx" ON "AdInventory"("adSlotTemplateId", "isActive");

-- CreateIndex
CREATE INDEX "inventory_eligible_idx" ON "AdInventory"("publisherId", "isActive", "approvalStatus");

-- CreateIndex
CREATE INDEX "AdSlotTemplate_width_height_format_idx" ON "AdSlotTemplate"("width", "height", "format");

-- CreateIndex
CREATE INDEX "AdSlotTemplate_format_width_height_idx" ON "AdSlotTemplate"("format", "width", "height");

-- CreateIndex
CREATE INDEX "Advertiser_id_status_idx" ON "Advertiser"("id", "status");

-- CreateIndex
CREATE INDEX "Advertiser_status_idx" ON "Advertiser"("status");

-- CreateIndex
CREATE INDEX "Campaign_status_startDate_endDate_idx" ON "Campaign"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Campaign_status_advertiserId_idx" ON "Campaign"("status", "advertiserId");

-- CreateIndex
CREATE INDEX "Campaign_id_status_idx" ON "Campaign"("id", "status");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_campaignId_date_idx" ON "CampaignBudgetTracker"("campaignId", "date");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_date_campaignId_idx" ON "CampaignBudgetTracker"("date", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_campaignId_idx" ON "CampaignBudgetTracker"("campaignId");

-- CreateIndex
CREATE INDEX "Creative_campaignId_status_idx" ON "Creative"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Creative_templateId_status_idx" ON "Creative"("templateId", "status");

-- CreateIndex
CREATE INDEX "Creative_status_campaignId_templateId_idx" ON "Creative"("status", "campaignId", "templateId");

-- CreateIndex
CREATE INDEX "DemographicTargeting_ageMin_ageMax_campaignId_idx" ON "DemographicTargeting"("ageMin", "ageMax", "campaignId");

-- CreateIndex
CREATE INDEX "DeviceTargeting_deviceTypes_campaignId_idx" ON "DeviceTargeting"("deviceTypes", "campaignId");

-- CreateIndex
CREATE INDEX "GeographicTargeting_countries_campaignId_idx" ON "GeographicTargeting"("countries", "campaignId");

-- CreateIndex
CREATE INDEX "Publisher_id_status_idx" ON "Publisher"("id", "status");

-- CreateIndex
CREATE INDEX "Publisher_status_idx" ON "Publisher"("status");

-- CreateIndex
CREATE INDEX "RTBMetrics_bidRequestId_timestamp_idx" ON "RTBMetrics"("bidRequestId", "timestamp");

-- CreateIndex
CREATE INDEX "RTBMetrics_timestamp_auctionLatency_idx" ON "RTBMetrics"("timestamp", "auctionLatency");

-- CreateIndex
CREATE INDEX "TimeTargeting_daysOfWeek_campaignId_idx" ON "TimeTargeting"("daysOfWeek", "campaignId");
