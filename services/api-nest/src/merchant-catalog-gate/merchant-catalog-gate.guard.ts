import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CatalogFoundationService } from '../catalog-foundation/catalog-foundation.service';
import type { MerchantCatalogGateRequest } from './merchant-catalog-gate.types';

@Injectable()
export class MerchantCatalogOwnershipGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: CatalogFoundationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<MerchantCatalogGateRequest>();
    const authorization = this.header(request, 'authorization');
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

    if (!principal.ownershipEligible) {
      throw new ForbiddenException({
        ok: false,
        code: 'development_auth_not_eligible_for_ownership',
        authSource: principal.authSource,
      });
    }

    const owned = await this.catalog.listOwnedBySubject(principal.subject);

    if (owned.length === 0) {
      throw new ForbiddenException({
        ok: false,
        code: 'merchant_ownership_required',
      });
    }

    const requestedSlug = this.header(request, 'x-da-partner-slug');
    const ownership = requestedSlug
      ? owned.find((candidate) => candidate.slug === requestedSlug)
      : owned.length === 1
        ? owned[0]
        : undefined;

    if (requestedSlug && !ownership) {
      throw new ForbiddenException({
        ok: false,
        code: 'merchant_requested_partner_not_owned',
      });
    }

    if (!ownership) {
      throw new ConflictException({
        ok: false,
        code: 'merchant_partner_selection_required',
        ownedPartnerCount: owned.length,
      });
    }

    request.daMerchantCatalogContext = {
      principal,
      ownership,
    };

    return true;
  }

  private header(
    request: MerchantCatalogGateRequest,
    name: string,
  ): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return value[0];
    return value ? String(value) : undefined;
  }
}
