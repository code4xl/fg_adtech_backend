import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    ParseUUIDPipe,
    Param
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse
  } from '@nestjs/swagger';
  import { AdvertiserGuard } from '../../common/guards/authorization.guard';
  import { AIRateLimitGuard } from '../guards/ai-rate-limit.guard';
  import { CampaignAIService } from '../services/campaign-ai.service';
  import { BudgetIntelligenceService } from '../services/budget-intelligence.service';
  import { TargetingOptimizationService } from '../services/targeting-optimization.service';
  import { OpenAIService } from '../services/openai.service';
  import { UseInterceptors } from '@nestjs/common';
import { AIUsageInterceptor } from '../interceptors/ai-usage.interceptor';

  import {
    CampaignAnalysisRequestDto,
    CampaignAnalysisResponseDto,
    RegenerateNamesRequestDto,
    CampaignNameSuggestion
  } from '../dto/campaign-analysis.dto';
  import {
    OptimizeBudgetRequestDto,
    OptimizeBudgetResponseDto,
    RefineTargetingRequestDto,
    PerformancePredictionRequestDto,
    PerformancePredictionResponseDto,
    AIHealthCheckResponseDto
  } from '../dto/refinement.dto';
  import {
    ApiStandardResponse,
    ApiStandardErrors
  } from '../../common/decorators/swagger.decorator';
  
  @ApiTags('ai/campaign')
  @ApiBearerAuth()
  @UseGuards(AdvertiserGuard, AIRateLimitGuard)
  @UseInterceptors(AIUsageInterceptor)
  @Controller('ai/campaign')
  
  export class CampaignAIController {
    constructor(
      private readonly campaignAIService: CampaignAIService,
      private readonly budgetIntelligenceService: BudgetIntelligenceService,
      private readonly targetingOptimizationService: TargetingOptimizationService,
      private readonly openAIService: OpenAIService
    ) {}
  
    @Post('analyze')
    @ApiOperation({ 
      summary: 'Analyze campaign description and generate AI suggestions',
      description: 'Processes natural language campaign description and returns optimized campaign parameters'
    })
    @ApiStandardResponse({
      type: CampaignAnalysisResponseDto,
      description: 'Campaign analysis completed successfully'
    })
    @ApiStandardErrors()
    async analyzeCampaign(
      @Body() analysisRequest: CampaignAnalysisRequestDto,
      @Request() req
    ): Promise<CampaignAnalysisResponseDto> {
      return this.campaignAIService.analyzeCampaign(
        req.user.id,
        analysisRequest
      );
    }
  
    @Post('regenerate-names')
    @ApiOperation({ 
      summary: 'Generate new campaign name suggestions',
      description: 'Creates alternative campaign names based on campaign context and criteria'
    })
        @ApiResponse({      status: 200,      description: 'Campaign names generated successfully',      type: [CampaignNameSuggestion]    })
    @ApiStandardErrors()
    async regenerateNames(
      @Body() regenerateRequest: RegenerateNamesRequestDto,
      @Request() req
    ): Promise<CampaignNameSuggestion[]> {
      return this.campaignAIService.regenerateCampaignNames(
        regenerateRequest.campaignId,
        req.user.id,
        regenerateRequest.criteria,
        regenerateRequest.count || 3
      );
    }
  
    @Post('optimize-budget')
    @ApiOperation({ 
      summary: 'Optimize campaign budget allocation',
      description: 'Provides AI-driven budget recommendations based on objectives and constraints'
    })
    @ApiStandardResponse({
      type: OptimizeBudgetResponseDto,
      description: 'Budget optimization completed successfully'
    })
    @ApiStandardErrors()
    async optimizeBudget(
      @Body() optimizeRequest: OptimizeBudgetRequestDto,
      @Request() req
    ): Promise<OptimizeBudgetResponseDto> {
      return this.budgetIntelligenceService.optimizeBudget(
        optimizeRequest.campaignId,
        req.user.id,
        optimizeRequest.constraints,
        optimizeRequest.optimizationGoal
      );
    }
  
    @Post('refine-targeting')
    @ApiOperation({ 
      summary: 'Refine campaign targeting rules',
      description: 'Enhances targeting parameters based on performance data and goals'
    })
    @ApiStandardResponse({
      description: 'Targeting refinement completed successfully'
    })
    @ApiStandardErrors()
    async refineTargeting(
      @Body() refineRequest: RefineTargetingRequestDto,
      @Request() req
    ) {
      return this.targetingOptimizationService.refineTargeting(
        refineRequest.campaignId,
        req.user.id,
        refineRequest.refinementGoals,
        refineRequest.focusAreas,
        refineRequest.includeLookalike
      );
    }
  
    @Post('predict-performance')
    @ApiOperation({ 
      summary: 'Predict campaign performance',
      description: 'Forecasts campaign metrics based on configuration and market data'
    })
    @ApiStandardResponse({
      type: PerformancePredictionResponseDto,
      description: 'Performance prediction completed successfully'
    })
    @ApiStandardErrors()
    async predictPerformance(
      @Body() predictionRequest: PerformancePredictionRequestDto,
      @Request() req
    ): Promise<PerformancePredictionResponseDto> {
      return this.budgetIntelligenceService.predictPerformance(
        predictionRequest.campaignId,
        req.user.id,
        predictionRequest.timeframeDays || 30,
        predictionRequest.scenario || 'current',
        predictionRequest.includeCompetitiveAnalysis || false
      );
    }
  
    @Get('suggestions/:campaignId/history')
    @ApiOperation({ 
      summary: 'Get AI suggestion history for a campaign',
      description: 'Retrieves previous AI recommendations made for this campaign'
    })
    @ApiStandardResponse({
      description: 'Suggestion history retrieved successfully'
    })
    @ApiStandardErrors()
    async getSuggestionHistory(
      @Param('campaignId', ParseUUIDPipe) campaignId: string,
      @Request() req
    ) {
      return this.campaignAIService.getSuggestionHistory(
        campaignId,
        req.user.id
      );
    }
  
    @Get('health')
    @ApiOperation({ 
      summary: 'Check AI service health',
      description: 'Verifies AI service availability and configuration'
    })
    @ApiResponse({
      status: 200,
      description: 'AI service health status',
      type: AIHealthCheckResponseDto
    })
    async healthCheck(): Promise<AIHealthCheckResponseDto> {
      const startTime = Date.now();
      
      const isConfigured = this.openAIService.isConfigured();
      const canConnect = isConfigured ? await this.testConnection() : false;
      
      return {
        status: canConnect ? 'healthy' : isConfigured ? 'degraded' : 'unavailable',
        openAIConnected: canConnect,
        availableModels: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
        responseTime: Date.now() - startTime,
        version: '1.0.0'
      };
    }
  
    private async testConnection(): Promise<boolean> {
      try {
        await this.openAIService.generateCompletion({
          model: 'gpt-3.5-turbo' as any,
          messages: [
            { role: 'system', content: 'Test' },
            { role: 'user', content: 'Respond with OK' }
          ],
          maxTokens: 10
        });
        return true;
      } catch {
        return false;
      }
    }
  }