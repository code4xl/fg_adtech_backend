import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ErrorConfigService {
  private readonly prefix: string;

  constructor(private configService: ConfigService) {
    this.prefix =
      this.configService.get<string>('error.prefix') || 'OceanAdTech';
  }

  getPrefix(): string {
    return this.prefix;
  }

  formatErrorCode(code: string, status: number): string {
    return `${this.prefix}_${code}_${status}`;
  }
}
