import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor() {}

  @Get('favicon.ico')
  getFavicon(@Res() res: Response) {
    // Return 204 No Content to silently handle the request
    res.status(204).send();
  }

  @Get('/health')
  getHello(): any {
    return 'Ocean Adtech Backend is running';
  }
}
