import { Controller, Get, Param } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Controller('merchants')
export class MerchantPublicController {
  private prisma = new PrismaClient();
  @Get(':id/menu')
  async getMenu(@Param('id') id: string) {
    return this.prisma.menuItem.findMany({
      where: { merchantId: id },
      orderBy: { name: 'asc' },
    });
  }
}
