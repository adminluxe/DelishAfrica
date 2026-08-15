import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { MerchantCatalogOwnershipGuard } from './merchant-catalog-gate.guard';
import { MerchantCatalogGateService } from './merchant-catalog-gate.service';
import type { MerchantCatalogGateRequest } from './merchant-catalog-gate.types';

@Controller('merchant/catalog-gate')
export class MerchantCatalogGateHealthController {
  constructor(private readonly gate: MerchantCatalogGateService) {}

  @Get('health')
  health() {
    return this.gate.health();
  }
}

@Controller('merchant/membership')
export class MerchantMembershipController {
  constructor(
    private readonly auth: AuthService,
    private readonly gate: MerchantCatalogGateService,
  ) {}

  @Get('health')
  health() {
    return this.gate.membershipHealth();
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const resolution =
      await this.auth.resolvePrincipalFromAuthorization(authorization);

    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'merchant_auth_required',
        reason: resolution.reason,
      });
    }

    const principal = resolution.principal;

    if (principal.role !== 'merchant') {
      throw new ForbiddenException({
        ok: false,
        code: 'merchant_role_required',
      });
    }

    if (
      principal.authSource !== 'external'
      || !principal.ownershipEligible
      || !principal.issuer
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'trusted_external_identity_required',
        authSource: principal.authSource,
      });
    }

    return this.gate.membershipForPrincipal(principal);
  }
}

@Controller('merchant/catalog')
@UseGuards(MerchantCatalogOwnershipGuard)
export class MerchantCatalogReadController {
  constructor(private readonly gate: MerchantCatalogGateService) {}

  @Get('me')
  me(@Req() request: MerchantCatalogGateRequest) {
    return {
      ok: true,
      writeApiEnabled: false,
      catalog: this.gate.summary(this.requireContext(request)),
    };
  }

  @Get('me/draft')
  draft(@Req() request: MerchantCatalogGateRequest) {
    return {
      ok: true,
      writeApiEnabled: false,
      draft: this.gate.draft(this.requireContext(request)),
    };
  }

  private requireContext(request: MerchantCatalogGateRequest) {
    const context = request.daMerchantCatalogContext;
    if (!context) {
      throw new Error('merchant_catalog_context_missing_after_guard');
    }
    return context;
  }
}
