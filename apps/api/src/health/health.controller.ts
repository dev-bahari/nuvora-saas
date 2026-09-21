import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLive(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  getReady(): HealthResponse {
    // In Task 1 foundation, API checks baseline process readiness.
    // Infrastructure deep connectivity check will be wired when DB connection pool is introduced in Task 2.
    return { status: 'ok' };
  }
}
