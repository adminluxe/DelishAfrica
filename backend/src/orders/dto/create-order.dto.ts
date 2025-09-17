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
