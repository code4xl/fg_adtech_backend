import { Logger } from '@nestjs/common';

export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);
  constructor() {}
}
