import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { RTBController } from './controllers/rtb.controller';
import { RtbService } from './services/rtb.service';
import { AuctionService } from './services/auction.service';
import { BidEvaluationService } from './services/bid-evaluation.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { CampaignTargetingService } from './services/campaign-targeting.service';
import { BidAdjustmentService } from './services/bid-adjustment.service';
import { bidStrategyService } from './services/bid-strategy.service';
import { HealthService } from './services/health-service';
import { BidRequestProcessor } from './processors/bid-request.processor';
import { BidResponseProcessor } from './processors/bid-response.processor';
import { BidRequestKafkaConsumer } from './consumers/bid-request.consumer';
import { AuctionResultKafkaConsumer } from './consumers/auction-result.consumer';
import { AuctionCompletionKafkaConsumer } from './consumers/auction-completion.consumer';
import AuctionProducer from './producers/auction.producer';
import { RtbCacheService } from './cache/rtb-cache.service';
import { RtbHelper } from './utils/helpers';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';
import { ImpressionClickLinkingService } from 'src/tracking/services/impression-click-linking.service';
import { TrackingModule } from 'src/tracking/tracking.module';
import { BudgetRedisSyncService } from 'src/tracking/services/budget-redis-sync.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AdvertiserSpendingJob } from './jobs/daily/advertiser-spending.job';
import { PublisherRevenueJob } from './jobs/daily/publisher-revenue.job';
import { SystemRevenueJob } from './jobs/daily/system-revenue.job';
import { BudgetManagerService } from './services/budget-manager.service';
import { FinancialMonitoringController } from './controllers/financial-monitoring.controller';
import { CreativeSelectionService } from './services/creative-selection.service';
import { AdMarkupService } from './services/ad-markup.service';
import { CampaignPoolWarmupService } from './cache/warmup/campaign-pool.warmup';
import { CampaignPoolJob } from './jobs/every-10-minutes/campaign-pool.job';
import { PublisherTierJob } from './jobs/monthly/publisher-tier.job';
import { ActiveCampaignsJob } from './jobs/daily/active-campaigns.job';
import { BudgetMonitoringController } from './controllers/budget-monitoring.controller';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    KafkaModule,
    TrackingModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    RTBController,
    FinancialMonitoringController,
    BudgetMonitoringController,
  ],
  providers: [
    BudgetManagerService,
    PublisherRevenueJob,
    AdvertiserSpendingJob,
    SystemRevenueJob,
    RtbService,
    AuctionService,
    BidEvaluationService,
    CampaignEligibilityService,
    CampaignTargetingService,
    BidAdjustmentService,
    bidStrategyService,
    HealthService,
    BudgetValidationService,
    BudgetInitializationService,
    ImpressionClickLinkingService,
    BidRequestProcessor,
    BidResponseProcessor,
    BidRequestKafkaConsumer,
    AuctionResultKafkaConsumer,
    AuctionCompletionKafkaConsumer,
    AuctionProducer,
    RtbCacheService,
    RtbHelper,
    BudgetValidationService,
    BudgetRedisSyncService,
    BudgetManagerService,
    CreativeSelectionService,
    AdMarkupService,
    CampaignPoolWarmupService,
    CampaignPoolJob,
    PublisherTierJob,
    ActiveCampaignsJob,
  ],
  exports: [
    RtbService,
    AuctionService,
    BidEvaluationService,
    CampaignEligibilityService,
    CampaignTargetingService,
    BidAdjustmentService,
    bidStrategyService,
    HealthService,
    RtbCacheService,
    AuctionProducer,
    RtbHelper,
    BudgetValidationService,
    BudgetRedisSyncService,
    BudgetManagerService,
    BudgetInitializationService,
  ],
})
export class RTBModule implements OnModuleInit {
  private readonly logger = new Logger(RTBModule.name);

  constructor(
    private readonly campaignPoolWarmupService: CampaignPoolWarmupService,
  ) {}

  async onModuleInit() {
    try {
      await this.campaignPoolWarmupService.warmupCaches();
    } catch (error) {
      this.logger.error('RTB Module initialization failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
