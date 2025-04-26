import { Controller, UseGuards } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';

@Controller('campaign')
@UseGuards(AdvertiserGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  // @Get()
  // async findAll() {
  //   return this.campaignService.findAll();
  // }
}
