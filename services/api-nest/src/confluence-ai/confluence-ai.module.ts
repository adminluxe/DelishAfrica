import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfluenceAiController } from './confluence-ai.controller';
import { ConfluenceAiService } from './confluence-ai.service';

@Module({
  imports: [AuthModule],
  controllers: [ConfluenceAiController],
  providers: [ConfluenceAiService],
})
export class ConfluenceAiModule {}
