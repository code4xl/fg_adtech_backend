import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) { }
  async findAll() {
    // Use Prisma client
    const data = await this.prisma.advertiser.findMany();
    return data;
  }
}
