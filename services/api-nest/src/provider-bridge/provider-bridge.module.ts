import { Module } from '@nestjs/common';
import {
  EmailProviderAdapter,
  GooglePlacesProviderAdapter,
  SmsProviderAdapter,
} from './provider-bridge.adapters';
import { ProviderBridgeController } from './provider-bridge.controller';
import { ProviderBridgeService } from './provider-bridge.service';

@Module({
  controllers: [ProviderBridgeController],
  providers: [
    ProviderBridgeService,
    GooglePlacesProviderAdapter,
    SmsProviderAdapter,
    EmailProviderAdapter,
  ],
  exports: [
    ProviderBridgeService,
    GooglePlacesProviderAdapter,
    SmsProviderAdapter,
    EmailProviderAdapter,
  ],
})
export class ProviderBridgeModule {}
