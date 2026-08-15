import { Controller, Get } from '@nestjs/common';
import { ProviderBridgeService } from './provider-bridge.service';

@Controller('provider-bridge')
export class ProviderBridgeController {
  constructor(private readonly providerBridge: ProviderBridgeService) {}

  @Get('health')
  health() {
    return this.providerBridge.health();
  }

  @Get('readiness')
  readiness() {
    return this.providerBridge.readiness();
  }

  @Get('capabilities')
  capabilities() {
    return this.providerBridge.capabilities();
  }
}
