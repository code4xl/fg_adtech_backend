import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { ConfigModule } from '@nestjs/config';
import { SSEModule } from './sse/sse.module';
// import { TimescaleModule } from '../timescale/timescale.module';

// Controllers
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
    imports: [
        PrismaModule,
        RedisModule,
        KafkaModule,
        ConfigModule,  
        SSEModule,    
        // TimescaleModule, // Add TimescaleModule for analytics
    ],
    controllers: [
        RTBController,
    ],
    providers: [
        // === CORE SERVICES ===
        RtbService,
        RTBMetricsService,
        AuctionService,
        BidEvaluationService,
        CampaignEligibilityService,
        CampaignTargetingService,
        BidAdjustmentService,
        bidStrategyService,
        HealthService,

        // === PROCESSORS ===
        BidRequestProcessor,
        BidResponseProcessor,

        // === KAFKA CONSUMERS ===
        BidRequestKafkaConsumer,
        AuctionResultKafkaConsumer,
        AuctionCompletionKafkaConsumer,

        // === KAFKA PRODUCERS ===
        AuctionProducer,

        // === CACHE & UTILITIES ===
        RtbCacheService,
        RtbHelper,

        // === TRACKING SERVICES ===
        BudgetValidationService,
        BudgetInitializationService,
        ImpressionClickLinkingService,
    ],
    exports: [
        // Export core services for use in other modules
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
        RTBMetricsService,
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
