// // src/rtb/bid-calculation.service.ts -done
// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { BidStrategy } from '@prisma/client';
// // import { PrismaService } from 'src/prisma/prisma.service';

// @Injectable()
// export class BidCalculationService {
//   private readonly logger = new Logger(BidCalculationService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   async calculateBids(eligibleCampaigns, bidRequest) {
//     const bids: any = [];

//     for (const campaign of eligibleCampaigns) {
//       try {
//         // Find the campaign-inventory relationship to get the max bid
//         const campaignInventory = campaign.campaignInventories[0];
//         if (!campaignInventory) continue;

//         // Get the highest performing creative for this campaign and inventory
//         const creative = await this.getOptimalCreative(
//           campaign.id,
//           bidRequest.inventoryId,
//         );
//         if (!creative) continue;

//         // Calculate the base bid using the campaign's bidding strategy
//         const baseBid = await this.calculateBaseBid(
//           campaign,
//           campaignInventory,
//           bidRequest,
//         );

//         // Apply any real-time adjustments to the bid
//         const adjustedBid = await this.applyBidAdjustments(
//           baseBid,
//           campaign,
//           bidRequest,
//           creative,
//         );

//         bids.push({
//           campaignId: campaign.id,
//           creativeId: creative.id,
//           advertiserId: campaign.advertiserId,
//           bidPrice: adjustedBid,
//           creative: creative,
//         });
//       } catch (error) {
//         this.logger.error(
//           `Error calculating bid for campaign ${campaign.id}: ${error.message}`,
//           error.stack,
//         );
//         // Continue with other campaigns
//       }
//     }

//     return bids;
//   }

//   private async getOptimalCreative(campaignId, inventoryId) {
//     const creatives = await this.prisma.creative.findMany({
//       where: {
//         campaignId,
//         inventoryId,
//         status: 'APPROVED',
//       },
//       orderBy: {
//         // If we had CTR data, we could order by that
//         createdAt: 'desc', // For now, just use the most recent
//       },
//       take: 1,
//     });

//     return creatives[0] || null;
//   }

//   private async calculateBaseBid(campaign, campaignInventory, bidRequest) {
//     // Start with the max bid configured for this campaign-inventory pair
//     let baseBid = Number(campaignInventory.maxBid);

//     // Adjust based on bidding strategy
//     switch (campaign.bidStrategy) {
//       case BidStrategy.LOWEST_COST:
//         // Use the floor price or a small increment above it
//         const floorPrice = bidRequest.floor || 0;
//         baseBid = Math.min(baseBid, floorPrice * 1.05); // 5% above floor
//         break;

//       case BidStrategy.BID_CAP:
//         // Never exceed the bid amount
//         baseBid = Math.min(baseBid, Number(campaign.bidAmount || baseBid));
//         break;

//       case BidStrategy.COST_CAP:
//       case BidStrategy.TARGET_COST:
//         // These strategies need historical performance data
//         // For now, just use the configured max bid
//         if (campaign.bidAmount) {
//           // We could adjust based on historical CPA/CPC here
//           baseBid = Number(campaign.bidAmount);
//         }
//         break;

//       default:
//         // Default strategy - just use the max bid
//         break;
//     }

//     return baseBid;
//   }

//   private async applyBidAdjustments(baseBid, campaign, bidRequest, creative) {
//     let adjustedBid = baseBid;

//     // 1. Time-of-day adjustment
//     const timeAdjustment = this.getTimeAdjustment();
//     adjustedBid *= timeAdjustment;

//     // 2. Device type adjustment
//     const deviceAdjustment = this.getDeviceAdjustment(bidRequest.deviceType);
//     adjustedBid *= deviceAdjustment;

//     // 3. Geographic adjustment
//     const geoAdjustment = this.getGeographicAdjustment(
//       bidRequest.country,
//       bidRequest.region,
//       bidRequest.city,
//     );
//     adjustedBid *= geoAdjustment;

//     // 4. Viewability adjustment based on inventory
//     const viewabilityAdjustment = await this.getViewabilityAdjustment(
//       bidRequest.inventoryId,
//       bidRequest.position,
//     );
//     adjustedBid *= viewabilityAdjustment;
//     // 5. Performance history adjustment (CTR-based)
//     const performanceAdjustment = await this.getPerformanceAdjustment(
//       campaign.id,
//       creative.id,
//       bidRequest.inventoryId,
//     );
//     adjustedBid *= performanceAdjustment;

//     // 6. Context relevance adjustment
//     const contextAdjustment = this.getContextAdjustment(
//       campaign,
//       bidRequest.targeting,
//     );
//     adjustedBid *= contextAdjustment;

//     // 7. Bid landscape competitive adjustment
//     const competitiveAdjustment = await this.getCompetitiveAdjustment(
//       bidRequest.inventoryId,
//       bidRequest.format,
//     );
//     adjustedBid *= competitiveAdjustment;

//     // 8. Budget pacing adjustment
//     const pacingAdjustment = await this.getPacingAdjustment(campaign);
//     adjustedBid *= pacingAdjustment;

//     // Round to 4 decimal places and ensure minimum bid
//     return Math.max(0.0001, Math.round(adjustedBid * 10000) / 10000);
//   }

//   // Improved time adjustment considering both hour and day
//   private getTimeAdjustment() {
//     const now = new Date();
//     const hour = now.getHours();
//     const day = now.getDay(); // 0 = Sunday, 6 = Saturday

//     // Weekend adjustment
//     const isWeekend = day === 0 || day === 6;
//     const weekendFactor = isWeekend ? 0.9 : 1.0; // Reduce bids slightly on weekends

//     // Hour-based adjustment (more sophisticated than before)
//     let hourFactor = 1.0;

//     if (hour >= 6 && hour < 9) {
//       // Early morning
//       hourFactor = 0.85;
//     } else if (hour >= 9 && hour < 12) {
//       // Morning peak
//       hourFactor = 1.15;
//     } else if (hour >= 12 && hour < 14) {
//       // Lunch time
//       hourFactor = 1.1;
//     } else if (hour >= 14 && hour < 17) {
//       // Afternoon
//       hourFactor = 1.0;
//     } else if (hour >= 17 && hour < 21) {
//       // Evening peak
//       hourFactor = 1.2;
//     } else if (hour >= 21 && hour < 23) {
//       // Late evening
//       hourFactor = 0.95;
//     } else {
//       // Night (23-6)
//       hourFactor = 0.75;
//     }

//     return hourFactor * weekendFactor;
//   }

//   // Enhanced device adjustment with more device types
//   private getDeviceAdjustment(deviceType) {
//     if (!deviceType) return 1.0;

//     const deviceFactors = {
//       mobile: 1.2, // Higher on mobile
//       tablet: 1.15, // Slightly higher on tablets
//       desktop: 1.0, // Baseline
//       connected_tv: 1.5, // Much higher on CTVs
//       game_console: 1.3, // Higher on game consoles
//     };

//     return deviceFactors[deviceType.toLowerCase()] || 1.0;
//   }

//   // More sophisticated geographic adjustment
//   private getGeographicAdjustment(country, region, city) {
//     if (!country) return 1.0;

//     // Premium countries get higher bids
//     const premiumCountries = ['US', 'GB', 'CA', 'AU', 'DE', 'JP', 'FR', 'IT'];
//     const highValueCountries = ['NL', 'SE', 'NO', 'DK', 'FI', 'CH', 'SG', 'AE'];

//     let countryFactor = 1.0;
//     if (premiumCountries.includes(country)) {
//       countryFactor = 1.2;
//     } else if (highValueCountries.includes(country)) {
//       countryFactor = 1.1;
//     }

//     // Premium cities adjustment
//     const premiumCities = [
//       'New York',
//       'London',
//       'Tokyo',
//       'Paris',
//       'Sydney',
//       'Toronto',
//       'Singapore',
//       'Dubai',
//       'San Francisco',
//       'Mumbai',
//       'Delhi',
//     ];

//     let cityFactor = 1.0;
//     if (city && premiumCities.some((premium) => city.includes(premium))) {
//       cityFactor = 1.15;
//     }

//     // Final geographic adjustment
//     return countryFactor * cityFactor;
//   }

//   // Enhanced viewability adjustment
//   private async getViewabilityAdjustment(inventoryId, position) {
//     // Get inventory viewability score from database
//     const inventory = await this.prisma.adInventory.findUnique({
//       where: { id: inventoryId },
//       select: { viewabilityScore: true, position: true },
//     });

//     let positionFactor = 1.0;
//     // Above-fold positions typically have higher viewability
//     if (position === 'ABOVE_FOLD' || inventory?.position === 'ABOVE_FOLD') {
//       positionFactor = 1.2;
//     } else if (
//       position === 'BELOW_FOLD' ||
//       inventory?.position === 'BELOW_FOLD'
//     ) {
//       positionFactor = 0.9;
//     }

//     // Use inventory's historical viewability if available
//     let viewabilityScore = inventory?.viewabilityScore || 0.5;

//     // Exponential adjustment based on viewability
//     // Higher viewability gets exponentially higher bids
//     return Math.pow(1.5, viewabilityScore) * positionFactor;
//   }

//   // NEW: Performance-based adjustment
//   private async getPerformanceAdjustment(campaignId, creativeId, inventoryId) {
//     // Get historical performance data
//     const stats = await this.prisma.hourlyStats.findMany({
//       where: {
//         campaignId,
//         inventoryId,
//         hour: {
//           gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
//         },
//       },
//       select: {
//         impressions: true,
//         clicks: true,
//       },
//     });

//     if (!stats || stats.length === 0) return 1.0; // No data

//     // Calculate CTR
//     const totalImpressions = stats.reduce(
//       (sum, stat) => sum + stat.impressions,
//       0,
//     );
//     const totalClicks = stats.reduce((sum, stat) => sum + stat.clicks, 0);

//     if (totalImpressions < 100) return 1.0; // Too few impressions for reliable data

//     const ctr = totalClicks / totalImpressions;

//     // Adjust based on CTR performance
//     // Exponential function that rewards high CTR
//     return 0.8 + Math.pow(ctr * 100, 1.5) / 5;
//   }

//   // NEW: Context relevance adjustment
//   private getContextAdjustment(campaign, targetingContext) {
//     if (!targetingContext || !campaign.targetingRules) return 1.0;

//     let contextRelevanceScore = 0;
//     let maxPossibleScore = 0;

//     // Find contextual targeting rules
//     const contextRules = campaign.targetingRules.filter(
//       (rule) => rule.ruleType === 'CONTEXTUAL',
//     );

//     if (contextRules.length === 0) return 1.0;

//     for (const rule of contextRules) {
//       const ruleData = rule.ruleData;

//       // Check for keyword matches
//       if (ruleData.keywords && targetingContext.context) {
//         const keywordMatches = ruleData.keywords.filter((keyword) =>
//           targetingContext.context
//             .toLowerCase()
//             .includes(keyword.toLowerCase()),
//         ).length;

//         contextRelevanceScore += keywordMatches;
//         maxPossibleScore += ruleData.keywords.length;
//       }

//       // Check for category matches
//       if (ruleData.categories && targetingContext.categories) {
//         const categoryMatches = ruleData.categories.filter((category) =>
//           targetingContext.categories.includes(category),
//         ).length;

//         contextRelevanceScore += categoryMatches * 2; // Categories are weighted higher
//         maxPossibleScore += ruleData.categories.length * 2;
//       }
//     }

//     if (maxPossibleScore === 0) return 1.0;

//     // Calculate normalized relevance score (0-1)
//     const normalizedScore = contextRelevanceScore / maxPossibleScore;

//     // Apply exponential scaling to reward high relevance
//     return 0.9 + Math.pow(normalizedScore, 2) * 0.5;
//   }

//   // NEW: Competitive landscape adjustment
//   private async getCompetitiveAdjustment(inventoryId, format) {
//     // Get recent winning bids for this inventory
//     const recentAuctions = await this.prisma.auctionLog.findMany({
//       where: {
//         bidRequest: {
//           inventoryId,
//         },
//         status: 'COMPLETED',
//         createdAt: {
//           gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
//         },
//       },
//       select: {
//         finalPrice: true,
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//       take: 50,
//     });

//     if (recentAuctions.length < 10) return 1.0; // Not enough data

//     // Calculate average winning bid
//     const avgWinningBid =
//       recentAuctions.reduce(
//         (sum, auction) => sum + Number(auction.finalPrice),
//         0,
//       ) / recentAuctions.length;

//     // Get average winning bid for this format across all inventory
//     const globalAvgBid = await this.prisma.auctionLog.aggregate({
//       where: {
//         bidRequest: {
//           inventory: {
//             format,
//           },
//         },
//         status: 'COMPLETED',
//         createdAt: {
//           gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
//         },
//       },
//       _avg: {
//         finalPrice: true,
//       },
//     });

//     const globalAvg: number =
//       globalAvgBid._avg.finalPrice != null
//         ? parseFloat(globalAvgBid._avg.finalPrice.toString())
//         : avgWinningBid || avgWinningBid;

//     // Competitive adjustment factor
//     // Higher than average inventory gets slight premium
//     // Lower than average inventory gets slight discount
//     return avgWinningBid / globalAvg;
//   }

//   // NEW: Budget pacing adjustment
//   private async getPacingAdjustment(campaign) {
//     const { id, budget, dailyBudget, startDate, endDate } = campaign;

//     if (!budget) return 1.0;

//     // Get total spend for this campaign
//     const spend = await this.prisma.campaignStatistics.aggregate({
//       where: {
//         campaignId: id,
//       },
//       _sum: {
//         spend: true,
//       },
//     });

//     const totalSpend = Number(spend._sum.spend || 0);
//     const totalBudget = Number(budget);

//     // Calculate campaign progress
//     const now = new Date();
//     const start = new Date(startDate);
//     const end = new Date(endDate);

//     const totalDuration = end.getTime() - start.getTime();
//     const elapsedDuration = now.getTime() - start.getTime();

//     // If campaign hasn't started yet
//     if (elapsedDuration <= 0) return 1.0;

//     // If campaign has finished
//     if (elapsedDuration >= totalDuration) return 0.5; // Bid lower for expired campaigns

//     // Calculate ideal spend ratio
//     const idealSpendRatio = elapsedDuration / totalDuration;
//     const actualSpendRatio = totalSpend / totalBudget;

//     // Calculate pacing ratio
//     const pacingRatio = actualSpendRatio / idealSpendRatio;

//     if (pacingRatio < 0.8) {
//       // Under-pacing (spending too slowly) - bid higher
//       return 1.2;
//     } else if (pacingRatio > 1.2) {
//       // Over-pacing (spending too quickly) - bid lower
//       return 0.8;
//     }

//     // On-track pacing
//     return 1.0;
//   }
// }
