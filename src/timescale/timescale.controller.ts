import { Controller, Get, Post } from "@nestjs/common";
import { PostgresTimescaleSyncService } from "src/tracking/services/postgre-timescale-sync.service";
import { TimescaleService } from "./timescale.service";

// Create a test controller
@Controller('test-sync')
export class TimeScaleController {
    constructor(
        private readonly postgresTimescaleSync: PostgresTimescaleSyncService,
        private readonly timescale: TimescaleService,
    ) { }

    @Get('health')
    async testHealth() {
        return {
            timescale: await this.timescale.healthCheck(),
            sync: await this.postgresTimescaleSync.healthCheck(),
        };
    }

    @Post('manual-sync')
    async testManualSync() {
        return await this.postgresTimescaleSync.triggerManualSync();
    }
}