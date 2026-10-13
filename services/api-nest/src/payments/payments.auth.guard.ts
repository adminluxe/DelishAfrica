import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { NativeClientCommerceIssuerBridge } from '../auth/native-client-commerce-issuer-bridge';
import type { DaAuthPrincipal } from '../auth/auth.types';
import type { PaymentsRequest } from './payments.types';

@Injectable()
export class PaymentsAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    // Not registered by any production module. Synthetic CI only.
    @Optional() private readonly nativeBridge?: NativeClientCommerceIssuerBridge,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PaymentsRequest>();
    if (request) delete request.daPaymentsPrincipal;
    const authorization = this.header(request, 'authorization');
    let principal: DaAuthPrincipal;
    // The legacy issuer may contain a correctly signed Client role but it
    // has not proved the new commerce email/SMS + PostgreSQL admission.
    // Only the verified Native Client bridge may mint a payment principal.
    const nativeClientAdmission = this.nativeBridge?.isNativeIssuerToken(authorization) === true;
    if (nativeClientAdmission) {
      principal = await this.nativeBridge.authenticate(context);
    } else {
      const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);
      if ('reason' in resolution) {
        throw new UnauthorizedException({
          ok: false,
          code: 'payments_auth_required',
          reason: resolution.reason,
        });
      }
      principal = resolution.principal;
    }

    if (principal.role === 'client' && !nativeClientAdmission) {
      throw new ForbiddenException({
        ok: false,
        code: 'payments_native_client_admission_required',
      });
    }

    if (principal.role !== 'client') {
      throw new ForbiddenException({
        ok: false,
        code: 'payments_client_role_required',
      });
    }

    if (
      principal.authSource !== 'external' ||
      !principal.ownershipEligible
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'payments_external_identity_required',
      });
    }

    request.daPaymentsPrincipal = principal;
    return true;
  }

  private header(request: PaymentsRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return undefined; // reject duplicate Authorization
    return value ? String(value) : undefined;
  }
}
