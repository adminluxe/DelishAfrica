import { Module } from '@nestjs/common';
import { ThiepyDemoController } from './thieyp-demo.controller';
import { ThiepyDemoService } from './thieyp-demo.service';

@Module({
  controllers: [ThiepyDemoController],
  providers: [ThiepyDemoService],
  exports: [ThiepyDemoService],
})
export class ThiepyDemoModule {}
