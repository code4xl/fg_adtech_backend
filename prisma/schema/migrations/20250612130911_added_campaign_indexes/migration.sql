-- CreateIndex
CREATE INDEX "Campaign_startDate_idx" ON "Campaign"("startDate");

-- CreateIndex
CREATE INDEX "Campaign_endDate_idx" ON "Campaign"("endDate");

-- CreateIndex
CREATE INDEX "Campaign_advertiserId_idx" ON "Campaign"("advertiserId");

-- CreateIndex
CREATE INDEX "Campaign_clientId_idx" ON "Campaign"("clientId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_businessCategory_idx" ON "Campaign"("businessCategory");

-- CreateIndex
CREATE INDEX "Campaign_objective_idx" ON "Campaign"("objective");

-- CreateIndex
CREATE INDEX "Campaign_bidStrategy_idx" ON "Campaign"("bidStrategy");

-- CreateIndex
CREATE INDEX "Campaign_pacing_idx" ON "Campaign"("pacing");

-- CreateIndex
CREATE INDEX "Campaign_status_startDate_endDate_idx" ON "Campaign"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Campaign_advertiserId_status_idx" ON "Campaign"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_campaignId_idx" ON "CampaignBudgetTracker"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_date_idx" ON "CampaignBudgetTracker"("date");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_isExhausted_idx" ON "CampaignBudgetTracker"("isExhausted");

-- CreateIndex
CREATE INDEX "CampaignBudgetTracker_isExhausted_date_idx" ON "CampaignBudgetTracker"("isExhausted", "date");

-- CreateIndex
CREATE INDEX "CampaignStatistics_campaignId_idx" ON "CampaignStatistics"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignStatistics_date_idx" ON "CampaignStatistics"("date");
