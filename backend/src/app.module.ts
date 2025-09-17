import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { MerchantsModule } from './merchants/merchants.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [UsersModule, MerchantsModule, ProductsModule, OrdersModule, PrismaModule, HealthModule, ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
