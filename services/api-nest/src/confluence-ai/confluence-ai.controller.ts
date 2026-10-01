import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ConfluenceAiService } from './confluence-ai.service';
import type { ConfluenceSuggestionRequest } from './confluence-ai.types';

@Controller('confluence/ai')
export class ConfluenceAiController {
  constructor(private readonly confluenceAi: ConfluenceAiService) {}

  @Get('health')
  health() {
    return this.confluenceAi.health();
  }

  @Post('suggest')
  suggest(
    @Headers('authorization') authorization?: string,
    @Body() body: ConfluenceSuggestionRequest = {},
  ) {
    return this.confluenceAi.suggest(authorization, body || {});
  }
}
