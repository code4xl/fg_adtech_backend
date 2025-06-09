// src/timescale/timescale-connection.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

/**
 * TimescaleDB Connection Service - Phase 6 Implementation
 * 
 * **Why dedicated connection management:**
 * - TimescaleDB requires different connection pool settings than transactional PostgreSQL
 * - Time-series operations benefit from longer connection lifetimes
 * - Enables separate monitoring and scaling of analytical workloads
 * - Provides optimized configurations for bulk insert operations
 */
@Injectable()
export class TimescaleDBConnection implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TimescaleDBConnection.name);
    private pool: Pool;

    constructor(private readonly configService: ConfigService) { }

    async onModuleInit() {
        await this.initializePool();
    }

    async onModuleDestroy() {
        await this.closePool();
    }

    /**
     * Initialize connection pool with TimescaleDB-optimized settings
     * 
     * **Why these specific settings:**
     * - Larger pool for analytical workloads
     * - Longer connection timeouts for complex queries
     * - Optimized for bulk insert operations
     */
    private async initializePool() {
        try {
            this.pool = new Pool({
                host: this.configService.get<string>('TIMESCALEDB_HOST'),
                port: this.configService.get<number>('TIMESCALEDB_PORT'),
                database: this.configService.get<string>('TIMESCALEDB_DATABASE'),
                user: this.configService.get<string>('TIMESCALEDB_USER'),
                password: this.configService.get<string>('TIMESCALEDB_PASSWORD'),

                // Optimized for time-series workloads
                max: this.configService.get<number>('TIMESCALEDB_POOL_SIZE', 20),
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: this.configService.get<number>('TIMESCALEDB_POOL_TIMEOUT', 5000),

                // Application name for monitoring
                application_name: 'rtb-timescale-client',

                // SSL configuration for production
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.logger.log('✅ TimescaleDB connection pool initialized successfully');

        } catch (error) {
            this.logger.error('❌ Failed to initialize TimescaleDB connection pool:', error);
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
            return await client.query(text, params);
        } finally {
            client.release();
        }
    }

    /**
     * Execute a transaction with automatic rollback on error
     */
    async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Close the connection pool gracefully
     */
    private async closePool() {
        if (this.pool) {
            await this.pool.end();
            this.logger.log('✅ TimescaleDB connection pool closed');
        }
    }

    /**
     * Health check method
     */
    async healthCheck(): Promise<{ status: string; details: any }> {
        try {
            const result = await this.query('SELECT NOW() as current_time, version() as version');
            return {
                status: 'healthy',
                details: {
                    current_time: result.rows[0].current_time,
                    version: result.rows[0].version,
                    pool_total: this.pool.totalCount,
                    pool_idle: this.pool.idleCount,
                    pool_waiting: this.pool.waitingCount,
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
}