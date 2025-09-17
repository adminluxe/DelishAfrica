import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
