import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TargetingEngineService {
  private readonly logger = new Logger(TargetingEngineService.name);
  constructor() { }
}
