import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [HealthModule, AuthModule, CustomersModule, ProductsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
