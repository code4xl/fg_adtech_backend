import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { kafkaTopics } from 'src/kafka/constants/kafka.config';
import { KafkaService } from 'src/kafka/kafka.service';
import { PrismaService } from 'src/prisma/prisma.service';
import compression from 'compression';
@Injectable()
export class TrackingConsumerService implements OnModuleInit {
  private readonly logger = new Logger(TrackingConsumerService.name);
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  onModuleInit() {
    this.subscribeToTrackingEvents();
    this.logger.log('TrackingConsumerService initialized');
  }

  async subscribeToTrackingEvents() {
    const topic = kafkaTopics.TRACKING_EVENTS;
    const groupId = 'rtb-tracking-consumer';
    try {
      this.logger.log(`Subscribing to topic ${topic} with group ID ${groupId}`);

      await this.kafkaService.subscribe(
        topic,
        groupId,
        async ({ key, value, topic, partition, offset }) => {
          this.logger.log(
            `Received message from topic ${topic}: key=${key}, value=${JSON.stringify(value)}, partition=${partition}, offset=${offset}`,
          );

          if (value.eventType === 'impression') {
            await this.processImpressionEvent(value);
          } else if (value.eventType === 'click') {
            await this.processClickEvent(value);
          } else {
            this.logger.warn(
              `Unknown event type: ${value.eventType} in message: ${JSON.stringify(
                value,
              )}`,
            );
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Error subscribing to tracking events: ${error.message}`,
        error.stack,
      );
    }
    this.logger.log(`Subscribed to topic: ${topic} with groupId: ${groupId}`);
  }

  async processImpressionEvent(event: any) {
    try {
      const data = await this.prisma.impressionTrack.create({
        data: {
          creativeId: event.creativeId,
          campaignId: event.campaignId,
          inventoryId: event.inventoryId,
          publisherId: event.publisherId,
          bidRequestId: event.bidRequestId,
          bidResponseId: event.bidResponseId,
          price: event.price,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          referrer: event.referrer,
          country: event.country,
          region: event.region,
          city: event.city,
          deviceType: event.deviceType,
          browserType: event.browserType,
          viewable: event.viewable || false,
          viewTime: event.viewTime || 0,
          metadata: event.metadata || {},
        },
      });
      // update campaign spend if price is available
      if (event.price) {
        await this.updateCampaignSpend(event.campaignId, event.price);
      }

      await this.updateHourlyStats(event, 'impression');
    } catch (error) {
      this.logger.error(`Error processing impression event: ${error.message}`);
    }
  }
  async processClickEvent(event: any) {
    try {
      const data = await this.prisma.clickTrack.create({
        data: {
          creativeId: event.creativeId,
          campaignId: event.campaignId,
          inventoryId: event.inventoryId,
          publisherId: event.publisherId,
          impressionTrackId: event.impressionTrackId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          referrer: event.referrer,
          country: event.country,
          region: event.region,
          city: event.city,
          deviceType: event.deviceType,
          browserType: event.browserType,
          metadata: event.metadata || {},
        },
      });

      // update campaign hourly stats

      await this.updateHourlyStats(event, 'click');
    } catch (error) {
      this.logger.error(`Error processing click event: ${error.message}`);
    }
  }

  private async updateCampaignSpend(campaignId: string, price: number) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.prisma.campaignStatistics.upsert({
        where: {
          campaignId_date: {
            campaignId: campaignId,
            date: today,
          },
        },
        update: {
          impressions: { increment: 1 },
          spend: { increment: price },
        },
        create: {
          campaignId,
          date: today,
          impressions: 1,
          clicks: 0,
          conversions: 0,
          spend: price,
        },
      });

      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          budget: true,
          dailyBudget: true,
          status: true,
        },
      });

      if (
        campaign &&
        (campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED')
      ) {
        // Calcaulating total spend for the campaign
        const totalSpend = await this.prisma.campaignStatistics.aggregate({
          _sum: {
            spend: true,
          },
          where: {
            campaignId,
          },
        });

        // Calculating today's spend
        const dailySpend = await this.prisma.campaignStatistics.findUnique({
          where: {
            campaignId_date: {
              campaignId: campaignId,
              date: today,
            },
          },
          select: {
            spend: true,
          },
        });

        // check if budget is exhausted
        if (
          (campaign.budget &&
            totalSpend._sum.spend &&
            totalSpend._sum.spend >= campaign.budget) ||
          (campaign.dailyBudget &&
            dailySpend?.spend &&
            dailySpend.spend >= campaign.dailyBudget)
        ) {
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: 'BUDGET_EXHAUSTED',
            },
          });
          this.logger.log(
            `Campaign ${campaignId} budget exhausted. Status updated to BUDGET_EXHAUSTED`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error updating campaign spend for campaign ${campaignId}: ${error.message}`,
      );
    }
  }

  private async updateHourlyStats(
    event: any,
    eventType: 'impression' | 'click',
  ) {
    try {
      const hourDate = new Date(event.timestamp);
      hourDate.setMinutes(0, 0, 0);

      await this.prisma.hourlyStats.upsert({
        where: {
          hour_campaignId_inventoryId_publisherId: {
            hour: hourDate,
            campaignId: event.campaignId,
            inventoryId: event.inventoryId,
            publisherId: event.publisherId,
          },
        },
        update: {
          impressions:
            eventType === 'impression' ? { increment: 1 } : undefined,
          clicks: eventType === 'click' ? { increment: 1 } : undefined,
          spend:
            eventType === 'impression' && event.price
              ? { increment: event.price }
              : undefined,
        },
        create: {
          hour: hourDate,
          campaignId: event.campaignId,
          inventoryId: event.inventoryId,
          publisherId: event.publisherId,
          impressions: eventType === 'impression' ? 1 : 0,
          clicks: eventType === 'click' ? 1 : 0,
          spend: eventType === 'impression' && event.price ? event.price : 0,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating hourly stats for event ${eventType}: ${error.message}`,
      );
    }
  }
}
