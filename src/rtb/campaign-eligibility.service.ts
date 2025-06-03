// import { Injectable, Logger } from '@nestjs/common';
// import { CampaignStatus, CreativeStatus } from '@prisma/client';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { RedisService } from 'src/redis/redis.service';

// @Injectable()
// export class CampaignEligibilityService {
//   private readonly logger = new Logger(CampaignEligibilityService.name);
//   private readonly CACHE_TTL = 60;
//   private readonly CAMPAIGN_CACHE_TTL = 60;

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly redis: RedisService,
//   ) {}

//   async getEligibleCampaigns(bidRequest: any) {
//     const cacheKey = `eligibleCampaigns:${bidRequest.id}`;

//     try {
//       // Get cached data if available and return
//       const cachedData = await this.redis.get<string>(cacheKey);
//       if (cachedData) {
//         this.logger.log('Cache hit for eligible campaigns');
//         return JSON.parse(cachedData);
//       }
//       this.logger.log('Cache miss for eligible campaigns');
//       const targetingCriteriaKey = `campaignCriteria`;
//       let campaignCriteria = await this.redis.get<string>(targetingCriteriaKey);
//       const startTime = Date.now();

//       // Step 1: Get today's date (start of day)
//       let campaigns;
//       if (campaignCriteria) {
//         // Use cached criteria for initial filtering
//         campaigns = await this.getActiveCampaignsWithInventory(
//           // ambiguous
//           bidRequest.inventoryId,
//         );
//       } else {
//         // Fetch all campaign criteria and cache it
//         campaigns = await this.fetchCampaignsWithCriteria(
//           bidRequest.inventoryId,
//         );
//         await this.redis.set(
//           targetingCriteriaKey,
//           JSON.stringify(
//             campaigns.map((c) => ({
//               id: c.id,
//               targetingRules: c.targetingRules,
//             })),
//           ),
//           this.CAMPAIGN_CACHE_TTL,
//         );
//       }
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       // Step 2: Get spend per campaign for today - keeping this as a separate query
//       // since it's aggregating data which is difficult to combine with the main query
//       const spendMap = await this.prisma.campaignStatistics.groupBy({
//         by: ['campaignId'],
//         where: {
//           date: today,
//         },
//         _sum: {
//           spend: true,
//         },
//       });

//       // Convert to a dictionary for quick lookup
//       const spendByCampaignId = Object.fromEntries(
//         spendMap.map((entry) => [entry.campaignId, entry._sum.spend || 0]),
//       );

//       this.logger.debug(
//         `Retrieved daily spend for ${spendMap.length} campaigns in ${Date.now() - startTime}ms`,
//       );

//       // Step 3: Fetch campaigns with optimized filtering directly in the query
//       const dbQueryStart = Date.now();
//       const eligibleCampaigns = await this.prisma.campaign.findMany({
//         where: {
//           status: CampaignStatus.ACTIVE,
//           startDate: { lte: new Date() },
//           endDate: { gte: new Date() },
//           // Push inventory filtering to database level
//           campaignInventories: {
//             some: {
//               inventoryId: bidRequest.inventoryId, // ambiguous
//             },
//           },
//           // Push creative filtering to database level
//           creatives: {
//             some: {
//               status: CreativeStatus.APPROVED,
//               inventoryId: bidRequest.inventoryId,
//             },
//           },
//         },
//         include: {
//           targetingRules: true,
//           campaignInventories: {
//             where: {
//               inventoryId: bidRequest.inventoryId,
//             },
//             include: {
//               inventory: true,
//             },
//           },
//           creatives: {
//             where: {
//               status: CreativeStatus.APPROVED,
//               inventoryId: bidRequest.inventoryId,
//             },
//           },
//         },
//       });

//       this.logger.debug(
//         `Database query completed in ${Date.now() - dbQueryStart}ms, found ${eligibleCampaigns.length} campaigns`,
//       );

//       // Step 4: Filter campaigns based on daily budget in JS
//       const budgetFilterStart = Date.now();
//       const campaignsWithinBudget = eligibleCampaigns.filter((campaign) => {
//         const spentToday = spendByCampaignId[campaign.id] || 0;
//         return (
//           campaign.dailyBudget === null || spentToday < campaign.dailyBudget
//         );
//       });

//       this.logger.debug(
//         `Budget filtering completed in ${Date.now() - budgetFilterStart}ms, ${campaignsWithinBudget.length} campaigns within budget`,
//       );

//       // Apply targeting rules
//       const targetingStart = Date.now();
//       const finalEligibleCampaigns = await this.applyTargetingRules(
//         campaignsWithinBudget,
//         bidRequest,
//       );

//       this.logger.debug(
//         `Targeting rules applied in ${Date.now() - targetingStart}ms, final eligible: ${finalEligibleCampaigns.length}`,
//       );

//       const totalElapsed = Date.now() - startTime;
//       this.logger.debug(
//         `Found ${finalEligibleCampaigns.length} eligible campaigns in ${totalElapsed}ms`,
//       );

//       // Cache the result with proper serialization
//       await this.redis.set(
//         cacheKey,
//         JSON.stringify(finalEligibleCampaigns),
//         this.CACHE_TTL,
//       );

//       return finalEligibleCampaigns;
//     } catch (error) {
//       this.logger.error(
//         `Error finding eligible campaigns: ${error.message}`,
//         error.stack,
//       );
//       // Depending on your error handling strategy, you might want to:
//       // 1. Return an empty array to continue with no campaigns
//       // 2. Throw the error to be handled by the caller
//       // 3. Return a default set of campaigns
//       return [];
//     }
//   }

//   private async applyTargetingRules(campaigns, bidRequest) {
//     return campaigns.filter((campaign) => {
//       if (campaign.targetingRules.length == 0) {
//         return true; // becuase no targeting rules, so eligible
//       }

//       // Check if any targeting rule matches
//       return campaign.targetingRules.every((rule) => {
//         switch (rule.ruleType) {
//           case 'DEMOGRAPHIC':
//             return this.matchesDemographic(rule.ruleData, bidRequest);
//           case 'GEOGRAPHIC':
//             return this.matchesGeographic(rule.ruleData, bidRequest);
//           case 'DEVICE':
//             return this.matchesDevice(rule.ruleData, bidRequest);
//           case 'CONTEXTUAL':
//             return this.matchesContextual(rule.ruleData, bidRequest);
//           case 'BEHAVIORAL':
//             return this.matchesBehavioral(rule.ruleData, bidRequest);
//           case 'TIME':
//             return this.matchesTime(rule.ruleData);
//           case 'FREQUENCY':
//             return this.matchesFrequency(rule.ruleData, bidRequest);
//           default:
//             return true;
//         }
//       });
//     });
//   }
//   private matchesDemographic(ruleData, bidRequest) {
//     // Simple demographic matching
//     if (!bidRequest.targeting) return true;

//     const userDemo = bidRequest.targeting;

//     // Age range check if available
//     if (ruleData.ageRanges && userDemo.age) {
//       const userAge = parseInt(userDemo.age);
//       return ruleData.ageRanges.some(
//         (range) => userAge >= range.min && userAge <= range.max,
//       );
//     }

//     // Gender check if available
//     if (ruleData.genders && userDemo.gender) {
//       return ruleData.genders.includes(userDemo.gender);
//     }

//     return true; // Default to match if no specific demographic data
//   }

//   private matchesGeographic(ruleData, bidRequest) {
//     // Simple geo matching
//     if (!bidRequest.country) return true;

//     // Country check
//     if (ruleData.countries && ruleData.countries.length > 0) {
//       return ruleData.countries.includes(bidRequest.country);
//     }

//     // Region check if available
//     if (ruleData.regions && bidRequest.region) {
//       return ruleData.regions.includes(bidRequest.region);
//     }

//     // City check if available
//     if (ruleData.cities && bidRequest.city) {
//       return ruleData.cities.includes(bidRequest.city);
//     }

//     return true; // Default to match if no specific geo rules
//   }

//   private matchesDevice(ruleData, bidRequest) {
//     if (!bidRequest.deviceType && !bidRequest.browserType) return true;

//     // Device type check
//     if (ruleData.deviceTypes && bidRequest.deviceType) {
//       return ruleData.deviceTypes.includes(bidRequest.deviceType);
//     }

//     // Browser check
//     if (ruleData.browsers && bidRequest.browserType) {
//       return ruleData.browsers.includes(bidRequest.browserType);
//     }

//     return true;
//   }

//   private matchesContextual(ruleData, bidRequest) {
//     // If targeting has site categories or keywords
//     if (ruleData.siteCategories && bidRequest.adSlot?.categories) {
//       return bidRequest.adSlot.categories.some((category) =>
//         ruleData.siteCategories.includes(category),
//       );
//     }

//     return true;
//   }

//   private matchesBehavioral(ruleData, bidRequest) {
//     // Would typically involve user interest matching
//     // This is simplified for now
//     return true;
//   }

//   private matchesTime(ruleData) {
//     const now = new Date();
//     const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
//     const hourOfDay = now.getHours(); // 0-23

//     // Check day of week
//     if (ruleData.daysOfWeek && ruleData.daysOfWeek.length > 0) {
//       if (!ruleData.daysOfWeek.includes(dayOfWeek)) {
//         return false;
//       }
//     }

//     // Check hour of day
//     if (ruleData.hoursOfDay && ruleData.hoursOfDay.length > 0) {
//       if (!ruleData.hoursOfDay.includes(hourOfDay)) {
//         return false;
//       }
//     }

//     return true;
//   }

//   private matchesFrequency(ruleData, bidRequest) {
//     // Frequency capping would need user ID and impression history
//     // For now, we'll simplify and assume it matches
//     return true;
//   }
//   private async getActiveCampaignsWithInventory(inventoryId: string) {
//     // Using a more optimized query that focuses just on what we need
//     return this.prisma.campaign.findMany({
//       where: {
//         status: CampaignStatus.ACTIVE,
//         startDate: { lte: new Date() },
//         endDate: { gte: new Date() },
//         campaignInventories: {
//           some: {
//             inventoryId,
//           },
//         },
//         creatives: {
//           some: {
//             status: CreativeStatus.APPROVED,
//             inventoryId,
//           },
//         },
//       },
//       select: {
//         id: true,
//         advertiserId: true,
//         budget: true,
//         dailyBudget: true,
//         bidStrategy: true,
//         campaignInventories: {
//           where: {
//             inventoryId,
//           },
//           select: {
//             maxBid: true,
//           },
//         },
//         targetingRules: true,
//       },
//     });
//   }

//   // Optimize fetchCampaignsWithCriteria method
//   private async fetchCampaignsWithCriteria(inventoryId: string) {
//     // Same as getActiveCampaignsWithInventory but with additional fields
//     return this.prisma.campaign.findMany({
//       where: {
//         status: CampaignStatus.ACTIVE,
//         startDate: { lte: new Date() },
//         endDate: { gte: new Date() },
//         campaignInventories: {
//           // flagged to remove
//           some: {
//             inventoryId,
//           },
//         },
//         creatives: {
//           some: {
//             status: CreativeStatus.APPROVED,
//             inventoryId,
//           },
//         },
//       },
//       select: {
//         id: true,
//         advertiserId: true,
//         budget: true,
//         dailyBudget: true,
//         bidStrategy: true,
//         campaignInventories: {
//           where: {
//             inventoryId,
//           },
//           select: {
//             maxBid: true,
//             inventoryId: true,
//           },
//         },
//         targetingRules: true,
//         creatives: {
//           where: {
//             status: CreativeStatus.APPROVED,
//             inventoryId,
//           },
//           select: {
//             id: true,
//           },
//           take: 1,
//         },
//       },
//     });
//   }
// }
