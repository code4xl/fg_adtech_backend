// src/common/exceptions/exceptions.module.ts
import { Module, Global } from '@nestjs/common';
import { ErrorConfigService } from './error-config.service';

@Global()
@Module({
  providers: [ErrorConfigService],
  exports: [ErrorConfigService],
})
export class ExceptionsModule {}
