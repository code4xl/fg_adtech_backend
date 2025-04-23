import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AppService {
   constructor(
    private configService: ConfigService,
    private prisma: DatabaseService,
  ) {}
   async findAll() {
    // Access config values
    const nodeEnv = this.configService.get<string>('nodeEnv');
    console.log(`Current environment: ${nodeEnv}`);
    
    // Use Prisma client
    const data = await this.prisma.dummy.findMany();
    return data;
  }
}
