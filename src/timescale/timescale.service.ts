import { Injectable, Logger } from '@nestjs/common';
import { TimescaleDBConnection } from './timescale-connection.service';
import { KafkaService } from '../kafka/kafka.service';
import {
  TimescaleImpressionDto,
  TimescaleClickDto,
  TimescaleBidMetricDto,
  BatchTimescaleImpressionDto,
  BatchTimescaleClickDto,
  BatchTimescaleBidMetricDto,
} from '../rtb/dto/tracking-events.dto';
import { from as copyFrom } from 'pg-copy-streams';

@Injectable()
export class TimescaleService {
  private readonly logger = new Logger(TimescaleService.name);

  constructor(
    private readonly timescaleDb: TimescaleDBConnection,
    private readonly kafka: KafkaService,
  ) {
    this.logger.log('TimescaleDB Service initialized - Phase 6');
  }

  /**
   * Write impression events to TimescaleDB
   *
   * **Why batch processing:**
   * - TimescaleDB performs much better with bulk inserts
   * - Reduces connection overhead for high-volume data
   * - Enables efficient compression and indexing
   */
  async writeImpressions(impressions: TimescaleImpressionDto[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: any[];
  }> {
    const startTime = Date.now();
    const errors: any[] = [];
    let processedCount = 0;

    this.logger.debug(
      `Writing ${impressions.length} impressions to TimescaleDB`,
    );

    try {
      await this.timescaleDb.transaction(async (client) => {
        // Use COPY for optimal bulk insert performance
        const copyQuery = `
                    COPY rtb_impressions (
                        timestamp, impression_id, creative_id, campaign_id, advertiser_id,
                        inventory_id, publisher_id, website_id, price, publisher_revenue,
                        user_id, session_id, user_agent, ip_address, device_type,
                        browser_type, os_type, country, region, city, viewable,
                        view_time, viewable_pixels, ad_size_pixels, is_bot,
                        fraud_score, referrer_url, page_url, page_category
                    ) FROM STDIN WITH CSV
                `;

        const stream = client.query(copyFrom(copyQuery));

        for (const impression of impressions) {
          try {
            const row =
              [
                impression.timestamp,
                impression.impression_id,
                impression.creative_id,
                impression.campaign_id,
                impression.advertiser_id,
                impression.inventory_id,
                impression.publisher_id,
                impression.website_id,
                impression.price || null,
                impression.publisher_revenue || null,
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
                impression.viewable || null,
                impression.view_time || null,
                impression.viewable_pixels || null,
                impression.ad_size_pixels || null,
                impression.is_bot || false,
                impression.fraud_score || null,
                impression.referrer_url || null,
                impression.page_url || null,
                impression.page_category || null,
              ].join(',') + '\n';

            stream.write(row);
            processedCount++;
          } catch (error) {
            errors.push({
              impression: impression.impression_id,
              error: error.message,
            });
          }
        }

        await new Promise((resolve, reject) => {
          stream.end((err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `✅ Successfully wrote ${processedCount} impressions to TimescaleDB in ${processingTime}ms`,
      );

      return {
        success: true,
        processedCount,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to write impressions to TimescaleDB:',
        error,
      );
      return {
        success: false,
        processedCount,
        errors: [...errors, { error: error.message }],
      };
    }
  }

  /**
   * Write click events to TimescaleDB
   *
   * **Why separate from impressions:**
   * - Different data structure and volume patterns
   * - Enables independent scaling and optimization
   * - Supports different retention policies
   */
  async writeClicks(clicks: TimescaleClickDto[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: any[];
  }> {
    const startTime = Date.now();
    const errors: any[] = [];
    let processedCount = 0;

    this.logger.debug(`Writing ${clicks.length} clicks to TimescaleDB`);

    try {
      await this.timescaleDb.transaction(async (client) => {
        const copyQuery = `
                    COPY rtb_clicks (
                        timestamp, click_id, impression_id, creative_id, campaign_id,
                        advertiser_id, inventory_id, publisher_id, click_x, click_y,
                        time_from_impression, user_id, session_id, user_agent,
                        ip_address, device_type, country, region, city,
                        is_bot, fraud_score
                    ) FROM STDIN WITH CSV
                `;

        const stream = client.query(copyFrom(copyQuery));

        for (const click of clicks) {
          try {
            const row =
              [
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
              ].join(',') + '\n';

            stream.write(row);
            processedCount++;
          } catch (error) {
            errors.push({ click: click.click_id, error: error.message });
          }
        }

        await new Promise((resolve, reject) => {
          stream.end((err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `✅ Successfully wrote ${processedCount} clicks to TimescaleDB in ${processingTime}ms`,
      );

      return {
        success: true,
        processedCount,
        errors,
      };
    } catch (error) {
      this.logger.error('❌ Failed to write clicks to TimescaleDB:', error);
      return {
        success: false,
        processedCount,
        errors: [...errors, { error: error.message }],
      };
    }
  }

  /**
   * Write bid metrics to TimescaleDB
   *
   * **Why bid metrics are important:**
   * - Enables bid optimization algorithms
   * - Supports real-time performance monitoring
   * - Provides data for machine learning models
   */
  async writeBidMetrics(metrics: TimescaleBidMetricDto[]): Promise<{
    success: boolean;
    processedCount: number;
    errors: any[];
  }> {
    const startTime = Date.now();
    const errors: any[] = [];
    let processedCount = 0;

    this.logger.debug(`Writing ${metrics.length} bid metrics to TimescaleDB`);

    try {
      await this.timescaleDb.transaction(async (client) => {
        const copyQuery = `
                    COPY rtb_bid_metrics (
                        timestamp, bid_response_id, campaign_id, inventory_id,
                        bid_price, final_price, won, response_time_ms,
                        auction_duration_ms, total_bids, valid_bids,
                        targeting_score, quality_score
                    ) FROM STDIN WITH CSV
                `;

        const stream = client.query(copyFrom(copyQuery));

        for (const metric of metrics) {
          try {
            const row =
              [
                metric.timestamp,
                metric.bid_response_id,
                metric.campaign_id,
                metric.inventory_id,
                metric.bid_price || null,
                metric.final_price || null,
                metric.won || false,
                metric.response_time_ms || null,
                metric.auction_duration_ms || null,
                metric.total_bids || null,
                metric.valid_bids || null,
                metric.targeting_score || null,
                metric.quality_score || null,
              ].join(',') + '\n';

            stream.write(row);
            processedCount++;
          } catch (error) {
            errors.push({
              metric: metric.bid_response_id,
              error: error.message,
            });
          }
        }

        await new Promise((resolve, reject) => {
          stream.end((err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `✅ Successfully wrote ${processedCount} bid metrics to TimescaleDB in ${processingTime}ms`,
      );

      return {
        success: true,
        processedCount,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '❌ Failed to write bid metrics to TimescaleDB:',
        error,
      );
      return {
        success: false,
        processedCount,
        errors: [...errors, { error: error.message }],
      };
    }
  }

  /**
   * Convert PostgreSQL impression to TimescaleDB format
   *
   * **Why format conversion:**
   * - PostgreSQL stores normalized relational data
   * - TimescaleDB optimizes for denormalized time-series data
   * - Conversion enables efficient time-series queries
   */
  private formatImpressionForTimescale(
    impression: any,
  ): TimescaleImpressionDto {
    return {
      timestamp: impression.timestamp || new Date().toISOString(),
      impression_id: impression.id,
      creative_id: impression.creativeId,
      campaign_id: impression.campaignId,
      advertiser_id: impression.advertiserId,
      inventory_id: impression.inventoryId,
      publisher_id: impression.publisherId,
      website_id: impression.websiteId,
      price: impression.price
        ? parseFloat(impression.price.toString())
        : undefined,
      publisher_revenue: impression.publisherRevenue
        ? parseFloat(impression.publisherRevenue.toString())
        : undefined,
      user_id: impression.userId,
      session_id: impression.sessionId,
      user_agent: impression.userAgent,
      ip_address: impression.ipAddress,
      device_type: impression.deviceType,
      browser_type: impression.browserType,
      os_type: impression.osType,
      country: impression.country,
      region: impression.region,
      city: impression.city,
      viewable: impression.viewable,
      view_time: impression.viewTime,
      viewable_pixels: impression.viewablePixels,
      ad_size_pixels: impression.adSizePixels,
      is_bot: impression.isBot || false,
      fraud_score: impression.fraudScore,
      referrer_url: impression.referrerUrl,
      page_url: impression.pageUrl,
      page_category: impression.pageCategory,
    };
  }

  /**
   * Format click for TimescaleDB
   */
  private formatClickForTimescale(click: any) {
    return {
      timestamp: click.timestamp?.toISOString() || new Date().toISOString(),
      click_id: click.id,
      impression_id: click.impressionId,
      creative_id: click.creativeId,
      campaign_id: click.campaignId,
      advertiser_id: click.advertiserId,
      inventory_id: click.inventoryId,
      publisher_id: click.publisherId,
      click_x: click.clickX,
      click_y: click.clickY,
      time_from_impression: click.timeFromImpression,
      user_id: click.userId,
      session_id: click.sessionId,
      user_agent: click.userAgent,
      ip_address: click.ipAddress,
      device_type: click.deviceType,
      country: click.country,
      region: click.region,
      city: click.city,
      is_bot: click.isBot || false,
      fraud_score: click.fraudScore,
    };
  }
  // Add these methods to your TimescaleService class

  async query(sql: string, params?: any[]): Promise<any> {
    // Implementation depends on your database setup
    // Example for node-postgres:
    const client = await this.timescaleDb.getClient();
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      await this.query('SELECT 1');
      return { status: 'healthy' };
    } catch (error) {
      this.logger.error('TimescaleDB health check failed:', error);
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  async insertRecord(tableName: string, record: any): Promise<any> {
    const columns = Object.keys(record).join(', ');
    const values = Object.values(record);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;

    const result = await this.timescaleDb.query(sql, values);
    return result.rows[0];
  }
  async syncUnsyncedRecords(
    tableName: 'impressions' | 'clicks',
    batchSize: number,
  ): Promise<{ syncedCount: number; errors?: any[] }> {
    // Implementation for syncing unsynced records
    const sql = `
    SELECT * FROM ${tableName} 
    WHERE created_at > $1 AND synced_to_timescale = false
    ORDER BY created_at ASC
  `;

    const records = await this.query(sql, [batchSize]);
    let processedCount = 0;
    // Process records...
    for (const record of records.rows) {
      await this.insertRecord(tableName, record);
      processedCount++;
    }
    return { syncedCount: processedCount };
  }

  async getCampaignMetrics(
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const sql = `
    SELECT 
      campaign_id,
      COUNT(*) as impression_count,
      SUM(price) as total_spend,
      COUNT(DISTINCT user_id) as unique_users
    FROM impressions 
    WHERE campaign_id = $1 
      AND timestamp BETWEEN $2 AND $3
    GROUP BY campaign_id
  `;

    return this.query(sql, [campaignId, startDate, endDate]);
  }

  async getRealtimeMetrics(interval): Promise<any> {
    const sql = `
    SELECT 
      DATE_TRUNC('hour', timestamp) as hour,
      COUNT(*) as impression_count,
      SUM(price) as total_spend
    FROM impressions 
    WHERE timestamp >= NOW() - INTERVAL ${interval}
    GROUP BY hour
    ORDER BY hour DESC
  `;

    return this.query(sql);
  }
}
