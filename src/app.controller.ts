import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  getHello(): any {
    return {
      status: '200',
      message: 'Server is running successfully',
    };
  }
}
