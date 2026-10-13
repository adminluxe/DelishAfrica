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
import type { OrdersRequest } from './orders.access.types';

@Injectable()
export class OrdersAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    // No such provider in production modules. Only synthetic CI supplies it.
    @Optional() private readonly nativeBridge?: NativeClientCommerceIssuerBridge,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrdersRequest>();
    // Never retain identity from a previous synthetic/re-used request.
    if (request) delete request.daOrdersPrincipal;
    const authorization = this.header(request, 'authorization');
    if (this.nativeBridge?.isNativeIssuerToken(authorization)) {
      request.daOrdersPrincipal = await this.nativeBridge.authenticate(context);
      return true;
    }
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);

    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'orders_auth_required',
        reason: resolution.reason,
      });
    }

    const principal = resolution.principal;
    // Legacy-realm Clients may read their OWN existing orders; they may
    // not create or mutate orders until they have been explicitly admitted
    // by the issuer-pinned Native Client bridge and durable email/SMS ledger.
    // Handler identity is NestJS code metadata, not an HTTP query/path hint.
    // Fail closed if the handler is unknown or its name changes.
    if (principal.role === 'client') {
      const handlerName = context.getHandler?.()?.name;
      if (handlerName !== 'list' && handlerName !== 'get') {
        throw new ForbiddenException({
          ok: false,
          code: 'orders_native_client_admission_required',
        });
      }
    }
    if (!['client', 'merchant', 'courier', 'ops'].includes(principal.role)) {
      throw new ForbiddenException({ ok: false, code: 'orders_role_not_allowed' });
    }

    request.daOrdersPrincipal = principal;
    return true;
  }

  private header(request: OrdersRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return undefined; // never accept duplicate Authorization
    return value ? String(value) : undefined;
  }
}
