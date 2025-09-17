import { Module } from "@nestjs/common";
import { MerchantImportController } from "./merchant.import.controller";
import { MerchantReadController } from "./merchant.read.controller";
import { MerchantService } from "./merchant.service";

@Module({
  controllers: [MerchantImportController, MerchantReadController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
