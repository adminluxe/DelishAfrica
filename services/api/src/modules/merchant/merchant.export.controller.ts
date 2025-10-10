import { Controller, Get, Param, Res } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Response } from 'express';

@Controller('merchants')
export class MerchantExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/menu.csv')
  async exportMenu(@Param('id') id: string, @Res() res: Response) {
    const items = await this.prisma.menuItem.findMany({
      where: { merchantId: id },
      orderBy: { name: 'asc' },
    });

    const header = 'merchant_id,name,price,category,description,spicy_level,imageUrl,available';
    const rows = items.map((i) => {
      const q = (s: unknown) => {
        if (s === null || s === undefined) return '';
        const str = String(s).replace(/"/g, '""');
        return `"${str}"`;
      };
      return [
        q(i.merchantId),
        q(i.name),
        i.price ?? '',
        q(i.category ?? ''),
        q(i.description ?? ''),
        i.spicyLevel ?? '',
        q(i.imageUrl ?? ''),
        i.available ? 'true' : 'false',
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  }
}
