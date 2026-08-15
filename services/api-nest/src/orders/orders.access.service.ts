import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DaAuthPrincipal } from '../auth/auth.types';
import { CatalogFoundationService } from '../catalog-foundation/catalog-foundation.service';
import {
  CanonicalOrderQuote,
  CatalogOrderPolicyService,
} from '../order-policy/catalog-order-policy.service';
import { PaymentsService } from '../payments/payments.service';
import type { AnyOrder, DemoOrderStatus } from './orders.demo.store';
import type { OrdersRequest } from './orders.access.types';

const MERCHANT_TRANSITIONS: Record<string, readonly DemoOrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: [],
  picked_up: [],
  delivered: [],
  cancelled: [],
};

const COURIER_TRANSITIONS: Record<string, readonly DemoOrderStatus[]> = {
  pending: [],
  accepted: [],
  ready: ['picked_up'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class OrdersAccessService {
  constructor(
    private readonly catalog: CatalogFoundationService,
    private readonly orderPolicy: CatalogOrderPolicyService,
    private readonly payments: PaymentsService,
  ) {}

  principal(request: OrdersRequest): DaAuthPrincipal {
    const principal = request.daOrdersPrincipal;
    if (!principal) throw new Error('orders_principal_missing_after_guard');
    return principal;
  }

  requireOps(principal: DaAuthPrincipal): void {
    if (principal.role !== 'ops') {
      throw new ForbiddenException({ ok: false, code: 'orders_ops_required' });
    }
  }

  requireCreateRole(principal: DaAuthPrincipal): void {
    const trustedOps = principal.role === 'ops' && principal.ownershipEligible;
    if (principal.role !== 'client' && !trustedOps) {
      throw new ForbiddenException({ ok: false, code: 'orders_create_role_forbidden' });
    }
  }

  requestedId(input: Record<string, any> = {}): string {
    const raw = input.id || input.orderId || input.order_id || input.publicId || input.public_id;
    return raw ? String(raw) : '';
  }

  async secureCreateInput(
    principal: DaAuthPrincipal,
    input: Record<string, any>,
    existing: AnyOrder | null,
  ): Promise<Record<string, any>> {
    this.requireCreateRole(principal);

    if (existing && principal.role !== 'ops' && !this.clientOwns(principal, existing)) {
      throw new ForbiddenException({ ok: false, code: 'orders_idempotency_owner_mismatch' });
    }

    const authorizedQuote = this.payments.authorizedQuoteForInput(principal, input);
    const quote: CanonicalOrderQuote =
      authorizedQuote || (await this.orderPolicy.quote(input));

    const payment = await this.payments.verifyPaidOrder(principal, input, quote);
    const existingPaymentIntentId = String(existing?.payment?.paymentIntentId || '');
    if (existingPaymentIntentId && existingPaymentIntentId !== payment.paymentIntentId) {
      throw new ConflictException({
        ok: false,
        code: 'orders_idempotency_payment_mismatch',
      });
    }

    const createdAt = String(existing?.daOwnership?.createdAt || new Date().toISOString());
    const ownership = existing?.daOwnership || {
      schemaVersion: 1,
      clientIssuer: principal.issuer,
      clientSubject: principal.subject,
      clientId: principal.clientId || principal.subject,
      createdAt,
    };

    return {
      ...input,
      partnerSlug: quote.partnerSlug,
      merchantSlug: quote.partnerSlug,
      restaurantId: quote.partnerSlug,
      restaurantName: quote.partnerName,
      merchantName: quote.partnerName,
      items: quote.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        amount: item.unitAmount,
        price: item.unitAmount / 100,
        lineAmount: item.lineAmount,
        scheduledDay: item.scheduledDay,
      })),
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      total: quote.total,
      amount: quote.total,
      currency: quote.currency,
      payment,
      catalogQuote: {
        version: quote.version,
        quoteFingerprint: quote.quoteFingerprint,
        quotedAt: quote.quotedAt,
        availabilityDate: quote.availabilityDate,
        availabilityDay: quote.availabilityDay,
        minimumOrderAmount: quote.minimumOrderAmount,
      },
      clientId: principal.clientId || principal.subject,
      customerId: principal.clientId || principal.subject,
      daOwnership: ownership,
    };
  }

  async visibleOrders(principal: DaAuthPrincipal, orders: AnyOrder[]): Promise<AnyOrder[]> {
    if (principal.role === 'ops') return orders;
    if (principal.role === 'client') return orders.filter((order) => this.clientOwns(principal, order));
    if (principal.role === 'courier') return orders.filter((order) => this.courierCanRead(principal, order));

    const slugs = await this.merchantSlugs(principal);
    return orders.filter((order) => slugs.has(this.orderMerchantSlug(order)));
  }

  async requireReadable(principal: DaAuthPrincipal, order: AnyOrder | null): Promise<AnyOrder> {
    if (!order) throw this.hiddenNotFound();
    const visible = await this.visibleOrders(principal, [order]);
    if (visible.length !== 1) throw this.hiddenNotFound();
    return order;
  }

  async requireStatusTransition(
    principal: DaAuthPrincipal,
    order: AnyOrder | null,
    nextStatus: string,
  ): Promise<AnyOrder> {
    const currentOrder = await this.requireReadable(principal, order);
    const current = this.status(currentOrder.status);
    const next = this.status(nextStatus);

    if (principal.role === 'ops') return currentOrder;
    if (principal.role === 'client') {
      throw new ForbiddenException({ ok: false, code: 'client_order_status_forbidden' });
    }

    if (principal.role === 'merchant') {
      const allowed = MERCHANT_TRANSITIONS[current] || [];
      if (!allowed.includes(next)) {
        throw new ForbiddenException({
          ok: false,
          code: 'merchant_order_transition_forbidden',
          currentStatus: current,
          nextStatus: next,
        });
      }
      return currentOrder;
    }

    if (!this.courierAssigned(principal, currentOrder)) {
      throw new ForbiddenException({ ok: false, code: 'courier_assignment_required' });
    }
    const allowed = COURIER_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_order_transition_forbidden',
        currentStatus: current,
        nextStatus: next,
      });
    }
    return currentOrder;
  }

  async requireLiveRead(principal: DaAuthPrincipal, order: AnyOrder | null): Promise<AnyOrder> {
    return this.requireReadable(principal, order);
  }

  requireLivePublisher(principal: DaAuthPrincipal, order: AnyOrder | null): AnyOrder {
    if (!order) throw this.hiddenNotFound();
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    if (!this.courierAssigned(principal, order)) {
      throw new ForbiddenException({ ok: false, code: 'courier_assignment_required' });
    }
    return order;
  }

  courierId(principal: DaAuthPrincipal): string {
    return String(principal.courierId || principal.subject);
  }

  private clientOwns(principal: DaAuthPrincipal, order: AnyOrder): boolean {
    const owner = order?.daOwnership;
    return Boolean(
      owner
      && owner.clientIssuer === principal.issuer
      && owner.clientSubject === principal.subject,
    );
  }

  private async merchantSlugs(principal: DaAuthPrincipal): Promise<Set<string>> {
    const slugs = new Set<string>();
    if (principal.authSource === 'dev-login' && principal.merchantSlug) {
      slugs.add(this.slug(principal.merchantSlug));
    }
    const owned = await this.catalog.listOwnedBySubject(principal.subject);
    for (const candidate of owned) slugs.add(this.slug(candidate.slug));
    if (slugs.size === 0) {
      throw new ForbiddenException({ ok: false, code: 'merchant_order_ownership_required' });
    }
    return slugs;
  }

  private orderMerchantSlug(order: AnyOrder): string {
    return this.slug(order.partnerSlug || order.merchantSlug || order.restaurantId || '');
  }

  private courierCanRead(principal: DaAuthPrincipal, order: AnyOrder): boolean {
    const status = this.status(order.status);
    const proposal = order?.assignmentProposal;
    const proposalStatus = String(proposal?.status || '').toLowerCase();
    const assignedId = String(proposal?.courierId || '');
    const currentId = this.courierId(principal);

    if (status === 'ready') {
      return ['proposed', 'accepted'].includes(proposalStatus) && assignedId === currentId;
    }
    if (status === 'picked_up' || status === 'delivered') {
      return proposalStatus === 'accepted' && assignedId === currentId;
    }
    return false;
  }

  private courierAssigned(principal: DaAuthPrincipal, order: AnyOrder): boolean {
    const proposal = order?.assignmentProposal;
    return Boolean(
      proposal
      && String(proposal.status || '').toLowerCase() === 'accepted'
      && String(proposal.courierId || '') === this.courierId(principal),
    );
  }

  private status(value: unknown): DemoOrderStatus {
    const status = String(value || '').toLowerCase();
    if (status === 'accepted') return 'accepted';
    if (status === 'ready') return 'ready';
    if (status === 'picked_up' || status === 'pickedup' || status === 'picked-up') return 'picked_up';
    if (status === 'delivered') return 'delivered';
    if (status === 'cancelled' || status === 'canceled') return 'cancelled';
    return 'pending';
  }

  private slug(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private hiddenNotFound(): NotFoundException {
    return new NotFoundException({ ok: false, code: 'order_not_found' });
  }
}
