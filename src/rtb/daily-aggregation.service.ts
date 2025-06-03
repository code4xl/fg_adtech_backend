// import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { PrismaService } from 'src/prisma/prisma.service';

// @Injectable()
// export class DailyAggregationService {
//   private readonly logger = new Logger(DailyAggregationService.name);

//   constructor(private readonly prisma: PrismaService) {}

//   @Cron(CronExpression.EVERY_DAY_AT_1AM)
//   async aggregateYesterdayStats() {
//     try {
//       this.logger.log('Running daily aggregation for yesterday...');

//       const yesterday = new Date();
//       yesterday.setDate(yesterday.getDate() - 1);
//       yesterday.setHours(0, 0, 0, 0);

//       // Format date for PostgreSQL
//       const formattedDate = yesterday.toISOString().split('T')[0];

//       // Call the stored procedure
//       await this.prisma
//         .$queryRaw`SELECT aggregate_daily_stats(${formattedDate}::date)`;

//       this.logger.log(`Successfully aggregated stats for ${formattedDate}`);
//     } catch (error) {
//       this.logger.error(
//         `Error in daily aggregation: ${error.message}`,
//         error.stack,
//       );
//     }
//   }

//   // Method to manually trigger aggregation for a date range
//   async aggregateDateRange(startDate: Date, endDate: Date) {
//     try {
//       this.logger.log(
//         `Running aggregation for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
//       );

//       // Format dates for PostgreSQL
//       const formattedStartDate = startDate.toISOString().split('T')[0];
//       const formattedEndDate = endDate.toISOString().split('T')[0];

//       // Call the stored procedure
//       await this.prisma
//         .$queryRaw`SELECT aggregate_date_range(${formattedStartDate}::date, ${formattedEndDate}::date)`;

//       this.logger.log(`Successfully aggregated stats for date range`);
//     } catch (error) {
//       this.logger.error(
//         `Error in date range aggregation: ${error.message}`,
//         error.stack,
//       );
//     }
//   }
// }
