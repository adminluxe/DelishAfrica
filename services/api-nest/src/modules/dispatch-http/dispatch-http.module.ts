import { Module } from '@nestjs/common';
import { DispatchHttpController } from './dispatch-http.controller';
import { MissionsHttpController } from './missions-http.controller';
import { ProxyDemoOrdersService } from './proxy-demo-orders.service';

@Module({
  controllers: [DispatchHttpController, MissionsHttpController],
  providers: [ProxyDemoOrdersService],
})
export class DispatchHttpModule {}
