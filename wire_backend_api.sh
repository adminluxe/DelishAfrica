#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"

# ---------- common utilities ----------
mkdir -p backend/src/common

cat > backend/src/common/prisma-exception.filter.ts <<'TS'
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.BAD_REQUEST;
    let message = exception.message;

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = `Unique constraint failed on: ${exception.meta?.target ?? 'unknown'}`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      default:
        status = HttpStatus.BAD_REQUEST;
        break;
    }

    res.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
      path: req?.url,
    });
  }
}
TS

cat > backend/src/common/pagination.dto.ts <<'TS'
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export const toSkipTake = (q: PaginationQueryDto) => {
  const page = Math.max(1, Number(q.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize || 20)));
  return { skip: (page - 1) * pageSize, take: pageSize };
};
TS

# ---------- Merchants ----------
mkdir -p backend/src/merchants/dto

cat > backend/src/merchants/dto/create-merchant.dto.ts <<'TS'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class CreateMerchantDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  name!: string;
}
TS

cat > backend/src/merchants/dto/update-merchant.dto.ts <<'TS'
import { PartialType } from '@nestjs/mapped-types';
import { CreateMerchantDto } from './create-merchant.dto';
export class UpdateMerchantDto extends PartialType(CreateMerchantDto) {}
TS

cat > backend/src/merchants/merchants.service.ts <<'TS'
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
TS

cat > backend/src/merchants/merchants.controller.ts <<'TS'
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
TS

cat > backend/src/merchants/merchants.module.ts <<'TS'
import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';

@Module({
  controllers: [MerchantsController],
  providers: [MerchantsService],
})
export class MerchantsModule {}
TS

# ---------- Products ----------
mkdir -p backend/src/products/dto

cat > backend/src/products/dto/create-product.dto.ts <<'TS'
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString() merchantId!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() category?: string | null;
  @Type(() => Number) @IsNumber() price!: number;
  @IsOptional() @Type(() => Number) @IsNumber() spicyLevel?: number | null;
  @IsOptional() @IsBoolean() available?: boolean;
}
TS

cat > backend/src/products/dto/update-product.dto.ts <<'TS'
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
export class UpdateProductDto extends PartialType(CreateProductDto) {}
TS

cat > backend/src/products/products.service.ts <<'TS'
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto, toSkipTake } from '../common/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async findAll(q: PaginationQueryDto, merchantId?: string) {
    const { skip, take } = toSkipTake(q);
    const where = merchantId ? { merchantId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
TS

cat > backend/src/products/products.controller.ts <<'TS'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from '../common/pagination.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) { return this.service.create(dto); }

  @Get()
  list(@Query() q: PaginationQueryDto, @Query('merchantId') merchantId?: string) {
    return this.service.findAll(q, merchantId);
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.service.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
TS

cat > backend/src/products/products.module.ts <<'TS'
import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
TS

# ---------- Orders ----------
mkdir -p backend/src/orders/dto

cat > backend/src/orders/dto/create-order.dto.ts <<'TS'
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

class OrderItemInput {
  @IsString() productId!: string;
  @Type(() => Number) @IsNumber() @Min(1) quantity!: number;
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsString() @IsNotEmpty() merchantId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];
}
TS

cat > backend/src/orders/dto/update-order-status.dto.ts <<'TS'
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
TS

cat > backend/src/orders/orders.service.ts <<'TS'
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
TS

cat > backend/src/orders/orders.controller.ts <<'TS'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PaginationQueryDto } from '../common/pagination.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) { return this.service.create(dto); }

  @Get()
  list(@Query() q: PaginationQueryDto) { return this.service.findAll(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/status')
  patchStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
TS

cat > backend/src/orders/orders.module.ts <<'TS'
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
TS

# ---------- AppModule imports ----------
APP="backend/src/app.module.ts"
if [[ -f "$APP" ]]; then
  grep -q "from './merchants/merchants.module'" "$APP" || sed -i "1i import { MerchantsModule } from './merchants/merchants.module';" "$APP"
  grep -q "from './products/products.module'" "$APP" || sed -i "1i import { ProductsModule } from './products/products.module';" "$APP"
  grep -q "from './orders/orders.module'" "$APP"   || sed -i "1i import { OrdersModule } from './orders/orders.module';" "$APP"

  if grep -q "imports:\\s*\\[" "$APP"; then
    sed -i '0,/imports:\s*\[/s//imports: [MerchantsModule, ProductsModule, OrdersModule, /' "$APP"
  else
    sed -i "/@Module({/a \  imports: [MerchantsModule, ProductsModule, OrdersModule]," "$APP"
  fi
else
  echo "⚠ backend/src/app.module.ts introuvable. Ajoute manuellement MerchantsModule, ProductsModule, OrdersModule."
fi

# ---------- main.ts: Swagger + PrismaExceptionFilter ----------
MAIN="backend/src/main.ts"
grep -q "from '@nestjs/swagger'" "$MAIN" || sed -i "1i import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';" "$MAIN"
grep -q "from './common/prisma-exception.filter'" "$MAIN" || sed -i "1i import { PrismaExceptionFilter } from './common/prisma-exception.filter';" "$MAIN"

awk '
/NestFactory\.create\(AppModule\)/ && !done {
  print;
  print "  // Global Prisma exception filter";
  print "  app.useGlobalFilters(new PrismaExceptionFilter());";
  print "";
  print "  // Swagger /docs";
  print "  const config = new DocumentBuilder()";
  print "    .setTitle(\"DelishAfrica API\")";
  print "    .setDescription(\"REST API (Merchants, Products, Orders)\")";
  print "    .setVersion(\"1.0.0\")";
  print "    .build();";
  print "  const document = SwaggerModule.createDocument(app, config);";
  print "  SwaggerModule.setup(\"/docs\", app, document);";
  done=1; next
}1' "$MAIN" > /tmp/main.ts && mv /tmp/main.ts "$MAIN"

echo "✓ API wired: merchants/products/orders + swagger + filters."
