import { IsInt, Min, IsString, Length, Matches } from 'class-validator';

export class CreateIntentDto {
  @IsInt() @Min(100)
  amount!: number; // cents

  @IsString() @Length(3,3) @Matches(/^[A-Z]{3}$/)
  currency!: string; // 'EUR'

  @IsString() @Length(3, 128)
  orderId!: string; // accepte UUID/CUID/autre ID
}
