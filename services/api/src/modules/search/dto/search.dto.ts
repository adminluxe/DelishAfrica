import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string = '';

  @IsInt()
  @Min(0)
  @IsOptional()
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit: number = 10;

  @IsString()
  @IsOptional()
  tenant?: string;
}
