import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Throttle({ default: { limit: 3, ttl: 1000 } })
@Throttle({ default: { limit: 10, ttl: 10000 } })
  @Get()
  async search(
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: SearchQueryDto,
  ) {
    return this.searchService.search(query);
  }

  @Get('health')
  async health() {
    await this.searchService.search({ q: '', limit: 1, offset: 0 });
    return { status: 'ok' };
  }
}
