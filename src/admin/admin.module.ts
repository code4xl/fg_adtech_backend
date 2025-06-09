import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAdvertiserController } from './advertiser/admin-advertiser.controller';
import { AdminAdvertiserService } from './advertiser/admin-advertiser.service';
import { AdminClientController } from './client/admin-client.controller';
import { AdminClientService } from './client/admin-client.service';

@Module({
  controllers: [
    AdminController,
    AdminAdvertiserController,
    AdminClientController,
  ],
  providers: [
    AdminService,
    AdminAdvertiserService,
    AdminClientService,
  ],
})
export class AdminModule { }
