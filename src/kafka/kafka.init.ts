// src/kafka/kafka.init.ts
import {
  Injectable,
  OnApplicationBootstrap,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { kafkaTopics } from 'src/rtb/constants/kafka-topics';

/**
 * Enhanced Kafka Initialization Service
 *
 * This service creates all necessary Kafka topics during application startup.
 *
 * Why we need this:
 * - Ensures all required topics exist before consumers try to subscribe
 * - Creates topics with optimal partition/replication settings
 * - Handles both existing and new RTB-specific topics
 *
 * Changes from original:
 * - Added new RTB processing topics
 * - Added enhanced tracking topics
 * - Added optimization and analytics topics
 * - Improved error handling and logging
 */
@Injectable()
export class KafkaInitService implements OnModuleInit {
  private readonly logger = new Logger(KafkaInitService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing Kafka topics...');

      await this.kafkaService.createTopics([
        {
          topic: kafkaTopics.BID_REQUESTS,
          numPartitions: 6, // Higher partitions for high throughput
          replicationFactor: 1, // Single replica for development
        },
        {
          topic: kafkaTopics.BID_RESPONSES,
          numPartitions: 6, // Match bid requests partitioning
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.AUCTION_RESULTS,
          numPartitions: 3, // Lower volume, fewer partitions needed
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.IMPRESSIONS,
          numPartitions: 8, // High volume tracking events
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.CAMPAIGN_METRICS,
          numPartitions: 3, // Aggregated data, lower volume
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.TIMESCALE_SYNC,
          numPartitions: 2, // Batch processing, lower throughput
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.DLQ_BID_REQUESTS,
          numPartitions: 1, // Error handling, single partition sufficient
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.DLQ_TRACKING,
          numPartitions: 1, // Error handling, single partition sufficient
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.RTB_OPTIMIZATION,
          numPartitions: 2, // Lower volume optimization data
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.CAMPAIGN_BUDGET_ALERTS,
          numPartitions: 1, // Alert system, single partition
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.PERFORMANCE_UPDATES,
          numPartitions: 3, // Performance metrics updates
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.BID_ELIGIBILITY_CHECK,
          numPartitions: 4, // Campaign eligibility processing
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.AUCTION_PREPROCESSING,
          numPartitions: 3, // Pre-auction data preparation
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.CREATIVE_PERFORMANCE_UPDATE,
          numPartitions: 2, // Creative performance metrics
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.BUDGET_EXHAUSTION_ALERT,
          numPartitions: 1, // Budget alerts, single partition
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.FRAUD_DETECTION,
          numPartitions: 2, // Fraud detection events
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.GOOGLE_BID_REQUESTS,
          numPartitions: 3, // External integration
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.GOOGLE_BID_RESPONSES,
          numPartitions: 3, // External integration
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.CLICKS,
          numPartitions: 4, // Lower volume than impressions
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.AUCTION_PROCESSING,
          numPartitions: 10, // Lower volume than impressions
          replicationFactor: 1,
        },

        {
          topic: kafkaTopics.FRAUD_ALERTS,
          numPartitions: 1, // Alert system, single partition
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.DLQ_AUCTIONS,
          numPartitions: 1, // Alert system, single partition
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.PERFORMANCE_ALERTS,
          numPartitions: 1, // Alert system, single partition
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.AUCTION_COMPLETION,
          numPartitions: 3, // Moderate volume for auction completions
          replicationFactor: 1,
        },
      ]);

      this.logger.log('✅ All Kafka topics created successfully');

      // Log topic configuration for debugging
      // this.logTopicConfiguration();
    } catch (error) {
      this.logger.error('❌ Failed to create Kafka topics:', error);

      // In development, we can continue without failing
      // In production, you might want to throw the error
      if (process.env.NODE_ENV === 'production') {
        throw error;
      } else {
        this.logger.warn(
          '⚠️  Continuing in development mode despite Kafka topic creation failure',
        );
      }
    }
  }

  /**
   * Log topic configuration for debugging and monitoring
   */
  // private logTopicConfiguration(): void {
  //   this.logger.debug('📋 Kafka Topic Configuration:');

  //   const topicGroups = {
  //     'Core RTB Flow': [
  //       kafkaTopics.BID_REQUESTS,
  //       kafkaTopics.BID_RESPONSES,
  //       kafkaTopics.AUCTION_RESULTS,
  //     ],
  //     'Tracking Events': [kafkaTopics.IMPRESSIONS, kafkaTopics.CLICKS],
  //     Analytics: [kafkaTopics.CAMPAIGN_METRICS, kafkaTopics.TIMESCALE_SYNC],
  //     'Error Handling': [
  //       kafkaTopics.DLQ_BID_REQUESTS,
  //       kafkaTopics.DLQ_TRACKING,
  //     ],
  //     Optimization: [
  //       kafkaTopics.RTB_OPTIMIZATION,
  //       kafkaTopics.CAMPAIGN_BUDGET_ALERTS,
  //       kafkaTopics.PERFORMANCE_UPDATES,
  //     ],
  //   };

  //   Object.entries(topicGroups).forEach(([group, topics]) => {
  //     this.logger.debug(`  ${group}:`);
  //     topics.forEach((topic) => {
  //       this.logger.debug(`    - ${topic}`);
  //     });
  //   });
  // }

  /**
   * Health check method to verify topics exist
   */
  async verifyTopicsExist(): Promise<{
    success: boolean;
    missingTopics: string[];
  }> {
    try {
      const allTopics = Object.values(kafkaTopics);
      const missingTopics: string[] = [];

      // Check each topic (simplified for Phase 1)
      for (const topic of allTopics) {
        const exists = await this.kafkaService.checkTopicExists(topic);
        if (!exists) {
          missingTopics.push(topic);
        }
      }

      if (missingTopics.length > 0) {
        this.logger.warn(`⚠️  Missing topics: ${missingTopics.join(', ')}`);
        return { success: false, missingTopics };
      }

      this.logger.log('✅ All required topics verified');
      return { success: true, missingTopics: [] };
    } catch (error) {
      this.logger.error('❌ Failed to verify topics:', error);
      return { success: false, missingTopics: [] };
    }
  }
}
