// scripts/migrate-to-timescale.js
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

/**
 * TimescaleDB Migration Script - Phase 6 Implementation
 *
 * **Why this migration is needed:**
 * - Migrates existing impression and click data to TimescaleDB
 * - Maintains data consistency during transition
 * - Enables historical analytics on existing data
 * - Provides fallback mechanisms for data integrity
 */

const prisma = new PrismaClient();
const timescalePool = new Pool({
  host: process.env.TIMESCALEDB_HOST || 'timescaledb',
  port: process.env.TIMESCALEDB_PORT || 5432,
  database: process.env.TIMESCALEDB_DATABASE || 'rtb_timeseries',
  user: process.env.TIMESCALEDB_USER || 'timescale_user',
  password: process.env.TIMESCALEDB_PASSWORD || 'timescale_pass',
});

async function migrateImpressions(batchSize = 1000) {
  console.log('🚀 Starting impression migration to TimescaleDB...');

  let offset = 0;
  let totalMigrated = 0;

  while (true) {
    const impressions = await prisma.impressionEvent.findMany({
      take: batchSize,
      skip: offset,
      where: { syncedToTimescale: false },
      include: {
        creative: true,
        campaign: true,
        inventory: true,
        publisher: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    if (impressions.length === 0) {
      break;
    }

    console.log(
      `📦 Processing batch: ${offset} - ${offset + impressions.length}`,
    );

    // Prepare batch data
    const values = impressions.map((impression) => [
      impression.timestamp.toISOString(),
      impression.id,
      impression.creativeId,
      impression.campaignId,
      impression.advertiserId,
      impression.inventoryId,
      impression.publisherId,
      impression.websiteId,
      impression.price || null,
      impression.publisherRevenue || null,
      impression.userId || null,
      impression.sessionId || null,
      impression.userAgent || null,
      impression.ipAddress || null,
      impression.deviceType || null,
      impression.browserType || null,
      impression.osType || null,
      impression.country || null,
      impression.region || null,
      impression.city || null,
      impression.viewable || null,
      impression.viewTime || null,
      impression.viewablePixels || null,
      impression.adSizePixels || null,
      impression.isBot || false,
      impression.fraudScore || null,
      impression.referrerUrl || null,
      impression.pageUrl || null,
      impression.pageCategory || null,
    ]);

    // Bulk insert to TimescaleDB
    const client = await timescalePool.connect();
    try {
      await client.query('BEGIN');

      for (const value of values) {
        await client.query(
          `
                    INSERT INTO rtb_impressions (
                        timestamp, impression_id, creative_id, campaign_id, advertiser_id,
                        inventory_id, publisher_id, website_id, price, publisher_revenue,
                        user_id, session_id, user_agent, ip_address, device_type,
                        browser_type, os_type, country, region, city, viewable,
                        view_time, viewable_pixels, ad_size_pixels, is_bot,
                        fraud_score, referrer_url, page_url, page_category
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
                    ON CONFLICT (timestamp, impression_id) DO NOTHING
                `,
          value,
        );
      }

      await client.query('COMMIT');

      // Mark as synced in PostgreSQL
      await prisma.impressionEvent.updateMany({
        where: { id: { in: impressions.map((i) => i.id) } },
        data: {
          syncedToTimescale: true,
          syncedAt: new Date(),
        },
      });

      totalMigrated += impressions.length;
      console.log(
        `✅ Migrated batch of ${impressions.length} impressions. Total: ${totalMigrated}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to migrate batch:', error);
      throw error;
    } finally {
      client.release();
    }

    offset += batchSize;

    // Small delay to prevent overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `🎉 Impression migration completed! Total migrated: ${totalMigrated}`,
  );
}

async function migrateClicks(batchSize = 1000) {
  console.log('🚀 Starting click migration to TimescaleDB...');

  let offset = 0;
  let totalMigrated = 0;

  while (true) {
    const clicks = await prisma.clickEvent.findMany({
      take: batchSize,
      skip: offset,
      where: { syncedToTimescale: false },
      include: {
        impression: true,
        creative: true,
        campaign: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    if (clicks.length === 0) {
      break;
    }

    console.log(
      `📦 Processing click batch: ${offset} - ${offset + clicks.length}`,
    );

    // Prepare batch data
    const values = clicks.map((click) => [
      click.timestamp.toISOString(),
      click.id,
      click.impressionId || null,
      click.creativeId,
      click.campaignId,
      click.advertiserId,
      click.inventoryId,
      click.publisherId,
      click.clickX || null,
      click.clickY || null,
      click.timeFromImpression || null,
      click.userId || null,
      click.sessionId || null,
      click.userAgent || null,
      click.ipAddress || null,
      click.deviceType || null,
      click.country || null,
      click.region || null,
      click.city || null,
      click.isBot || false,
      click.fraudScore || null,
    ]);

    // Bulk insert to TimescaleDB
    const client = await timescalePool.connect();
    try {
      await client.query('BEGIN');

      for (const value of values) {
        await client.query(
          `
                    INSERT INTO rtb_clicks (
                        timestamp, click_id, impression_id, creative_id, campaign_id,
                        advertiser_id, inventory_id, publisher_id, click_x, click_y,
                        time_from_impression, user_id, session_id, user_agent,
                        ip_address, device_type, country, region, city,
                        is_bot, fraud_score
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                    ON CONFLICT (timestamp, click_id) DO NOTHING
                `,
          value,
        );
      }

      await client.query('COMMIT');

      // Mark as synced in PostgreSQL
      await prisma.clickEvent.updateMany({
        where: { id: { in: clicks.map((c) => c.id) } },
        data: {
          syncedToTimescale: true,
          syncedAt: new Date(),
        },
      });

      totalMigrated += clicks.length;
      console.log(
        `✅ Migrated batch of ${clicks.length} clicks. Total: ${totalMigrated}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to migrate click batch:', error);
      throw error;
    } finally {
      client.release();
    }

    offset += batchSize;

    // Small delay to prevent overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`🎉 Click migration completed! Total migrated: ${totalMigrated}`);
}

async function main() {
  try {
    console.log('🔄 Starting TimescaleDB migration...');

    // Test connections
    console.log('🔌 Testing database connections...');
    await prisma.$queryRaw`SELECT 1`;
    const timescaleClient = await timescalePool.connect();
    await timescaleClient.query('SELECT 1');
    timescaleClient.release();
    console.log('✅ Database connections verified');

    // Run migrations
    await migrateImpressions();
    await migrateClicks();

    console.log('🎉 TimescaleDB migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await timescalePool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateImpressions, migrateClicks };
