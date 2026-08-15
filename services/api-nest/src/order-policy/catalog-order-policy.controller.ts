import { Body, Controller, Post } from '@nestjs/common';
import { CatalogOrderPolicyService } from './catalog-order-policy.service';

@Controller('order-policy')
export class CatalogOrderPolicyController {
  constructor(private readonly policy: CatalogOrderPolicyService) {}

  @Post('quote')
  quote(@Body() body: Record<string, any> = {}) {
    return this.policy.quote(body);
  }
}
