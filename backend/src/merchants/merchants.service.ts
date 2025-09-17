import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { PaginationQueryDto, toSkipTake } from '../common/pagination.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMerchantDto) {
    return this.prisma.merchant.create({ data: dto });
  }

  async findAll(q: PaginationQueryDto) {
    const { skip, take } = toSkipTake(q);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.merchant.findMany({ skip, take, orderBy: { name: 'asc' } }),
      this.prisma.merchant.count(),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async findOne(id: string) {
    const m = await this.prisma.merchant.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Merchant not found');
    return m;
  }

  async update(id: string, dto: UpdateMerchantDto) {
    await this.findOne(id);
    return this.prisma.merchant.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.merchant.delete({ where: { id } });
    return { ok: true };
  }
}
