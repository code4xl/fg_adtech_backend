// src/rtb/reporting/reporting.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCampaignPerformance(
    campaignId: string,
    dateRange: { start: Date; end: Date },
  ) {
    try {
      // Use the denormalized hourly stats for better performance
      const hourlyStats = await this.prisma.hourlyStats.findMany({
        where: {
          campaignId,
          hour: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        orderBy: {
          hour: 'asc',
        },
      });

      // Use the denormalized daily stats
      const dailyStats = await this.prisma.dailyStats.findMany({
        where: {
          campaignId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      // Get campaign details
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          name: true,
          budget: true,
          dailyBudget: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      });

      // Calculate summary metrics from the denormalized data
      const totalImpressions = dailyStats.reduce(
        (sum, stat) => sum + stat.impressions,
        0,
      );
      const totalClicks = dailyStats.reduce(
        (sum, stat) => sum + stat.clicks,
        0,
      );
      const totalSpend = dailyStats.reduce(
        (sum, stat) => sum + Number(stat.spend),
        0,
      );

      // Use the precomputed metrics where available
      const avgCtr =
        dailyStats.length > 0
          ? dailyStats.reduce((sum, stat) => sum + stat.ctr, 0) /
            dailyStats.length
          : 0;

      const avgCpc =
        dailyStats.length > 0
          ? dailyStats.reduce((sum, stat) => sum + Number(stat.cpc), 0) /
            dailyStats.length
          : 0;

      return {
        campaign,
        summary: {
          totalImpressions,
          totalClicks,
          totalSpend,
          ctr: parseFloat(avgCtr.toFixed(2)),
          cpc: parseFloat(avgCpc.toFixed(2)),
          budgetUtilization: campaign?.budget
            ? (totalSpend / Number(campaign.budget)) * 100
            : null,
        },
        dailyStats,
        hourlyStats,
      };
    } catch (error) {
      this.logger.error(
        `Error getting campaign performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getInventoryPerformance(
    inventoryId: string,
    dateRange: { start: Date; end: Date },
  ) {
    try {
      // Get hourly stats aggregated by inventory
      const hourlyStats = await this.prisma.hourlyStats.findMany({
        where: {
          inventoryId,
          hour: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        orderBy: {
          hour: 'asc',
        },
      });

      // Get inventory details
      const inventory = await this.prisma.adInventory.findUnique({
        where: { id: inventoryId },
        include: {
          publisher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Calculate summary metrics
      const totalImpressions = hourlyStats.reduce(
        (sum, stat) => sum + stat.impressions,
        0,
      );
      const totalClicks = hourlyStats.reduce(
        (sum, stat) => sum + stat.clicks,
        0,
      );
      const totalRevenue = hourlyStats.reduce(
        (sum, stat) => sum + Number(stat.spend),
        0,
      );
      const ctr =
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const ecpm =
        totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;

      return {
        inventory,
        summary: {
          totalImpressions,
          totalClicks,
          totalRevenue,
          ctr: parseFloat(ctr.toFixed(2)),
          ecpm: parseFloat(ecpm.toFixed(2)),
        },
        hourlyStats,
      };
    } catch (error) {
      this.logger.error(
        `Error getting inventory performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDashboardSummary(dateRange: { start: Date; end: Date }) {
    try {
      // Get total impressions, clicks, and spend
      const stats = await this.prisma.hourlyStats.aggregate({
        _sum: {
          impressions: true,
          clicks: true,
          spend: true,
        },
        where: {
          hour: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
      });

      // Get active campaigns count
      const activeCampaigns = await this.prisma.campaign.count({
        where: {
          status: 'ACTIVE',
        },
      });

      // Get active inventory count
      const activeInventory = await this.prisma.adInventory.count({
        where: {
          isActive: true,
        },
      });

      // Calculate performance metrics
      const totalImpressions = stats._sum.impressions || 0;
      const totalClicks = stats._sum.clicks || 0;
      const totalSpend = Number(stats._sum.spend) || 0;
      const ctr =
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const ecpm =
        totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

      return {
        summary: {
          totalImpressions,
          totalClicks,
          totalSpend,
          ctr: parseFloat(ctr.toFixed(2)),
          cpc: parseFloat(cpc.toFixed(2)),
          ecpm: parseFloat(ecpm.toFixed(2)),
          activeCampaigns,
          activeInventory,
        },
        timeRange: {
          start: dateRange.start,
          end: dateRange.end,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting dashboard summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
