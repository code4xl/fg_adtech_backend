// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../../prisma/prisma.service';
// import { KafkaService } from '../../kafka/kafka.service';
// import { RedisService } from '../../redis/redis.service';
// import { RTBCacheService } from './rtb-cache.service';
// import { CampaignEligibilityService } from './campaign-eligibility.service';
// import { CreateBidRequestDto, BidResponseDto, HealthCheckDto } from '../dto';

// import { v4 as uuidv4 } from 'uuid';
// import RTBProducer from '../producer/rtb.producer';

// @Injectable()
// export class RTBService {
//   private readonly logger = new Logger(RTBService.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly redis: RedisService,
//     private readonly rtbProducer: RTBProducer,
//   ) {
//     this.logger.log('RTB Service initialized - Phase 3 Complete');
//   }





//   private async recordProcessingMetrics(
//     requestId: string,
//     processingTime: number,
//   ): Promise<void> {
//     try {
//       // Update hourly metrics
//       const hour = new Date().getHours();
//       const metricsKey = `metrics:requests:${hour}`;

//       await Promise.all([
//         this.redis.incr(metricsKey),
//         this.redis.incrby(`metrics:latency:${hour}`, processingTime),
//         this.redis.expire(metricsKey, 7200), // 2 hours TTL
//       ]);
//     } catch (error) {
//       this.logger.warn('Failed to record processing metrics', {
//         error: error.message,
//         requestId,
//       });
//     }
//   }

//   private async recordErrorMetrics(
//     requestId: string,
//     errorMessage: string,
//   ): Promise<void> {
//     try {
//       const hour = new Date().getHours();
//       const errorKey = `metrics:errors:${hour}`;

//       await this.redis.incr(errorKey);
//       await this.redis.expire(errorKey, 7200); // 2 hours TTL
//     } catch (error) {
//       this.logger.warn('Failed to record error metrics', {
//         error: error.message,
//       });
//     }
//   }
// }
