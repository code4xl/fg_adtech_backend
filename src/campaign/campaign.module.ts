import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CampaignStatusService } from './campaign-status.service';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignHelperService } from './campaign.helper';
import { FileStorageService } from 'src/file-storage/file-storage.service';

@Module({
  imports: [
    InventoryModule,
    ScheduleModule.forRoot() // For cron jobs to update campaign status
  ],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignStatusService, CampaignHelperService, FileStorageService],
  exports: [CampaignService]
})
export class CampaignModule { }