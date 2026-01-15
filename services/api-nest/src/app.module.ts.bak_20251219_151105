import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { OrdersModule } from './orders/orders.module';

import { DispatchHttpModule } from './modules/dispatch-http/dispatch-http.module';

@Module({
  controllers: [AppController],
  imports: [OrdersModule,
    DispatchHttpModule],

})
export class AppModule {}
