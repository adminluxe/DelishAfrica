import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CatalogFoundationService } from '../catalog-foundation/catalog-foundation.service';
import {
  minimumOrderAmountCents,
  partnerSlugFromOrderInput,
} from './order-policy';

type AnyRecord = Record<string, any>;

export type CanonicalOrderQuoteItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  scheduledDay: string | null;
};

export type CanonicalOrderQuote = {
  ok: true;
  version: 1;
  partnerSlug: string;
  partnerName: string;
  currency: 'eur';
  availabilityDate: string;
  availabilityDay: string;
  items: CanonicalOrderQuoteItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  minimumOrderAmount: number;
  quoteFingerprint: string;
  quotedAt: string;
};

const WEEKDAY_BY_INDEX = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const;

function normalizeDay(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function brusselsClock(now = new Date()): { date: string; day: string } {
  try {
    const parts = new Intl.DateTimeFormat('fr-BE', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    }).formatToParts(now);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: `${lookup.year}-${lookup.month}-${lookup.day}`,
      day: normalizeDay(lookup.weekday),
    };
  } catch {
    return {
      date: now.toISOString().slice(0, 10),
      day: WEEKDAY_BY_INDEX[now.getDay()] || 'dimanche',
    };
  }
}

function itemId(item: AnyRecord): string {
  return String(item.sku || item.id || '').trim();
}

function itemAmount(item: AnyRecord): number {
  const amount = Number(item.amount);
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount);
  const priceEur = Number(item.priceEUR);
  if (Number.isFinite(priceEur) && priceEur > 0) return Math.round(priceEur * 100);
  const price = Number(item.price);
  if (Number.isFinite(price) && price > 0) {
    return price > 100 ? Math.round(price) : Math.round(price * 100);
  }
  return 0;
}

function requestedItemId(item: AnyRecord): string {
  return String(item.id || item.sku || item.menuItemId || '').trim();
}

function quantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new BadRequestException({
      ok: false,
      code: 'invalid_item_quantity',
      min: 1,
      max: 50,
    });
  }
  return parsed;
}

function fingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

@Injectable()
export class CatalogOrderPolicyService {
  constructor(private readonly catalog: CatalogFoundationService) {}

  async quote(input: AnyRecord = {}): Promise<CanonicalOrderQuote> {
    const partnerSlug = partnerSlugFromOrderInput(input);
    if (!partnerSlug) {
      throw new BadRequestException({ ok: false, code: 'partner_slug_required' });
    }

    const partner = await this.catalog.findPublishedBySlug(partnerSlug, []);
    if (!partner) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'catalog_partner_unavailable',
        partnerSlug,
      });
    }

    const rawPartner = partner as AnyRecord;
    const status = String(rawPartner.status || '').toLowerCase();
    const delivery = (rawPartner.delivery || {}) as AnyRecord;
    if (status !== 'active' || delivery.enabled === false) {
      throw new BadRequestException({
        ok: false,
        code: 'partner_not_orderable',
        partnerSlug,
      });
    }

    const menu = Array.isArray(rawPartner.menuItems)
      ? rawPartner.menuItems
      : Array.isArray(rawPartner.menu)
        ? rawPartner.menu
        : [];
    const requested = Array.isArray(input.items) ? input.items : [];
    if (requested.length === 0) {
      throw new BadRequestException({ ok: false, code: 'order_items_required' });
    }

    const clock = brusselsClock();
    const byId = new Map<string, AnyRecord>();
    for (const candidate of menu) {
      const id = itemId(candidate);
      if (id) byId.set(id, candidate);
    }

    const canonicalItems: CanonicalOrderQuoteItem[] = requested.map((candidate: AnyRecord) => {
      const id = requestedItemId(candidate);
      const menuItem = byId.get(id);
      if (!id || !menuItem) {
        throw new BadRequestException({
          ok: false,
          code: 'catalog_item_not_found',
          partnerSlug,
          itemId: id || null,
        });
      }

      const scheduledDay = normalizeDay(menuItem.day) || null;
      if (scheduledDay && scheduledDay !== clock.day) {
        throw new BadRequestException({
          ok: false,
          code: 'item_not_available_today',
          partnerSlug,
          itemId: id,
          itemName: String(menuItem.name || id),
          scheduledDay,
          today: clock.day,
          availabilityDate: clock.date,
        });
      }

      const unitAmount = itemAmount(menuItem);
      if (unitAmount <= 0) {
        throw new ServiceUnavailableException({
          ok: false,
          code: 'catalog_item_price_unavailable',
          partnerSlug,
          itemId: id,
        });
      }

      const itemQuantity = quantity(candidate.quantity ?? 1);
      return {
        id,
        sku: id,
        name: String(menuItem.name || id),
        category: String(menuItem.category || 'Menu'),
        quantity: itemQuantity,
        unitAmount,
        lineAmount: unitAmount * itemQuantity,
        scheduledDay,
      };
    });

    const subtotal = canonicalItems.reduce((sum, item) => sum + item.lineAmount, 0);
    const deliveryFee = Math.max(0, Math.round(Number(delivery.deliveryFee || 0)));
    const total = subtotal + deliveryFee;
    const minimumOrderAmount = Math.max(
      0,
      Math.round(Number(delivery.minimumOrderAmount || minimumOrderAmountCents(partnerSlug))),
    );

    if (minimumOrderAmount > 0 && total < minimumOrderAmount) {
      throw new BadRequestException({
        ok: false,
        code: 'minimum_order_not_met',
        partnerSlug,
        amount: total,
        minimumOrderAmount,
        missingAmount: minimumOrderAmount - total,
        currency: 'eur',
      });
    }

    const quotedAt = new Date().toISOString();
    const quoteCore = {
      version: 1 as const,
      partnerSlug,
      availabilityDate: clock.date,
      availabilityDay: clock.day,
      items: canonicalItems,
      subtotal,
      deliveryFee,
      total,
      minimumOrderAmount,
      currency: 'eur' as const,
    };

    return {
      ok: true,
      ...quoteCore,
      partnerName: String(rawPartner.name || partnerSlug),
      quoteFingerprint: fingerprint(quoteCore),
      quotedAt,
    };
  }
}
