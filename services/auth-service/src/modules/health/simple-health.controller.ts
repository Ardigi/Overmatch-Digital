import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/health')
export class SimpleHealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'auth-service',
      timestamp: new Date().toISOString()
    };
  }

  @Get('simple')
  simple() {
    return { status: 'ok' };
  }
}