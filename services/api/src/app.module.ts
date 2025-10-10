import { SearchModule } from './modules/search/search.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MerchantModule } from './modules/merchant/merchant.module';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [ThrottlerModule.forRoot([{ name: 'global', ttl: parseInt(process.env.RATE_LIMIT_TTL_MS||'60000',10), limit: parseInt(process.env.RATE_LIMIT_LIMIT||'10',10), getTracker: (req: any) => (req?.headers?.['cf-connecting-ip'] as string) || req?.ip }]), 
    PrismaModule,
    HealthModule,
    PaymentsModule,
    MerchantModule,
    
  
    SearchModule,
  ],
})
export class AppModule {}
