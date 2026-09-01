import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { DaAuthPrincipalResolution } from './auth.types';

type ExternalAppRole = 'client' | 'merchant' | 'courier';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('health')
  health() {
    return this.auth.health();
  }

  @Get('trusted-identity/health')
  trustedIdentityHealth() {
    return this.auth.trustedIdentityHealth();
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.meFromAuthorization(authorization);
  }

  @Get('client/me')
  clientMe(@Headers('authorization') authorization?: string) {
    return this.externalRoleMe('client', authorization);
  }

  @Get('merchant/me')
  merchantMe(@Headers('authorization') authorization?: string) {
    return this.externalRoleMe('merchant', authorization);
  }

  @Get('courier/me')
  courierMe(@Headers('authorization') authorization?: string) {
    return this.externalRoleMe('courier', authorization);
  }

  @Post('client/session/revoke')
  async revokeClientSession(@Headers('authorization') authorization?: string) {
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);
    if ('reason' in resolution) this.throwRoleResolution('client', resolution.reason);
    this.assertExternalRole(resolution, 'client');

    const revoked = await this.auth.revokeClientSession(resolution.payload);
    if ('reason' in revoked) this.throwRoleResolution('client', revoked.reason);

    return {
      ok: true,
      authenticated: true,
      revoked: true,
      strategy: revoked.strategy,
      expiresInSeconds: revoked.expiresInSeconds,
      rawSessionIdentifierStored: false,
    };
  }

  @Post('verify')
  verify(@Body() body: any) {
    return this.auth.verify(body || {});
  }

  private async externalRoleMe(role: ExternalAppRole, authorization?: string) {
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);
    if ('reason' in resolution) this.throwRoleResolution(role, resolution.reason);
    this.assertExternalRole(resolution, role);

    return {
      ok: true,
      authenticated: true,
      required: true,
      role,
      user: {
        id: resolution.principal.subject,
        name: resolution.principal.name,
        email: resolution.principal.email,
      },
      principal: {
        issuer: resolution.principal.issuer,
        subject: resolution.principal.subject,
        role: resolution.principal.role,
        authSource: resolution.principal.authSource,
        ownershipEligible: resolution.principal.ownershipEligible,
        expiresAt: resolution.principal.expiresAt,
      },
      trust: {
        algorithm: 'RS256',
        issuer: resolution.payload.iss,
        audience: resolution.payload.aud,
        authorizedParty: resolution.payload.azp || null,
        realmRole: role,
        ownershipSubject: resolution.principal.subject,
        sessionRevocation: role === 'client' ? 'redis_hashed_sid_fail_closed' : 'keycloak_token_lifecycle',
      },
    };
  }

  private assertExternalRole(
    resolution: Extract<DaAuthPrincipalResolution, { ok: true }>,
    role: ExternalAppRole,
  ): void {
    if (resolution.principal.role !== role) {
      throw new ForbiddenException({
        ok: false,
        authenticated: true,
        code: `${role}_role_required`,
      });
    }
    if (resolution.principal.authSource !== 'external') {
      throw new ForbiddenException({
        ok: false,
        authenticated: true,
        code: 'external_identity_required',
      });
    }
  }

  private throwRoleResolution(role: ExternalAppRole, reason: string): never {
    if (role === 'client' && reason === 'revocation_store_unavailable') {
      throw new ServiceUnavailableException({
        ok: false,
        authenticated: false,
        code: 'client_revocation_store_unavailable',
      });
    }
    if (role === 'client' && reason === 'revoked_token') {
      throw new UnauthorizedException({
        ok: false,
        authenticated: false,
        code: 'client_session_revoked',
      });
    }
    if (role === 'client' && reason === 'client_session_id_missing') {
      throw new UnauthorizedException({
        ok: false,
        authenticated: false,
        code: 'client_session_id_required',
      });
    }
    throw new UnauthorizedException({
      ok: false,
      authenticated: false,
      code: `${role}_bearer_required`,
      reason,
    });
  }
}
