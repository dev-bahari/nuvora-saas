import { Module } from '@nestjs/common';
import { MockDianProvider } from './mock-dian.provider.js';

@Module({
  providers: [MockDianProvider],
  exports: [MockDianProvider],
})
export class DianModule {}
