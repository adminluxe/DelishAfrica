import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { PaginationQueryDto } from '../common/pagination.dto';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly service: MerchantsService) {}

  @Post()
  create(@Body() dto: CreateMerchantDto) { return this.service.create(dto); }

  @Get()
  list(@Query() q: PaginationQueryDto) { return this.service.findAll(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMerchantDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
