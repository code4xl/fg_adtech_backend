import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
    private readonly logger = new Logger(RedisIoAdapter.name);
    private adapterConstructor: ReturnType<typeof createAdapter>;

    constructor(
        app: INestApplication,
        private readonly configService: ConfigService,
    ) {
        super(app);
    }

    async connectToRedis(): Promise<void> {
        const host = this.configService.get<string>('redis.host', 'localhost');
        const port = this.configService.get<number>('redis.port', 6379);
        const password = this.configService.get<string>('redis.password');

        const pubClient = new Redis({
            host,
            port,
            password,
        });

        const subClient = new Redis({
            host,
            port,
            password,
        });

        await Promise.all([
            new Promise<void>((resolve) => {
                pubClient.on('ready', () => {
                    this.logger.debug('Redis PubClient ready');
                    resolve();
                });
            }),
            new Promise<void>((resolve) => {
                subClient.on('ready', () => {
                    this.logger.debug('Redis SubClient ready');
                    resolve();
                });
            }),
        ]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
        this.logger.debug('Redis adapter created successfully');
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);

        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
            this.logger.debug('Redis adapter applied to Socket.IO server');
        } else {
            this.logger.warn('Redis adapter not available, using default adapter');
        }

        return server;
    }
}