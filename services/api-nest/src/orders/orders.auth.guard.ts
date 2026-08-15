import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { OrdersRequest } from './orders.access.types';

@Injectable()
export class OrdersAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrdersRequest>();
    const authorization = this.header(request, 'authorization');
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization);

    if ('reason' in resolution) {
      throw new UnauthorizedException({
        ok: false,
        code: 'orders_auth_required',
        reason: resolution.reason,
      });
    }

    const principal = resolution.principal;
    if (!['client', 'merchant', 'courier', 'ops'].includes(principal.role)) {
      throw new ForbiddenException({ ok: false, code: 'orders_role_not_allowed' });
    }

    request.daOrdersPrincipal = principal;
    return true;
  }

  private header(request: OrdersRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    if (Array.isArray(value)) return value[0];
    return value ? String(value) : undefined;
  }
}
