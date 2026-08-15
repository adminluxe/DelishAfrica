import { BadRequestException } from '@nestjs/common';

type AnyRecord = Record<string, any>;

const DEFAULT_MINIMUMS_CENTS: Record<string, number> = {
  thieyp: 2000,
};

function slug(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function finite(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function envName(partnerSlug: string): string {
  return `DA_${partnerSlug.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_MINIMUM_ORDER_CENTS`;
}

export function minimumOrderAmountCents(partnerSlug: unknown): number {
  const partner = slug(partnerSlug);
  if (!partner) return 0;
  const configured = finite(process.env[envName(partner)]);
  if (configured > 0) return Math.round(configured);
  return Math.max(0, Math.round(DEFAULT_MINIMUMS_CENTS[partner] || 0));
}

export function partnerSlugFromOrderInput(input: AnyRecord = {}): string {
  return slug(
    input.partnerSlug
    || input.merchantSlug
    || input.restaurantSlug
    || input.restaurantId
    || input.metadata?.partnerSlug
    || input.metadata?.restaurantSlug,
  );
}

export function orderAmountCents(input: AnyRecord = {}, knownAmount?: number): number {
  const explicit = finite(knownAmount);
  if (explicit > 0) return Math.round(explicit);
  const cents = finite(input.amountCents);
  if (cents > 0) return Math.round(cents);
  const raw = finite(input.amount ?? input.total ?? input.subtotal);
  if (raw > 0 && raw < 100) return Math.round(raw * 100);
  if (raw >= 100) return Math.round(raw);
  return 0;
}

export function assertMinimumOrder(input: AnyRecord = {}, knownAmount?: number): void {
  const partnerSlug = partnerSlugFromOrderInput(input);
  const minimumOrderAmount = minimumOrderAmountCents(partnerSlug);
  if (minimumOrderAmount <= 0) return;
  const amount = orderAmountCents(input, knownAmount);
  if (amount >= minimumOrderAmount) return;
  throw new BadRequestException({
    ok: false,
    code: 'minimum_order_not_met',
    partnerSlug,
    amount,
    minimumOrderAmount,
    missingAmount: Math.max(0, minimumOrderAmount - amount),
    currency: String(input.currency || 'eur').toLowerCase(),
  });
}
