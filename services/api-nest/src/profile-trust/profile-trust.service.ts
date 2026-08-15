import { Injectable } from '@nestjs/common';
import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import { domainToASCII } from 'node:url';

type TrustRole = 'client' | 'merchant' | 'courier';
type Severity = 'error' | 'review';

type TrustIssue = {
  field: 'name' | 'phone' | 'email' | 'address' | 'city' | 'request';
  code: string;
  message: string;
  severity: Severity;
};

type ProfileTrustInput = {
  role?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  city?: unknown;
};

const RESERVED_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  'invalid',
  'test',
]);

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
]);

const KNOWN_PROVIDERS = new Map<string, string>([
  ['gmail.com', 'Google'],
  ['googlemail.com', 'Google'],
  ['outlook.com', 'Microsoft'],
  ['hotmail.com', 'Microsoft'],
  ['live.com', 'Microsoft'],
  ['msn.com', 'Microsoft'],
  ['yahoo.com', 'Yahoo'],
  ['yahoo.fr', 'Yahoo'],
  ['icloud.com', 'Apple'],
  ['me.com', 'Apple'],
  ['proton.me', 'Proton'],
  ['protonmail.com', 'Proton'],
  ['gmx.com', 'GMX'],
  ['gmx.fr', 'GMX'],
  ['orange.fr', 'Orange'],
  ['laposte.net', 'La Poste'],
  ['free.fr', 'Free'],
]);

function text(value: unknown, max = 180): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeEmail(value: unknown): string {
  return text(value, 254).toLowerCase();
}

function normalizePhone(value: unknown): string {
  const raw = text(value, 40).replace(/[()\s.-]/g, '');
  const international = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
  const sign = international.startsWith('+') ? '+' : '';
  return sign + international.replace(/\D/g, '');
}

function hasSequentialDigits(digits: string): boolean {
  if (digits.length < 7) return false;
  return '012345678901234567890'.includes(digits) ||
    '987654321098765432109'.includes(digits);
}

function hasLowEntropyDigits(digits: string): boolean {
  const unique = new Set(digits.split('')).size;
  return unique < 4 || /^(\d)\1+$/.test(digits) || /^(\d{2,4})\1+$/.test(digits);
}

function safeDomain(email: string): string {
  const raw = email.split('@')[1] || '';
  return domainToASCII(raw.toLowerCase());
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('dns_timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class ProfileTrustService {
  health() {
    return {
      ok: true,
      service: 'profile-trust',
      mode: 'screening_no_persistence',
      ownershipVerification: false,
      checks: ['phone-plausibility', 'email-domain', 'placeholder-detection', 'address-plausibility'],
    };
  }

  private async inspectDomain(domain: string) {
    const known = KNOWN_PROVIDERS.get(domain);
    if (known) {
      return { status: 'known_provider' as const, provider: known };
    }

    try {
      const mx = await withTimeout<Array<{ exchange: string; priority: number }>>(resolveMx(domain), 2800);
      if (mx.length > 0) {
        return { status: 'mx' as const, provider: 'Domaine professionnel' };
      }
    } catch (error: any) {
      const code = String(error?.code || error?.message || '');
      if (!['ENODATA', 'ENOTFOUND', 'ESERVFAIL'].includes(code) && code !== 'dns_timeout') {
        return { status: 'unknown' as const, provider: 'Indéterminé' };
      }
      if (code === 'dns_timeout' || code === 'ESERVFAIL') {
        return { status: 'unknown' as const, provider: 'Indéterminé' };
      }
    }

    try {
      const [v4, v6] = await withTimeout(
        Promise.allSettled([resolve4(domain), resolve6(domain)]),
        2800,
      );
      const hasAddress =
        (v4.status === 'fulfilled' && v4.value.length > 0) ||
        (v6.status === 'fulfilled' && v6.value.length > 0);
      if (hasAddress) {
        return { status: 'address_record' as const, provider: 'Domaine personnalisé' };
      }
    } catch {
      return { status: 'unknown' as const, provider: 'Indéterminé' };
    }

    return { status: 'none' as const, provider: 'Aucun service mail détecté' };
  }

  async inspect(input: ProfileTrustInput) {
    const roleRaw = text(input.role, 20) as TrustRole;
    const role: TrustRole = ['client', 'merchant', 'courier'].includes(roleRaw)
      ? roleRaw
      : 'client';
    const name = text(input.name, 120);
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    const address = text(input.address, 180);
    const city = text(input.city, 80);
    const issues: TrustIssue[] = [];

    const add = (issue: TrustIssue) => issues.push(issue);

    const nameLetters = name.replace(/[^\p{L}]/gu, '');
    if (nameLetters.length < 2 || /\d/.test(name)) {
      add({ field: 'name', code: 'name_implausible', message: 'Le nom doit contenir au moins deux lettres et aucun chiffre.', severity: 'error' });
    }
    if (/\b(test|fake|faux|demo|inconnu|anonymous|anonyme|qwerty|asdf)\b/i.test(name)) {
      add({ field: 'name', code: 'name_placeholder', message: 'Le nom ressemble à une valeur de test.', severity: 'error' });
    }

    const phoneDigits = phone.replace(/^\+/, '');
    if (!phone.startsWith('+')) {
      add({ field: 'phone', code: 'phone_country_code_required', message: 'Ajoutez l’indicatif international, par exemple +32 ou +221.', severity: 'error' });
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15 || phoneDigits.startsWith('0')) {
      add({ field: 'phone', code: 'phone_length_invalid', message: 'Le numéro international doit contenir entre 8 et 15 chiffres utiles.', severity: 'error' });
    }
    if (hasSequentialDigits(phoneDigits) || hasLowEntropyDigits(phoneDigits)) {
      add({ field: 'phone', code: 'phone_synthetic_sequence', message: 'Cette suite de chiffres ne ressemble pas à un numéro joignable.', severity: 'error' });
    }

    const emailMatch = /^([a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64})@([a-z0-9.-]+)$/i.exec(email);
    let domain = '';
    let domainEvidence: { status: 'known_provider' | 'mx' | 'address_record' | 'none' | 'unknown'; provider: string } = {
      status: 'unknown',
      provider: 'Indéterminé',
    };

    if (!emailMatch || email.length > 254) {
      add({ field: 'email', code: 'email_syntax_invalid', message: 'L’adresse email n’a pas une structure valide.', severity: 'error' });
    } else {
      const local = emailMatch[1].toLowerCase();
      domain = safeDomain(email);
      const labelsValid = domain.length > 3 && domain.includes('.') && !domain.includes('..') &&
        domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
      if (!labelsValid) {
        add({ field: 'email', code: 'email_domain_invalid', message: 'Le domaine email n’est pas valide.', severity: 'error' });
      }
      if (RESERVED_DOMAINS.has(domain) || /\.(test|invalid|localhost|example)$/.test(domain)) {
        add({ field: 'email', code: 'email_reserved_domain', message: 'Les domaines de démonstration ne sont pas acceptés.', severity: 'error' });
      }
      if (DISPOSABLE_DOMAINS.has(domain)) {
        add({ field: 'email', code: 'email_disposable_domain', message: 'Les adresses email temporaires ne sont pas acceptées.', severity: 'error' });
      }
      if (/^(test|fake|faux|demo|example|invalid|no.?mail|temp|qwerty|asdf|123456|012345)/i.test(local)) {
        add({ field: 'email', code: 'email_local_placeholder', message: 'La partie avant @ ressemble à une adresse de test.', severity: 'error' });
      }
      if (/^\d{7,}$/.test(local) && (hasSequentialDigits(local) || hasLowEntropyDigits(local))) {
        add({ field: 'email', code: 'email_local_synthetic', message: 'Cette adresse email paraît synthétique.', severity: 'error' });
      }
      if (!issues.some((issue) => issue.field === 'email' && issue.severity === 'error')) {
        domainEvidence = await this.inspectDomain(domain);
        if (domainEvidence.status === 'none') {
          add({ field: 'email', code: 'email_domain_no_mail', message: 'Aucun service de messagerie n’a été détecté pour ce domaine.', severity: 'error' });
        } else if (domainEvidence.status === 'unknown') {
          add({ field: 'email', code: 'email_domain_retry', message: 'Le domaine email n’a pas pu être contrôlé. Réessayez dans un instant.', severity: 'review' });
        }
      }
    }

    if (role === 'client' || role === 'merchant') {
      const letters = address.replace(/[^\p{L}]/gu, '');
      const words = address.split(/\s+/).filter(Boolean);
      if (letters.length < 6 || words.length < 2) {
        add({ field: 'address', code: 'address_too_weak', message: 'Ajoutez une adresse suffisamment précise pour être exploitable.', severity: 'error' });
      }
      if (/\b(test|fake|faux|demo|adresse|inconnue|inconnu|n\/a|néant|none|qwerty|asdf)\b/i.test(address)) {
        add({ field: 'address', code: 'address_placeholder', message: 'L’adresse ressemble à une valeur de test.', severity: 'error' });
      }
      const cityLetters = city.replace(/[^\p{L}]/gu, '');
      if (cityLetters.length < 2 || /\d{4,}/.test(city)) {
        add({ field: 'city', code: 'city_invalid', message: 'La ville doit être identifiable.', severity: 'error' });
      }
    }

    const hasError = issues.some((issue) => issue.severity === 'error');
    const hasReview = issues.some((issue) => issue.severity === 'review');
    const decision = hasError ? 'reject' : hasReview ? 'review' : 'accept';
    const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === 'error' ? 28 : 12), 0));

    return {
      ok: decision === 'accept',
      decision,
      score,
      normalized: { name, phone, email, address, city },
      phone: { status: issues.some((issue) => issue.field === 'phone') ? 'rejected' : 'plausible' },
      email: { domain, status: domainEvidence.status, provider: domainEvidence.provider },
      issues,
      checkedAt: new Date().toISOString(),
      notice: 'Contrôle de plausibilité et de domaine. La preuve de possession par code email/SMS reste une étape distincte.',
    };
  }
}
