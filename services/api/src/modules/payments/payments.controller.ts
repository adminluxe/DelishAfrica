import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateIntentDto } from './dto/create-intent.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':intentId')
  async getByIntent(@Param('intentId') intentId: string) {
    return this.payments.getByIntentId(intentId);
  }

  @Post('intent')
  async createIntent(@Body() dto: CreateIntentDto) {
    return this.payments.createIntent(dto);
  }
}
