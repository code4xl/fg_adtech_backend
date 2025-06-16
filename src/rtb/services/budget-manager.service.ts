import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);
  constructor() { }
}
