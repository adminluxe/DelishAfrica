import { Module } from '@nestjs/common';
import { AtmosphereController } from './atmosphere.controller';
import { AtmosphereService } from './atmosphere.service';

@Module({
  controllers: [AtmosphereController],
  providers: [AtmosphereService],
})
export class AtmosphereModule {}
