import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DemoOrderItemInputDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DemoOrderCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DemoOrderMetaDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class CreateDemoOrderDto {
  @IsString()
  @IsNotEmpty()
  partnerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DemoOrderItemInputDto)
  items!: DemoOrderItemInputDto[];

  @ValidateNested()
  @Type(() => DemoOrderCustomerDto)
  customer!: DemoOrderCustomerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DemoOrderMetaDto)
  meta?: DemoOrderMetaDto;
}

export type DemoOrderItem = {
  menuItemId: string;
  quantity: number;
  unitPriceCents: number;
};

export type DemoOrderResponse = {
  orderId: string;
  partnerId: string;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  currency: string;
  totalCents: number;
  createdAt: string;
  items: DemoOrderItem[];
  customer: DemoOrderCustomerDto;
  meta?: DemoOrderMetaDto;
};
