import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get('/health')
  getHello(): any {
    return 'Ocean Adtech Backend is running';
  }
}
