import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CampaignStatusService } from './campaign-status.service';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignHelperService } from './campaign.helper';
import { NotificationModule } from 'src/notification/notification.module';
import { FileUploadModule } from 'src/common/file-upload/file-upload.module';
import { S3StorageService } from 'src/common/services/s3-storage.service';
import { S3Module } from 'src/common/services/s3.module';

@Module({
  imports: [
    FileUploadModule.register({ destination: './uploads/campaigns' }),
    InventoryModule,
    ScheduleModule.forRoot(), // For cron jobs to update campaign status
    NotificationModule,
    S3Module,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignHelperService, CampaignStatusService, S3StorageService],
  exports: [CampaignService]
})
export class CampaignModule { }