import { Logger } from '@nestjs/common';

export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  constructor() {}
}
