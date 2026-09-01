import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { PaymentsRequest } from './payments.types';

@Injectable()
export class PaymentsAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PaymentsRequest>();
    const authorization = this.header(request, 'authorization');
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);

    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'payments_auth_required',
        reason: resolution.reason,
      });
    }

    if (resolution.principal.role !== 'client') {
      throw new ForbiddenException({
        ok: false,
        code: 'payments_client_role_required',
      });
    }

    if (
      resolution.principal.authSource !== 'external' ||
      !resolution.principal.ownershipEligible
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'payments_external_identity_required',
      });
    }

    request.daPaymentsPrincipal = resolution.principal;
    return true;
  }

  private header(request: PaymentsRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return value[0];
    return value ? String(value) : undefined;
  }
}
