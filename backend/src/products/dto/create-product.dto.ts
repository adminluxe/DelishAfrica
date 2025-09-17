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
