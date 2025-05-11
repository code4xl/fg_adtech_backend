import { Body, Controller, Post } from '@nestjs/common';

@Controller('bid-request')
export class BidRequestController {
  @Post('/')
  async handleBidRequest(@Body() bidRequest: any) {}
}
