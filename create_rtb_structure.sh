#!/bin/bash

# RTB File Structure Creation Script
# Run this from your project root directory

echo "🚀 Creating RTB Directory Structure..."

# Base RTB directory
RTB_BASE="./src/RTB"

# Create main directories
echo "📁 Creating main directories..."
mkdir -p "$RTB_BASE"

# Core domain
echo "📁 Creating core domain..."
mkdir -p "$RTB_BASE/core/types"
mkdir -p "$RTB_BASE/core/enums"
mkdir -p "$RTB_BASE/core/constants"
mkdir -p "$RTB_BASE/core/dtos"

# Auction domain
echo "📁 Creating auction domain..."
mkdir -p "$RTB_BASE/auction/services"
mkdir -p "$RTB_BASE/auction/processors"
mkdir -p "$RTB_BASE/auction/validators"

# Bidding domain
echo "📁 Creating bidding domain..."
mkdir -p "$RTB_BASE/bidding/services"
mkdir -p "$RTB_BASE/bidding/processors"
mkdir -p "$RTB_BASE/bidding/strategies"

# Eligibility domain
echo "📁 Creating eligibility domain..."
mkdir -p "$RTB_BASE/eligibility/services"
mkdir -p "$RTB_BASE/eligibility/filters"
mkdir -p "$RTB_BASE/eligibility/validators"

# Targeting domain
echo "📁 Creating targeting domain..."
mkdir -p "$RTB_BASE/targeting/services"
mkdir -p "$RTB_BASE/targeting/filters"
mkdir -p "$RTB_BASE/targeting/evaluators"

# Budget domain
echo "📁 Creating budget domain..."
mkdir -p "$RTB_BASE/budget/services"
mkdir -p "$RTB_BASE/budget/validators"
mkdir -p "$RTB_BASE/budget/calculators"

# Caching domain
echo "📁 Creating caching domain..."
mkdir -p "$RTB_BASE/caching/services"
mkdir -p "$RTB_BASE/caching/strategies"
mkdir -p "$RTB_BASE/caching/utils"

# Messaging domain
echo "📁 Creating messaging domain..."
mkdir -p "$RTB_BASE/messaging/consumers"
mkdir -p "$RTB_BASE/messaging/producers"
mkdir -p "$RTB_BASE/messaging/handlers"

# Metrics domain
echo "📁 Creating metrics domain..."
mkdir -p "$RTB_BASE/metrics/services"
mkdir -p "$RTB_BASE/metrics/collectors"
mkdir -p "$RTB_BASE/metrics/aggregators"

# Validation domain
echo "📁 Creating validation domain..."
mkdir -p "$RTB_BASE/validation/pipes"
mkdir -p "$RTB_BASE/validation/schemas"

# Utils domain
echo "📁 Creating utils domain..."
mkdir -p "$RTB_BASE/utils/transformers"
mkdir -p "$RTB_BASE/utils/helpers"
mkdir -p "$RTB_BASE/utils/calculators"
mkdir -p "$RTB_BASE/utils/guards"

# Controllers
echo "📁 Creating controllers..."
mkdir -p "$RTB_BASE/controllers"

# Middleware
echo "📁 Creating middleware..."
mkdir -p "$RTB_BASE/middleware"

# Config
echo "📁 Creating config..."
mkdir -p "$RTB_BASE/config"

echo "📄 Creating core type files..."

# Core Types
touch "$RTB_BASE/core/types/bid-request.types.ts"
touch "$RTB_BASE/core/types/bid-response.types.ts"
touch "$RTB_BASE/core/types/auction.types.ts"
touch "$RTB_BASE/core/types/campaign.types.ts"
touch "$RTB_BASE/core/types/targeting.types.ts"
touch "$RTB_BASE/core/types/index.ts"

# Core Enums
touch "$RTB_BASE/core/enums/auction-status.enum.ts"
touch "$RTB_BASE/core/enums/bid-status.enum.ts"
touch "$RTB_BASE/core/enums/device-type.enum.ts"
touch "$RTB_BASE/core/enums/targeting-type.enum.ts"
touch "$RTB_BASE/core/enums/index.ts"

# Core Constants
touch "$RTB_BASE/core/constants/rtb-config.constants.ts"
touch "$RTB_BASE/core/constants/timeout.constants.ts"
touch "$RTB_BASE/core/constants/cache-ttl.constants.ts"
touch "$RTB_BASE/core/constants/index.ts"

# Core DTOs
touch "$RTB_BASE/core/dtos/bid-request.dto.ts"
touch "$RTB_BASE/core/dtos/bid-response.dto.ts"
touch "$RTB_BASE/core/dtos/auction-result.dto.ts"
touch "$RTB_BASE/core/dtos/index.ts"

echo "📄 Creating auction domain files..."

# Auction Services
touch "$RTB_BASE/auction/services/auction.service.ts"
touch "$RTB_BASE/auction/services/auction-state.service.ts"
touch "$RTB_BASE/auction/services/auction-result.service.ts"

# Auction Processors
touch "$RTB_BASE/auction/processors/auction-request.processor.ts"
touch "$RTB_BASE/auction/processors/auction-completion.processor.ts"
touch "$RTB_BASE/auction/processors/auction-timeout.processor.ts"

# Auction Validators
touch "$RTB_BASE/auction/validators/auction-request.validator.ts"
touch "$RTB_BASE/auction/validators/auction-state.validator.ts"

# Auction Module
touch "$RTB_BASE/auction/auction.module.ts"

echo "📄 Creating bidding domain files..."

# Bidding Services
touch "$RTB_BASE/bidding/services/bid-evaluation.service.ts"
touch "$RTB_BASE/bidding/services/bid-ranking.service.ts"
touch "$RTB_BASE/bidding/services/bid-pricing.service.ts"

# Bidding Processors
touch "$RTB_BASE/bidding/processors/bid-request.processor.ts"
touch "$RTB_BASE/bidding/processors/bid-response.processor.ts"
touch "$RTB_BASE/bidding/processors/bid-validation.processor.ts"

# Bidding Strategies
touch "$RTB_BASE/bidding/strategies/first-price.strategy.ts"
touch "$RTB_BASE/bidding/strategies/second-price.strategy.ts"
touch "$RTB_BASE/bidding/strategies/cost-cap.strategy.ts"

# Bidding Module
touch "$RTB_BASE/bidding/bidding.module.ts"

echo "📄 Creating eligibility domain files..."

# Eligibility Services
touch "$RTB_BASE/eligibility/services/campaign-eligibility.service.ts"
touch "$RTB_BASE/eligibility/services/campaign-pool.service.ts"
touch "$RTB_BASE/eligibility/services/eligibility-cache.service.ts"

# Eligibility Filters
touch "$RTB_BASE/eligibility/filters/base-filter.interface.ts"
touch "$RTB_BASE/eligibility/filters/budget-filter.service.ts"
touch "$RTB_BASE/eligibility/filters/status-filter.service.ts"
touch "$RTB_BASE/eligibility/filters/inventory-filter.service.ts"

# Eligibility Validators
touch "$RTB_BASE/eligibility/validators/campaign-validator.ts"
touch "$RTB_BASE/eligibility/validators/eligibility-validator.ts"

# Eligibility Module
touch "$RTB_BASE/eligibility/eligibility.module.ts"

echo "📄 Creating targeting domain files..."

# Targeting Services
touch "$RTB_BASE/targeting/services/targeting-engine.service.ts"
touch "$RTB_BASE/targeting/services/targeting-cache.service.ts"
touch "$RTB_BASE/targeting/services/targeting-evaluation.service.ts"

# Targeting Filters
touch "$RTB_BASE/targeting/filters/base-targeting-filter.ts"
touch "$RTB_BASE/targeting/filters/geographic-filter.service.ts"
touch "$RTB_BASE/targeting/filters/demographic-filter.service.ts"
touch "$RTB_BASE/targeting/filters/device-filter.service.ts"
touch "$RTB_BASE/targeting/filters/behavioral-filter.service.ts"
touch "$RTB_BASE/targeting/filters/contextual-filter.service.ts"
touch "$RTB_BASE/targeting/filters/time-filter.service.ts"
touch "$RTB_BASE/targeting/filters/frequency-filter.service.ts"

# Targeting Evaluators
touch "$RTB_BASE/targeting/evaluators/rule-evaluator.interface.ts"
touch "$RTB_BASE/targeting/evaluators/and-evaluator.ts"
touch "$RTB_BASE/targeting/evaluators/or-evaluator.ts"
touch "$RTB_BASE/targeting/evaluators/complex-evaluator.ts"

# Targeting Module
touch "$RTB_BASE/targeting/targeting.module.ts"

echo "📄 Creating budget domain files..."

# Budget Services
touch "$RTB_BASE/budget/services/budget-manager.service.ts"
touch "$RTB_BASE/budget/services/budget-tracker.service.ts"
touch "$RTB_BASE/budget/services/budget-pacing.service.ts"
touch "$RTB_BASE/budget/services/budget-alerts.service.ts"

# Budget Validators
touch "$RTB_BASE/budget/validators/budget-availability.validator.ts"
touch "$RTB_BASE/budget/validators/spend-limit.validator.ts"

# Budget Calculators
touch "$RTB_BASE/budget/calculators/daily-spend.calculator.ts"
touch "$RTB_BASE/budget/calculators/hourly-pace.calculator.ts"
touch "$RTB_BASE/budget/calculators/remaining-budget.calculator.ts"

# Budget Module
touch "$RTB_BASE/budget/budget.module.ts"

echo "📄 Creating caching domain files..."

# Caching Services
touch "$RTB_BASE/caching/services/rtb-cache.service.ts"
touch "$RTB_BASE/caching/services/cache-manager.service.ts"
touch "$RTB_BASE/caching/services/cache-invalidation.service.ts"
touch "$RTB_BASE/caching/services/cache-warmup.service.ts"

# Caching Strategies
touch "$RTB_BASE/caching/strategies/l1-cache.strategy.ts"
touch "$RTB_BASE/caching/strategies/l2-cache.strategy.ts"
touch "$RTB_BASE/caching/strategies/write-through.strategy.ts"

# Caching Utils
touch "$RTB_BASE/caching/utils/cache-key-builder.ts"
touch "$RTB_BASE/caching/utils/cache-stats.ts"
touch "$RTB_BASE/caching/utils/cache-compression.ts"

# Caching Module
touch "$RTB_BASE/caching/caching.module.ts"

echo "📄 Creating messaging domain files..."

# Messaging Consumers
touch "$RTB_BASE/messaging/consumers/base-rtb.consumer.ts"
touch "$RTB_BASE/messaging/consumers/bid-request.consumer.ts"
touch "$RTB_BASE/messaging/consumers/auction-processing.consumer.ts"
touch "$RTB_BASE/messaging/consumers/auction-result.consumer.ts"
touch "$RTB_BASE/messaging/consumers/dead-letter.consumer.ts"
touch "$RTB_BASE/messaging/consumers/tracking-events.consumer.ts"

# Messaging Producers
touch "$RTB_BASE/messaging/producers/base-rtb.producer.ts"
touch "$RTB_BASE/messaging/producers/auction.producer.ts"
touch "$RTB_BASE/messaging/producers/metrics.producer.ts"
touch "$RTB_BASE/messaging/producers/alerts.producer.ts"

# Messaging Handlers
touch "$RTB_BASE/messaging/handlers/message-deserializer.ts"
touch "$RTB_BASE/messaging/handlers/message-validator.ts"
touch "$RTB_BASE/messaging/handlers/error-handler.ts"

# Messaging Module
touch "$RTB_BASE/messaging/messaging.module.ts"

echo "📄 Creating metrics domain files..."

# Metrics Services
touch "$RTB_BASE/metrics/services/rtb-metrics.service.ts"
touch "$RTB_BASE/metrics/services/performance-tracker.service.ts"
touch "$RTB_BASE/metrics/services/auction-analytics.service.ts"
touch "$RTB_BASE/metrics/services/campaign-metrics.service.ts"

# Metrics Collectors
touch "$RTB_BASE/metrics/collectors/auction-metrics.collector.ts"
touch "$RTB_BASE/metrics/collectors/bid-metrics.collector.ts"
touch "$RTB_BASE/metrics/collectors/performance-metrics.collector.ts"

# Metrics Aggregators
touch "$RTB_BASE/metrics/aggregators/hourly-aggregator.ts"
touch "$RTB_BASE/metrics/aggregators/daily-aggregator.ts"
touch "$RTB_BASE/metrics/aggregators/realtime-aggregator.ts"

# Metrics Module
touch "$RTB_BASE/metrics/metrics.module.ts"

echo "📄 Creating validation domain files..."

# Validation Pipes
touch "$RTB_BASE/validation/pipes/bid-request.pipe.ts"
touch "$RTB_BASE/validation/pipes/auction-data.pipe.ts"
touch "$RTB_BASE/validation/pipes/targeting-rules.pipe.ts"

# Validation Schemas
touch "$RTB_BASE/validation/schemas/bid-request.schema.ts"
touch "$RTB_BASE/validation/schemas/campaign.schema.ts"
touch "$RTB_BASE/validation/schemas/targeting.schema.ts"

# Validation Module
touch "$RTB_BASE/validation/validation.module.ts"

echo "📄 Creating utils domain files..."

# Utils Transformers
touch "$RTB_BASE/utils/transformers/bid-request.transformer.ts"
touch "$RTB_BASE/utils/transformers/campaign.transformer.ts"
touch "$RTB_BASE/utils/transformers/targeting.transformer.ts"

# Utils Helpers
touch "$RTB_BASE/utils/helpers/geo-location.helper.ts"
touch "$RTB_BASE/utils/helpers/user-agent.helper.ts"
touch "$RTB_BASE/utils/helpers/device-detection.helper.ts"
touch "$RTB_BASE/utils/helpers/time-zone.helper.ts"

# Utils Calculators
touch "$RTB_BASE/utils/calculators/ctr-calculator.ts"
touch "$RTB_BASE/utils/calculators/bid-price.calculator.ts"
touch "$RTB_BASE/utils/calculators/score.calculator.ts"

# Utils Guards
touch "$RTB_BASE/utils/guards/rate-limit.guard.ts"
touch "$RTB_BASE/utils/guards/auction-timeout.guard.ts"

echo "📄 Creating controller files..."

# Controllers
touch "$RTB_BASE/controllers/rtb.controller.ts"
touch "$RTB_BASE/controllers/auction.controller.ts"
touch "$RTB_BASE/controllers/metrics.controller.ts"
touch "$RTB_BASE/controllers/health.controller.ts"

echo "📄 Creating middleware files..."

# Middleware
touch "$RTB_BASE/middleware/request-logging.middleware.ts"
touch "$RTB_BASE/middleware/performance-tracking.middleware.ts"
touch "$RTB_BASE/middleware/error-handling.middleware.ts"

echo "📄 Creating config files..."

# Config
touch "$RTB_BASE/config/rtb.config.ts"
touch "$RTB_BASE/config/cache.config.ts"
touch "$RTB_BASE/config/kafka-topics.config.ts"
touch "$RTB_BASE/config/redis-keys.config.ts"

echo "📄 Creating main module file..."

# Main RTB Module
touch "$RTB_BASE/rtb.module.ts"

echo "✅ RTB Directory Structure Created Successfully!"
echo ""
echo "📊 Summary:"
echo "   - 🗂️  Total Directories: $(find $RTB_BASE -type d | wc -l)"
echo "   - 📄 Total Files: $(find $RTB_BASE -type f | wc -l)"
echo ""
echo "📍 Structure created at: $RTB_BASE"
echo ""
echo "🚀 Next Steps:"
echo "   1. Start with core types and interfaces"
echo "   2. Implement domain modules one by one"
echo "   3. Migrate existing services to new structure"
echo "   4. Update imports and dependencies"
echo ""
echo "💡 Tip: Use 'tree $RTB_BASE' to view the complete structure"