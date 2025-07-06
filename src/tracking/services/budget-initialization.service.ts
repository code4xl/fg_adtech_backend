import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class BudgetInitializationService {
  private readonly logger = new Logger(BudgetInitializationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}
}
