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
import { RTBMetricsService } from './services/rtb-metrics.service';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';
import { ImpressionClickLinkingService } from 'src/tracking/services/impression-click-linking.service';

@Module({
  imports: [PrismaModule, RedisModule, KafkaModule],
  controllers: [RTBController],
  providers: [
    RtbService,
    RTBMetricsService,
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
  ],
})
export class RTBModule implements OnModuleInit {
  private readonly logger = new Logger(RTBModule.name);

  constructor(
    private readonly campaignEligibilityService: CampaignEligibilityService,
  ) {}

  async onModuleInit() {
    try {
      await this.campaignEligibilityService.warmupCaches();
    } catch (error) {
      this.logger.error('RTB Module initialization failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
