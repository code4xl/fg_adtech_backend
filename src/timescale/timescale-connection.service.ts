// import {
//   Injectable,
//   Logger,
//   OnModuleInit,
//   OnModuleDestroy,
// } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { Pool, PoolClient } from 'pg';

// @Injectable()
// export class TimescaleDBConnection implements OnModuleInit, OnModuleDestroy {
//   private readonly logger = new Logger(TimescaleDBConnection.name);
//   private pool: Pool;

//   constructor(private readonly configService: ConfigService) { }

//   async onModuleInit() {
//     await this.initializePool();
//   }

//   async onModuleDestroy() {
//     await this.closePool();
//   }

//   private async initializePool() {
//     try {
//       // Get configuration from the nested timescale object
//       const timescaleConfig = this.configService.get('timescale');

//       this.logger.log('🔄 Initializing TimescaleDB connection with config:', {
//         host: timescaleConfig?.host || 'not set',
//         port: timescaleConfig?.port || 'not set',
//         database: timescaleConfig?.database || 'not set',
//         user: timescaleConfig?.user || 'not set',
//       });

//       this.pool = new Pool({
//         host:
//           timescaleConfig?.host ||
//           this.configService.get<string>('TIMESCALEDB_HOST'),
//         port:
//           timescaleConfig?.port ||
//           this.configService.get<number>('TIMESCALEDB_PORT'),
//         database:
//           timescaleConfig?.database ||
//           this.configService.get<string>('TIMESCALEDB_DATABASE'),
//         user:
//           timescaleConfig?.user ||
//           this.configService.get<string>('TIMESCALEDB_USER'),
//         password:
//           timescaleConfig?.password ||
//           this.configService.get<string>('TIMESCALEDB_PASSWORD'),

//         // Optimized for time-series workloads
//         max:
//           timescaleConfig?.poolSize ||
//           this.configService.get<number>('TIMESCALEDB_POOL_SIZE', 20),
//         idleTimeoutMillis: 30000,
//         connectionTimeoutMillis:
//           timescaleConfig?.poolTimeout ||
//           this.configService.get<number>('TIMESCALEDB_POOL_TIMEOUT', 5000),

//         // Application name for monitoring
//         application_name: 'rtb-timescale-client',

//         // SSL configuration for production
//         ssl:
//           this.configService.get('nodeEnv') === 'production'
//             ? { rejectUnauthorized: false }
//             : false,
//       });

//       // Test connection
//       const client = await this.pool.connect();
//       await client.query('SELECT NOW()');
//       client.release();

//       this.logger.log(
//         '✅ TimescaleDB connection pool initialized successfully',
//       );
//     } catch (error) {
//       this.logger.error(
//         '❌ Failed to initialize TimescaleDB connection pool:',
//         error,
//       );
//       throw error;
//     }
//   }

//   /**
//    * Get a database client from the pool
//    */
//   async getClient(): Promise<PoolClient> {
//     return this.pool.connect();
//   }

//   /**
//    * Execute a query with automatic client management
//    */
//   async query(text: string, params?: any[]): Promise<any> {
//     const client = await this.getClient();
//     try {
//       return await client.query(text, params);
//     } finally {
//       client.release();
//     }
//   }

//   /**
//    * Execute a transaction with automatic rollback on error
//    */
//   async transaction<T>(
//     callback: (client: PoolClient) => Promise<T>,
//   ): Promise<T> {
//     const client = await this.getClient();
//     try {
//       await client.query('BEGIN');
//       const result = await callback(client);
//       await client.query('COMMIT');
//       return result;
//     } catch (error) {
//       await client.query('ROLLBACK');
//       throw error;
//     } finally {
//       client.release();
//     }
//   }

//   /**
//    * Close the connection pool gracefully
//    */
//   private async closePool() {
//     if (this.pool) {
//       await this.pool.end();
//       this.logger.log('✅ TimescaleDB connection pool closed');
//     }
//   }

//   async healthCheck(): Promise<{ status: string; details: any }> {
//     try {
//       const result = await this.query(
//         'SELECT NOW() as current_time, version() as version',
//       );
//       return {
//         status: 'healthy',
//         details: {
//           current_time: result.rows[0].current_time,
//           version: result.rows[0].version,
//           pool_total: this.pool.totalCount,
//           pool_idle: this.pool.idleCount,
//           pool_waiting: this.pool.waitingCount,
//         },
//       };
//     } catch (error) {
//       return {
//         status: 'unhealthy',
//         details: { error: error.message },
//       };
//     }
//   }
// }
