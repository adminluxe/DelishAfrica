import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { DaAuthPrincipal } from '../auth/auth.types';

export type CourierPresenceRecord = {
  schemaVersion: 1;
  issuer: string;
  subject: string;
  courierId: string;
  name: string;
  online: boolean;
  activeZone: string;
  city: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  vehicle: string;
  capacity: number;
  lastSeenAt: string;
  expiresAt: string;
  updatedAt: string;
};

const DEFAULT_TTL_MS = 180_000;
const STORE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function filePath(): string {
  const configured = String(process.env.DA_COURIER_PRESENCE_STORE_FILE || '').trim();
  return configured || path.join(process.cwd(), '.runtime', 'courier-presence-store.json');
}

function clean(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

@Injectable()
export class CourierPresenceService {
  private readAll(): CourierPresenceRecord[] {
    try {
      const target = filePath();
      if (!fs.existsSync(target)) return [];
      const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
      const records = Array.isArray(parsed) ? parsed : parsed?.records;
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  private writeAll(records: CourierPresenceRecord[]): void {
    const target = filePath();
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: STORE_VERSION, updatedAt: nowIso(), records }, null, 2), 'utf8');
    fs.renameSync(temporary, target);
  }

  courierId(principal: DaAuthPrincipal): string {
    return clean(principal.courierId || principal.subject);
  }

  heartbeat(principal: DaAuthPrincipal, input: Record<string, any> = {}): CourierPresenceRecord {
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    const courierId = this.courierId(principal);
    const now = new Date();
    const online = input.available === true || input.online === true;
    const ttl = Math.max(60_000, Number(process.env.DA_COURIER_PRESENCE_TTL_MS || DEFAULT_TTL_MS));
    const record: CourierPresenceRecord = {
      schemaVersion: 1,
      issuer: principal.issuer,
      subject: principal.subject,
      courierId,
      name: clean(input.riderName || input.name || principal.name || 'Coursier DelishAfrica'),
      online,
      activeZone: clean(input.activeZone || input.zone || input.territory?.city),
      city: clean(input.city || input.territory?.city),
      countryCode: clean(input.countryCode || input.territory?.countryCode).toUpperCase(),
      latitude: finite(input.latitude ?? input.territoryEvidence?.latitude),
      longitude: finite(input.longitude ?? input.territoryEvidence?.longitude),
      vehicle: clean(input.vehicle || 'courier'),
      capacity: Math.min(8, Math.max(1, Number(input.capacity || 1))),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (online ? ttl : 0)).toISOString(),
      updatedAt: now.toISOString(),
    };
    const records = this.readAll().filter((item) => item.courierId !== courierId);
    records.push(record);
    this.writeAll(records);
    return clone(record);
  }

  get(courierId: string): CourierPresenceRecord | null {
    const found = this.readAll().find((item) => item.courierId === courierId) || null;
    return found ? clone(found) : null;
  }

  active(): CourierPresenceRecord[] {
    const now = Date.now();
    return this.readAll()
      .filter((item) => item.online && new Date(item.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .map(clone);
  }

  isActive(courierId: string): boolean {
    return this.active().some((item) => item.courierId === courierId);
  }
}
