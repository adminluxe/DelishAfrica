import { Controller, Get, Headers } from '@nestjs/common';
import { OpsAuthorityService } from './ops-authority.service';
import type { OpsAuthorityHeaderMap } from './ops-authority.types';

@Controller('ops/authority')
export class OpsAuthorityController {
  constructor(private readonly authority: OpsAuthorityService) {}

  @Get('verify')
  verify(@Headers() headers: OpsAuthorityHeaderMap) {
    return this.authority.verifyGet(headers);
  }
}
