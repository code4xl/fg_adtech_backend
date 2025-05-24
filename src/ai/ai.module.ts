import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { OpenAIService } from './services/openai.service';
import { CampaignAIService } from './services/campaign-ai.service';
import { HistoricalDataService } from './services/historical-data.service';
import { BudgetIntelligenceService } from './services/budget-intelligence.service';
import { TargetingOptimizationService } from './services/targeting-optimization.service';
import { PromptBuilder } from './utils/prompt-builder';
import { CampaignAIController } from './controllers/campaign-ai.controller';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import { AIUsageInterceptor } from './interceptors/ai-usage.interceptor';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PrismaModule,
    RedisModule
  ],
  controllers: [CampaignAIController],
  providers: [
    OpenAIService,
    CampaignAIService,
    HistoricalDataService,
    BudgetIntelligenceService,
    TargetingOptimizationService,
    PromptBuilder,
    AIRateLimitGuard,
    AIUsageInterceptor
  ],
  exports: [
    OpenAIService,
    CampaignAIService,
    BudgetIntelligenceService,
    TargetingOptimizationService
  ]
})
export class AiModule {}