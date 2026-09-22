import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ProductsModule } from './products/products.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ArtifactsModule } from './artifacts/artifacts.module.js';
import { AccountingModule } from './accounting/accounting.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    HealthModule, AuthModule, CustomersModule, ProductsModule,
    DocumentsModule, ArtifactsModule, AccountingModule, NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
