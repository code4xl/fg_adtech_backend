#!/bin/bash

# Simple RTB File Structure Creation Script
# Run this from your project root directory

echo "🚀 Creating Simple RTB Directory Structure..."

# Base RTB directory
RTB_BASE="src/rtb"

echo "📁 Creating main directories..."

# Core structure - much simpler
mkdir -p "$RTB_BASE/types"
mkdir -p "$RTB_BASE/constants"
mkdir -p "$RTB_BASE/services"
mkdir -p "$RTB_BASE/processors"
mkdir -p "$RTB_BASE/consumers"
mkdir -p "$RTB_BASE/producers"
mkdir -p "$RTB_BASE/controllers"
mkdir -p "$RTB_BASE/utils"
mkdir -p "$RTB_BASE/filters"

echo "📄 Creating core files..."

# Types (for type safety)
touch "$RTB_BASE/types/bid-request.types.ts"
touch "$RTB_BASE/types/bid-response.types.ts"
touch "$RTB_BASE/types/auction.types.ts"
touch "$RTB_BASE/types/campaign.types.ts"
touch "$RTB_BASE/types/targeting.types.ts"
touch "$RTB_BASE/types/budget.types.ts"
touch "$RTB_BASE/types/index.ts"

# Constants (centralized config)
touch "$RTB_BASE/constants/rtb-config.ts"
touch "$RTB_BASE/constants/cache-keys.ts"
touch "$RTB_BASE/constants/kafka-topics.ts"
touch "$RTB_BASE/constants/timeouts.ts"
touch "$RTB_BASE/constants/index.ts"

# Core Services
touch "$RTB_BASE/services/auction.service.ts"
touch "$RTB_BASE/services/campaign-eligibility.service.ts"
touch "$RTB_BASE/services/bid-evaluation.service.ts"
touch "$RTB_BASE/services/budget-manager.service.ts"
touch "$RTB_BASE/services/targeting-engine.service.ts"
touch "$RTB_BASE/services/rtb-cache.service.ts"
touch "$RTB_BASE/services/rtb-metrics.service.ts"

# Processors (business logic)
touch "$RTB_BASE/processors/bid-request.processor.ts"
touch "$RTB_BASE/processors/bid-response.processor.ts"
touch "$RTB_BASE/processors/auction.processor.ts"

# Consumers (Kafka)
touch "$RTB_BASE/consumers/bid-request.consumer.ts"
touch "$RTB_BASE/consumers/auction-result.consumer.ts"
touch "$RTB_BASE/consumers/tracking.consumer.ts"

# Producers (Kafka)
touch "$RTB_BASE/producers/auction.producer.ts"
touch "$RTB_BASE/producers/metrics.producer.ts"

# Controllers
touch "$RTB_BASE/controllers/rtb.controller.ts"
touch "$RTB_BASE/controllers/health.controller.ts"

# Utils
touch "$RTB_BASE/utils/transformers.ts"
touch "$RTB_BASE/utils/validators.ts"
touch "$RTB_BASE/utils/helpers.ts"

# Targeting Filters (missing functionality)
touch "$RTB_BASE/filters/geographic-filter.ts"
touch "$RTB_BASE/filters/demographic-filter.ts"
touch "$RTB_BASE/filters/device-filter.ts"
touch "$RTB_BASE/filters/behavioral-filter.ts"
touch "$RTB_BASE/filters/frequency-filter.ts"
touch "$RTB_BASE/filters/time-filter.ts"
touch "$RTB_BASE/filters/budget-filter.ts"

# Main module
touch "$RTB_BASE/rtb.module.ts"

echo "✅ Simple RTB Structure Created!"
echo ""
echo "📊 Summary:"
echo "   - 🗂  Directories: $(find $RTB_BASE -type d | wc -l)"
echo "   - 📄 Files: $(find $RTB_BASE -type f | wc -l)"
echo ""
echo "📁 Structure:"
echo "src/rtb/"
echo "├── types/           # TypeScript interfaces"
echo "├── constants/       # Config & constants"
echo "├── services/        # Business logic"
echo "├── processors/      # Data processing"
echo "├── consumers/       # Kafka consumers"
echo "├── producers/       # Kafka producers"
echo "├── controllers/     # HTTP endpoints"
echo "├── utils/           # Helper functions"
echo "├── filters/         # Targeting filters"
echo "└── rtb.module.ts    # Main module"
echo ""
echo "🎯 Focus Areas:"
echo "   1. types/ - Add strong typing"
echo "   2. filters/ - Implement missing targeting"
echo "   3. services/ - Organize business logic"
echo "   4. constants/ - Centralize configuration"