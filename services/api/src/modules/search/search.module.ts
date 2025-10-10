import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'search', ttl: 10, limit: 10 }]), // 10 req / 10 s
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
