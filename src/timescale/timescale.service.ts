// import { Injectable, Logger } from '@nestjs/common';
// import { TimescaleDBConnection } from './timescale-connection.service';
// import { KafkaService } from '../kafka/kafka.service';
// import {
//   TimescaleImpressionDto,
//   TimescaleClickDto,
//   TimescaleBidMetricDto,
// } from '../rtb_old/dto/tracking-events.dto';
// import { from as copyFrom } from 'pg-copy-streams';

// @Injectable()
// export class TimescaleService {
//   private readonly logger = new Logger(TimescaleService.name);

//   constructor(
//     private readonly timescaleDb: TimescaleDBConnection,
//     private readonly kafka: KafkaService,
//   ) {
//     this.logger.debug('TimescaleDB Service initialized - Phase 6');
//   }

//   /**
//    * Write impression events to TimescaleDB
//    *
//    * **Why batch processing:**
//    * - TimescaleDB performs much better with bulk inserts
//    * - Reduces connection overhead for high-volume data
//    * - Enables efficient compression and indexing
//    */
//   async writeImpressions(impressions: TimescaleImpressionDto[]): Promise<{
//     success: boolean;
//     processedCount: number;
//     errors: any[];
//   }> {
//     const startTime = Date.now();
//     const errors: any[] = [];
//     let processedCount = 0;

//     this.logger.debug(
//       `Writing ${impressions.length} impressions to TimescaleDB`,
//     );

//     try {
//       await this.timescaleDb.transaction(async (client) => {
//         // Use COPY for optimal bulk insert performance
//         const copyQuery = `
//                     COPY rtb_impressions (
//                         timestamp, impression_id, creative_id, campaign_id, advertiser_id,
//                         inventory_id, publisher_id, website_id, price, publisher_revenue,
//                         user_id, session_id, user_agent, ip_address, device_type,
//                         browser_type, os_type, country, region, city, viewable,
//                         view_time, viewable_pixels, ad_size_pixels, is_bot,
//                         fraud_score, referrer_url, page_url, page_category
//                     ) FROM STDIN WITH CSV
//                 `;

//         const stream = client.query(copyFrom(copyQuery));

//         for (const impression of impressions) {
//           try {
//             const row =
//               [
//                 impression.timestamp,
//                 impression.impression_id,
//                 impression.creative_id,
//                 impression.campaign_id,
//                 impression.advertiser_id,
//                 impression.inventory_id,
//                 impression.publisher_id,
//                 impression.website_id,
//                 impression.price || null,
//                 impression.publisher_revenue || null,
//                 impression.user_id || null,
//                 impression.session_id || null,
//                 impression.user_agent || null,
//                 impression.ip_address || null,
//                 impression.device_type || null,
//                 impression.browser_type || null,
//                 impression.os_type || null,
//                 impression.country || null,
//                 impression.region || null,
//                 impression.city || null,
//                 impression.viewable || null,
//                 impression.view_time || null,
//                 impression.viewable_pixels || null,
//                 impression.ad_size_pixels || null,
//                 impression.is_bot || false,
//                 impression.fraud_score || null,
//                 impression.referrer_url || null,
//                 impression.page_url || null,
//                 impression.page_category || null,
//               ].join(',') + '\n';

//             stream.write(row);
//             processedCount++;
//           } catch (error) {
//             errors.push({
//               impression: impression.impression_id,
//               error: error.message,
//             });
//           }
//         }

//         await new Promise((resolve, reject) => {
//           stream.end((err) => {
//             if (err) reject(err);
//             else resolve(undefined);
//           });
//         });
//       });

//       const processingTime = Date.now() - startTime;
//       this.logger.debug(
//         ` Successfully wrote ${processedCount} impressions to TimescaleDB in ${processingTime}ms`,
//       );

//       return {
//         success: true,
//         processedCount,
//         errors,
//       };
//     } catch (error) {
//       this.logger.error(
//         '❌ Failed to write impressions to TimescaleDB:',
//         error,
//       );
//       return {
//         success: false,
//         processedCount,
//         errors: [...errors, { error: error.message }],
//       };
//     }
//   }

//   async writeClicks(clicks: TimescaleClickDto[]): Promise<{
//     success: boolean;
//     processedCount: number;
//     errors: any[];
//   }> {
//     const startTime = Date.now();
//     const errors: any[] = [];
//     let processedCount = 0;

//     this.logger.debug(`Writing ${clicks.length} clicks to TimescaleDB`);

//     try {
//       await this.timescaleDb.transaction(async (client) => {
//         const copyQuery = `
//                     COPY rtb_clicks (
//                         timestamp, click_id, impression_id, creative_id, campaign_id,
//                         advertiser_id, inventory_id, publisher_id, click_x, click_y,
//                         time_from_impression, user_id, session_id, user_agent,
//                         ip_address, device_type, country, region, city,
//                         is_bot, fraud_score
//                     ) FROM STDIN WITH CSV
//                 `;

//         const stream = client.query(copyFrom(copyQuery));

//         for (const click of clicks) {
//           try {
//             const row =
//               [
//                 click.timestamp,
//                 click.click_id,
//                 click.impression_id || null,
//                 click.creative_id,
//                 click.campaign_id,
//                 click.advertiser_id,
//                 click.inventory_id,
//                 click.publisher_id,
//                 click.click_x || null,
//                 click.click_y || null,
//                 click.time_from_impression || null,
//                 click.user_id || null,
//                 click.session_id || null,
//                 click.user_agent || null,
//                 click.ip_address || null,
//                 click.device_type || null,
//                 click.country || null,
//                 click.region || null,
//                 click.city || null,
//                 click.is_bot || false,
//                 click.fraud_score || null,
//               ].join(',') + '\n';

//             stream.write(row);
//             processedCount++;
//           } catch (error) {
//             errors.push({ click: click.click_id, error: error.message });
//           }
//         }

//         await new Promise((resolve, reject) => {
//           stream.end((err) => {
//             if (err) reject(err);
//             else resolve(undefined);
//           });
//         });
//       });

//       const processingTime = Date.now() - startTime;
//       this.logger.debug(
//         ` Successfully wrote ${processedCount} clicks to TimescaleDB in ${processingTime}ms`,
//       );

//       return {
//         success: true,
//         processedCount,
//         errors,
//       };
//     } catch (error) {
//       this.logger.error('❌ Failed to write clicks to TimescaleDB:', error);
//       return {
//         success: false,
//         processedCount,
//         errors: [...errors, { error: error.message }],
//       };
//     }
//   }

//   async writeBidMetrics(metrics: TimescaleBidMetricDto[]): Promise<{
//     success: boolean;
//     processedCount: number;
//     errors: any[];
//   }> {
//     const startTime = Date.now();
//     const errors: any[] = [];
//     let processedCount = 0;

//     this.logger.debug(`Writing ${metrics.length} bid metrics to TimescaleDB`);

//     try {
//       await this.timescaleDb.transaction(async (client) => {
//         const copyQuery = `
//                     COPY rtb_bid_metrics (
//                         timestamp, bid_response_id, campaign_id, inventory_id,
//                         bid_price, final_price, won, response_time_ms,
//                         auction_duration_ms, total_bids, valid_bids,
//                         targeting_score, quality_score
//                     ) FROM STDIN WITH CSV
//                 `;

//         const stream = client.query(copyFrom(copyQuery));

//         for (const metric of metrics) {
//           try {
//             const row =
//               [
//                 metric.timestamp,
//                 metric.bid_response_id,
//                 metric.campaign_id,
//                 metric.inventory_id,
//                 metric.bid_price || null,
//                 metric.final_price || null,
//                 metric.won || false,
//                 metric.response_time_ms || null,
//                 metric.auction_duration_ms || null,
//                 metric.total_bids || null,
//                 metric.valid_bids || null,
//                 metric.targeting_score || null,
//                 metric.quality_score || null,
//               ].join(',') + '\n';

//             stream.write(row);
//             processedCount++;
//           } catch (error) {
//             errors.push({
//               metric: metric.bid_response_id,
//               error: error.message,
//             });
//           }
//         }

//         await new Promise((resolve, reject) => {
//           stream.end((err) => {
//             if (err) reject(err);
//             else resolve(undefined);
//           });
//         });
//       });

//       const processingTime = Date.now() - startTime;
//       this.logger.debug(
//         ` Successfully wrote ${processedCount} bid metrics to TimescaleDB in ${processingTime}ms`,
//       );

//       return {
//         success: true,
//         processedCount,
//         errors,
//       };
//     } catch (error) {
//       this.logger.error(
//         '❌ Failed to write bid metrics to TimescaleDB:',
//         error,
//       );
//       return {
//         success: false,
//         processedCount,
//         errors: [...errors, { error: error.message }],
//       };
//     }
//   }

//   private formatImpressionForTimescale(
//     impression: any,
//   ): TimescaleImpressionDto {
//     return {
//       timestamp: impression.timestamp || new Date().toISOString(),
//       impression_id: impression.id,
//       creative_id: impression.creativeId,
//       campaign_id: impression.campaignId,
//       advertiser_id: impression.advertiserId,
//       inventory_id: impression.inventoryId,
//       publisher_id: impression.publisherId,
//       website_id: impression.websiteId,
//       price: impression.price
//         ? parseFloat(impression.price.toString())
//         : undefined,
//       publisher_revenue: impression.publisherRevenue
//         ? parseFloat(impression.publisherRevenue.toString())
//         : undefined,
//       user_id: impression.userId,
//       session_id: impression.sessionId,
//       user_agent: impression.userAgent,
//       ip_address: impression.ipAddress,
//       device_type: impression.deviceType,
//       browser_type: impression.browserType,
//       os_type: impression.osType,
//       country: impression.country,
//       region: impression.region,
//       city: impression.city,
//       viewable: impression.viewable,
//       view_time: impression.viewTime,
//       viewable_pixels: impression.viewablePixels,
//       ad_size_pixels: impression.adSizePixels,
//       is_bot: impression.isBot || false,
//       fraud_score: impression.fraudScore,
//       referrer_url: impression.referrerUrl,
//       page_url: impression.pageUrl,
//       page_category: impression.pageCategory,
//     };
//   }

//   private formatClickForTimescale(click: any) {
//     return {
//       timestamp: click.timestamp?.toISOString() || new Date().toISOString(),
//       click_id: click.id,
//       impression_id: click.impressionId,
//       creative_id: click.creativeId,
//       campaign_id: click.campaignId,
//       advertiser_id: click.advertiserId,
//       inventory_id: click.inventoryId,
//       publisher_id: click.publisherId,
//       click_x: click.clickX,
//       click_y: click.clickY,
//       time_from_impression: click.timeFromImpression,
//       user_id: click.userId,
//       session_id: click.sessionId,
//       user_agent: click.userAgent,
//       ip_address: click.ipAddress,
//       device_type: click.deviceType,
//       country: click.country,
//       region: click.region,
//       city: click.city,
//       is_bot: click.isBot || false,
//       fraud_score: click.fraudScore,
//     };
//   }
//   // Add these methods to your TimescaleService class

//   async query(sql: string, params?: any[]): Promise<any> {
//     // Implementation depends on your database setup
//     // Example for node-postgres:
//     const client = await this.timescaleDb.getClient();
//     try {
//       const result = await client.query(sql, params);
//       return result;
//     } finally {
//       client.release();
//     }
//   }

//   async healthCheck(): Promise<{ status: string; details?: any }> {
//     try {
//       await this.query('SELECT 1');
//       return { status: 'healthy' };
//     } catch (error) {
//       this.logger.error('TimescaleDB health check failed:', error);
//       return { status: 'unhealthy', details: { error: error.message } };
//     }
//   }

//   async insertRecord(tableName: string, record: any): Promise<any> {
//     const columns = Object.keys(record).join(', ');
//     const values = Object.values(record);
//     const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

//     const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;

//     const result = await this.timescaleDb.query(sql, values);
//     return result.rows[0];
//   }
//   async syncUnsyncedRecords(
//     tableName: 'impressions' | 'clicks',
//     batchSize: number,
//   ): Promise<{ syncedCount: number; errors?: any[] }> {
//     // Implementation for syncing unsynced records
//     const sql = `
//     SELECT * FROM ${tableName}
//     WHERE created_at > $1 AND synced_to_timescale = false
//     ORDER BY created_at ASC
//   `;

//     const records = await this.query(sql, [batchSize]);
//     let processedCount = 0;
//     // Process records...
//     for (const record of records.rows) {
//       await this.insertRecord(tableName, record);
//       processedCount++;
//     }
//     return { syncedCount: processedCount };
//   }

//   async getCampaignMetrics(
//     campaignId: string,
//     startDate: Date,
//     endDate: Date,
//   ): Promise<any> {
//     const sql = `
//     SELECT
//       campaign_id,
//       COUNT(*) as impression_count,
//       SUM(price) as total_spend,
//       COUNT(DISTINCT user_id) as unique_users
//     FROM impressions
//     WHERE campaign_id = $1
//       AND timestamp BETWEEN $2 AND $3
//     GROUP BY campaign_id
//   `;

//     return this.query(sql, [campaignId, startDate, endDate]);
//   }

//   async getRealtimeMetrics(interval): Promise<any> {
//     const sql = `
//     SELECT
//       DATE_TRUNC('hour', timestamp) as hour,
//       COUNT(*) as impression_count,
//       SUM(price) as total_spend
//     FROM impressions
//     WHERE timestamp >= NOW() - INTERVAL ${interval}
//     GROUP BY hour
//     ORDER BY hour DESC
//   `;

//     return this.query(sql);
//   }
// }

// src/timescale/timescale.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

export interface WriteResult {
  success: boolean;
  processedCount: number;
  errors?: string[];
}

export interface TimescaleImpressionData {
  timestamp: Date;
  impression_id: string;
  creative_id: string;
  campaign_id: string;
  advertiser_id: string;
  inventory_id: string;
  publisher_id: string;
  website_id?: string;
  price: number;
  publisher_revenue: number;
  user_id?: string;
  session_id?: string;
  user_agent?: string;
  ip_address?: string;
  device_type?: string;
  browser_type?: string;
  os_type?: string;
  country?: string;
  region?: string;
  city?: string;
  viewable?: boolean;
  view_time?: number;
  viewable_pixels?: number;
  ad_size_pixels?: string;
  is_bot?: boolean;
  fraud_score?: number;
  referrer_url?: string;
  page_url?: string;
  page_category?: string;
}

export interface TimescaleClickData {
  timestamp: Date;
  click_id: string;
  impression_id?: string;
  creative_id: string;
  campaign_id: string;
  advertiser_id: string;
  inventory_id: string;
  publisher_id: string;
  click_x?: number;
  click_y?: number;
  time_from_impression?: number;
  user_id?: string;
  session_id?: string;
  user_agent?: string;
  ip_address?: string;
  device_type?: string;
  country?: string;
  region?: string;
  city?: string;
  is_bot?: boolean;
  fraud_score?: number;
}

@Injectable()
export class TimescaleService implements OnModuleInit {
  private readonly logger = new Logger(TimescaleService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeConnection();
  }

  /**
   * Initialize TimescaleDB connection pool
   */
  private async initializeConnection(): Promise<void> {
    try {
      // Get TimescaleDB configuration
      const timescaleConfig = {
        host: this.configService.get<string>('TIMESCALEDB_HOST', 'localhost'),
        port: this.configService.get<number>('TIMESCALEDB_PORT', 5432),
        database: this.configService.get<string>(
          'TIMESCALEDB_DATABASE',
          'rtb_analytics',
        ),
        user: this.configService.get<string>('TIMESCALEDB_USER', 'postgres'),
        password: this.configService.get<string>(
          'TIMESCALEDB_PASSWORD',
          'password',
        ),
      };

      // this.logger.debug('🔄 Initializing TimescaleDB connection', {
      //   host: timescaleConfig.host,
      //   port: timescaleConfig.port,
      //   database: timescaleConfig.database,
      //   user: timescaleConfig.user,
      // });

      this.pool = new Pool({
        ...timescaleConfig,
        // Optimized for time-series workloads
        max: this.configService.get<number>('TIMESCALEDB_POOL_SIZE', 20),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: this.configService.get<number>(
          'TIMESCALEDB_POOL_TIMEOUT',
          5000,
        ),

        // Application name for monitoring
        application_name: 'rtb-timescale-client',

        // SSL configuration for production
        ssl:
          false,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query(
        'SELECT NOW() as current_time, version() as version',
      );
      client.release();

      // this.logger.debug(' TimescaleDB connection established successfully', {
      //   currentTime: result.rows[0].current_time,
      //   version: result.rows[0].version,
      // });
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize TimescaleDB connection:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get a database client from the pool
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      this.logger.debug('TimescaleDB query executed', {
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('TimescaleDB transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Write impressions to TimescaleDB in bulk
   */
  async writeImpressions(
    impressions: TimescaleImpressionData[],
  ): Promise<WriteResult> {
    if (impressions.length === 0) {
      return { success: true, processedCount: 0 };
    }

    const startTime = Date.now();

    try {
      const insertQuery = `
        INSERT INTO rtb_impressions (
          timestamp, impression_id, creative_id, campaign_id, advertiser_id,
          inventory_id, publisher_id, website_id, price, publisher_revenue,
          user_id, session_id, user_agent, ip_address, device_type,
          browser_type, os_type, country, region, city, viewable,
          view_time, viewable_pixels, ad_size_pixels, is_bot, fraud_score,
          referrer_url, page_url, page_category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        ON CONFLICT (timestamp, impression_id) DO NOTHING
      `;

      const result = await this.transaction(async (client) => {
        let insertedCount = 0;

        for (const impression of impressions) {
          const values = [
            impression.timestamp,
            impression.impression_id,
            impression.creative_id,
            impression.campaign_id,
            impression.advertiser_id,
            impression.inventory_id,
            impression.publisher_id,
            impression.website_id || null,
            impression.price,
            impression.publisher_revenue,
            impression.user_id || null,
            impression.session_id || null,
            impression.user_agent || null,
            impression.ip_address || null,
            impression.device_type || null,
            impression.browser_type || null,
            impression.os_type || null,
            impression.country || null,
            impression.region || null,
            impression.city || null,
            impression.viewable || false,
            impression.view_time || null,
            impression.viewable_pixels || null,
            impression.ad_size_pixels || null,
            impression.is_bot || false,
            impression.fraud_score || null,
            impression.referrer_url || null,
            impression.page_url || null,
            impression.page_category || null,
          ];

          const insertResult = await client.query(insertQuery, values);
          insertedCount += insertResult.rowCount || 0;
        }

        return insertedCount;
      });

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Impressions written to TimescaleDB', {
        requested: impressions.length,
        inserted: result,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        processedCount: result,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Failed to write impressions to TimescaleDB:', {
        error: error.message,
        requestedCount: impressions.length,
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        processedCount: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Write clicks to TimescaleDB in bulk
   */
  async writeClicks(clicks: TimescaleClickData[]): Promise<WriteResult> {
    if (clicks.length === 0) {
      return { success: true, processedCount: 0 };
    }

    const startTime = Date.now();

    try {
      const insertQuery = `
        INSERT INTO rtb_clicks (
          timestamp, click_id, impression_id, creative_id, campaign_id,
          advertiser_id, inventory_id, publisher_id, click_x, click_y,
          time_from_impression, user_id, session_id, user_agent, ip_address,
          device_type, country, region, city, is_bot, fraud_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (timestamp, click_id) DO NOTHING
      `;

      const result = await this.transaction(async (client) => {
        let insertedCount = 0;

        for (const click of clicks) {
          const values = [
            click.timestamp,
            click.click_id,
            click.impression_id || null,
            click.creative_id,
            click.campaign_id,
            click.advertiser_id,
            click.inventory_id,
            click.publisher_id,
            click.click_x || null,
            click.click_y || null,
            click.time_from_impression || null,
            click.user_id || null,
            click.session_id || null,
            click.user_agent || null,
            click.ip_address || null,
            click.device_type || null,
            click.country || null,
            click.region || null,
            click.city || null,
            click.is_bot || false,
            click.fraud_score || null,
          ];

          const insertResult = await client.query(insertQuery, values);
          insertedCount += insertResult.rowCount || 0;
        }

        return insertedCount;
      });

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Clicks written to TimescaleDB', {
        requested: clicks.length,
        inserted: result,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        processedCount: result,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Failed to write clicks to TimescaleDB:', {
        error: error.message,
        requestedCount: clicks.length,
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        processedCount: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Get campaign metrics from TimescaleDB
   */
  async getCampaignMetrics(
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const query = `
      SELECT
        campaign_id,
        COUNT(*) as impression_count,
        SUM(price) as total_spend,
        AVG(view_time) as avg_view_time,
        COUNT(*) FILTER (WHERE viewable = true) as viewable_impressions,
        COUNT(DISTINCT user_id) as unique_users
      FROM rtb_impressions
      WHERE campaign_id = $1
        AND timestamp BETWEEN $2 AND $3
      GROUP BY campaign_id
    `;

    try {
      const result = await this.query(query, [campaignId, startDate, endDate]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get campaign metrics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getRealtimeMetrics(interval: string = '1 hour'): Promise<any> {
    const query = `
      SELECT
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as impression_count,
        SUM(price) as total_spend,
        COUNT(DISTINCT campaign_id) as active_campaigns
      FROM rtb_impressions
      WHERE timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `;

    try {
      const result = await this.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get realtime metrics:', error);
      throw error;
    }
  }

  /**
   * Get click-through rates by campaign
   */
  async getCampaignCTR(campaignId: string, hours: number = 24): Promise<any> {
    const query = `
      WITH impression_counts AS (
        SELECT campaign_id, COUNT(*) as impressions
        FROM rtb_impressions
        WHERE campaign_id = $1 
          AND timestamp >= NOW() - INTERVAL '${hours} hours'
        GROUP BY campaign_id
      ),
      click_counts AS (
        SELECT campaign_id, COUNT(*) as clicks
        FROM rtb_clicks
        WHERE campaign_id = $1 
          AND timestamp >= NOW() - INTERVAL '${hours} hours'
        GROUP BY campaign_id
      )
      SELECT 
        i.campaign_id,
        i.impressions,
        COALESCE(c.clicks, 0) as clicks,
        CASE 
          WHEN i.impressions > 0 THEN ROUND((COALESCE(c.clicks, 0)::decimal / i.impressions) * 100, 2)
          ELSE 0
        END as ctr_percentage
      FROM impression_counts i
      LEFT JOIN click_counts c ON i.campaign_id = c.campaign_id
    `;

    try {
      const result = await this.query(query, [campaignId]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get campaign CTR:', error);
      throw error;
    }
  }

  /**
   * Health check for TimescaleDB
   */
  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      const result = await this.query(
        'SELECT NOW() as current_time, version() as version',
      );

      const poolStats = {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingConnections: this.pool.waitingCount,
      };

      return {
        status: 'healthy',
        details: {
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version,
          connectionPool: poolStats,
        },
      };
    } catch (error) {
      this.logger.error('TimescaleDB health check failed:', error);
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }

  /**
   * Get data retention status
   */
  async getRetentionStatus(): Promise<any> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE tablename IN ('rtb_impressions', 'rtb_clicks')
    `;

    try {
      const result = await this.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get retention status:', error);
      throw error;
    }
  }

  /**
   * Clean up old data (if needed)
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      await this.transaction(async (client) => {
        // Delete old impressions
        const impressionResult = await client.query(
          'DELETE FROM rtb_impressions WHERE timestamp < $1',
          [cutoffDate],
        );

        // Delete old clicks
        const clickResult = await client.query(
          'DELETE FROM rtb_clicks WHERE timestamp < $1',
          [cutoffDate],
        );

        this.logger.debug(' Old data cleanup completed', {
          cutoffDate: cutoffDate.toISOString(),
          deletedImpressions: impressionResult.rowCount,
          deletedClicks: clickResult.rowCount,
        });
      });
    } catch (error) {
      this.logger.error('❌ Failed to cleanup old data:', error);
      throw error;
    }
  }

  /**
   * Bulk insert impressions to TimescaleDB (matching your PostgreSQL schema)
   */
  async bulkInsertImpressions(impressions: any[]): Promise<WriteResult> {
    if (impressions.length === 0) {
      return { success: true, processedCount: 0 };
    }

    const startTime = Date.now();

    try {
      const result = await this.transaction(async (client) => {
        let insertedCount = 0;

        // Use batch insert for better performance
        const batchSize = 1000;
        for (let i = 0; i < impressions.length; i += batchSize) {
          const batch = impressions.slice(i, i + batchSize);

          const values = batch
            .map((imp, index) => {
              const baseIndex = i * 29 + index * 29; // 29 fields per record
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, 
                            $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, 
                            $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, 
                            $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, 
                            $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, 
                            $${baseIndex + 26}, $${baseIndex + 27}, $${baseIndex + 28}, $${baseIndex + 29})`;
            })
            .join(',');

          const insertQuery = `
                    INSERT INTO impression_events (
                        id, creative_id, bid_response_id, campaign_id, advertiser_id,
                        inventory_id, publisher_id, website_id, template_id, bid_price,
                        final_price, timestamp, user_agent, ip_address, device_type,
                        country, region, city, viewable, view_time, is_bot, fraud_score,
                        slot_id, user_fingerprint, synced_to_timescale, synced_at, created_at
                    ) VALUES ${values}
                    ON CONFLICT (timestamp, id) DO NOTHING
                `;

          const params = batch.flatMap((imp) => [
            imp.id,
            imp.creative_id,
            imp.bid_response_id,
            imp.campaign_id,
            imp.advertiser_id,
            imp.inventory_id,
            imp.publisher_id,
            imp.website_id,
            imp.template_id,
            imp.bid_price,
            imp.final_price,
            imp.timestamp,
            imp.user_agent,
            imp.ip_address,
            imp.device_type,
            imp.country,
            imp.region,
            imp.city,
            imp.viewable,
            imp.view_time,
            imp.is_bot,
            imp.fraud_score,
            imp.slot_id,
            imp.user_fingerprint,
            imp.synced_to_timescale,
            imp.synced_at,
            imp.created_at,
          ]);

          const batchResult = await client.query(insertQuery, params);
          insertedCount += batchResult.rowCount || 0;
        }

        return insertedCount;
      });

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Impressions bulk inserted to TimescaleDB', {
        requested: impressions.length,
        inserted: result,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        processedCount: result,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        '❌ Failed to bulk insert impressions to TimescaleDB:',
        {
          error: error.message,
          requestedCount: impressions.length,
          processingTimeMs: processingTime,
        },
      );

      return {
        success: false,
        processedCount: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Bulk insert clicks to TimescaleDB (matching your PostgreSQL schema)
   */
  async bulkInsertClicks(clicks: any[]): Promise<WriteResult> {
    if (clicks.length === 0) {
      return { success: true, processedCount: 0 };
    }

    const startTime = Date.now();

    try {
      const result = await this.transaction(async (client) => {
        let insertedCount = 0;

        // Use batch insert for better performance
        const batchSize = 1000;
        for (let i = 0; i < clicks.length; i += batchSize) {
          const batch = clicks.slice(i, i + batchSize);

          const values = batch
            .map((click, index) => {
              const baseIndex = i * 26 + index * 26; // 26 fields per record
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, 
                            $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, 
                            $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, 
                            $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, 
                            $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24}, $${baseIndex + 25}, 
                            $${baseIndex + 26})`;
            })
            .join(',');

          const insertQuery = `
                    INSERT INTO click_events (
                        id, impression_id, creative_id, bid_response_id, campaign_id,
                        advertiser_id, inventory_id, publisher_id, website_id, template_id,
                        timestamp, user_agent, ip_address, device_type, landing_url,
                        is_bot, fraud_score, time_from_impression, country, region, city,
                        slot_id, user_fingerprint, synced_to_timescale, synced_at, created_at
                    ) VALUES ${values}
                    ON CONFLICT (timestamp, id) DO NOTHING
                `;

          const params = batch.flatMap((click) => [
            click.id,
            click.impression_id,
            click.creative_id,
            click.bid_response_id,
            click.campaign_id,
            click.advertiser_id,
            click.inventory_id,
            click.publisher_id,
            click.website_id,
            click.template_id,
            click.timestamp,
            click.user_agent,
            click.ip_address,
            click.device_type,
            click.landing_url,
            click.is_bot,
            click.fraud_score,
            click.time_from_impression,
            click.country,
            click.region,
            click.city,
            click.slot_id,
            click.user_fingerprint,
            click.synced_to_timescale,
            click.synced_at,
            click.created_at,
          ]);

          const batchResult = await client.query(insertQuery, params);
          insertedCount += batchResult.rowCount || 0;
        }

        return insertedCount;
      });

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Clicks bulk inserted to TimescaleDB', {
        requested: clicks.length,
        inserted: result,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        processedCount: result,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Failed to bulk insert clicks to TimescaleDB:', {
        error: error.message,
        requestedCount: clicks.length,
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        processedCount: 0,
        errors: [error.message],
      };
    }
  }
}
