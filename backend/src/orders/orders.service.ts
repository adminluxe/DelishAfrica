import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PaginationQueryDto, toSkipTake } from '../common/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('Order must contain at least one item');

    // Fetch products (and validate merchant match)
    const ids = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: ids } } });
    if (products.length !== ids.length) throw new BadRequestException('Some products not found');

    const allSameMerchant = products.every(p => p.merchantId === dto.merchantId);
    if (!allSameMerchant) throw new BadRequestException('Products must belong to the given merchant');

    const total = dto.items.reduce((sum, it) => {
      const p = products.find(x => x.id === it.productId)!;
      return sum + p.price * it.quantity;
    }, 0);

    // Transaction: create order + items
    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        merchantId: dto.merchantId,
        total: Number(total.toFixed(2)),
        status: 'PENDING',
        orderItems: {
          create: dto.items.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        },
      },
      include: { orderItems: true },
    });

    return order;
  }

  async findAll(q: PaginationQueryDto) {
    const { skip, take } = toSkipTake(q);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        skip, take,
        orderBy: { id: 'desc' },
        include: { orderItems: { include: { product: true } }, user: true, merchant: true },
      }),
      this.prisma.order.count(),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async findOne(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: { orderItems: { include: { product: true } }, user: true, merchant: true },
    });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(id);
    return this.prisma.order.update({ where: { id }, data: { status: dto.status } });
  }
}
