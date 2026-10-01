export type ConfluenceOracle = 'taste' | 'service' | 'route';
export type ConfluenceEvidenceKind = 'fact' | 'estimate' | 'context';
export type ConfluenceUncertainty =
  | 'facts_only'
  | 'contains_estimates'
  | 'insufficient_evidence';

export type ConfluenceEvidence = {
  label: string;
  value: string;
  kind: ConfluenceEvidenceKind;
};

export type ConfluenceNormalizedRequest = {
  oracle: ConfluenceOracle;
  locale: 'fr' | 'en';
  evidence: ConfluenceEvidence[];
  localSuggestion: string;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const GPS_RE = /-?\d{1,2}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/g;
const ORDER_ID_RE = /\bDA-[A-Z0-9][A-Z0-9-]{3,}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const TOKEN_RE = /\b[A-Za-z0-9_-]{40,}\b/g;
const ADDRESS_RE =
  /\b\d{1,5}\s+(?:(?:rue|avenue|av|boulevard|bd|chaussée|chaussee|route|street|st|road|rd|lane|ln)\.?\s+)[\p{L}\d .,'’'-]{2,80}/giu;
const NUMBER_RE = /\b\d+(?:[.,]\d+)?\b/g;

const SENSITIVE_DETECTORS: ReadonlyArray<RegExp> = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?\d[\d\s().-]{7,}\d)/,
  /-?\d{1,2}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/,
  /\bDA-[A-Z0-9][A-Z0-9-]{3,}\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b\d{1,5}\s+(?:(?:rue|avenue|av|boulevard|bd|chaussée|chaussee|route|street|st|road|rd|lane|ln)\.?\s+)[\p{L}\d .,'’'-]{2,80}/iu,
  /\b[A-Za-z0-9_-]{40,}\b/,
];

export function containsSensitiveText(value: unknown): boolean {
  const text = compactText(value, 2048);
  return SENSITIVE_DETECTORS.some((pattern) => pattern.test(text));
}

export function requestContainsSensitiveEvidence(value: any): boolean {
  const rawEvidence = Array.isArray(value?.evidence) ? value.evidence.slice(0, 8) : [];
  return rawEvidence.some((item: any) =>
    containsSensitiveText(item?.label) || containsSensitiveText(item?.value),
  );
}

const ALLOWED_LABELS: Record<ConfluenceOracle, ReadonlySet<string>> = {
  taste: new Set([
    'Intention choisie',
    'Intensité éditoriale',
    'Fraîcheur éditoriale',
    'Voyage proposé',
  ]),
  service: new Set([
    'Commande',
    'Statut serveur',
    'Charge observée',
    'Article visible',
  ]),
  route: new Set([
    'Statut commande',
    'Fenêtre de remise',
    'ETA dispatch',
    'Score dispatch',
  ]),
};

export function compactText(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function scrubSensitiveText(value: unknown, max: number): string {
  return compactText(value, max)
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(GPS_RE, '[redacted-location]')
    .replace(PHONE_RE, '[redacted-phone]')
    .replace(ORDER_ID_RE, '[redacted-order]')
    .replace(UUID_RE, '[redacted-id]')
    .replace(URL_RE, '[redacted-url]')
    .replace(ADDRESS_RE, '[redacted-address]')
    .replace(TOKEN_RE, '[redacted-token]');
}

export function normalizeRequest(value: any): ConfluenceNormalizedRequest | null {
  const oracle = String(value?.oracle || '').trim().toLowerCase();
  if (!['taste', 'service', 'route'].includes(oracle)) return null;

  const typedOracle = oracle as ConfluenceOracle;
  const localeRaw = String(value?.locale || 'fr').trim().toLowerCase();
  const locale: 'fr' | 'en' = localeRaw === 'en' ? 'en' : 'fr';
  const rawEvidence = Array.isArray(value?.evidence) ? value.evidence.slice(0, 8) : [];

  const evidence: ConfluenceEvidence[] = rawEvidence
    .map((item: any) => {
      const kindRaw = String(item?.kind || 'context').trim().toLowerCase();
      const kind: ConfluenceEvidenceKind =
        kindRaw === 'fact' || kindRaw === 'estimate' ? kindRaw : 'context';
      const label = scrubSensitiveText(item?.label, 80);
      if (!ALLOWED_LABELS[typedOracle].has(label)) return null;
      const data = scrubSensitiveText(item?.value, 240);
      if (!data) return null;
      return { label, value: data, kind };
    })
    .filter((item: ConfluenceEvidence | null): item is ConfluenceEvidence => Boolean(item));

  const localSuggestion = scrubSensitiveText(value?.localSuggestion, 520);
  if (!localSuggestion) return null;

  return {
    oracle: typedOracle,
    locale,
    evidence,
    localSuggestion,
  };
}

function numericTokens(value: string): Set<string> {
  const tokens = value.match(NUMBER_RE) || [];
  return new Set(tokens.map((token) => token.replace(',', '.')));
}

export function outputIntroducesNumbers(outputText: string, evidence: ConfluenceEvidence[]): boolean {
  const allowed = numericTokens(evidence.map((item) => `${item.label} ${item.value}`).join(' | '));
  const produced = numericTokens(outputText);
  for (const token of produced) {
    if (!allowed.has(token)) return true;
  }
  return false;
}

export function humanBoundaryFor(oracle: ConfluenceOracle, locale: 'fr' | 'en'): string {
  if (locale === 'en') {
    if (oracle === 'taste') return 'The assistant suggests; the client chooses. No sensitive or cultural identity is inferred.';
    if (oracle === 'service') return 'The assistant never changes an order status and never marks food ready.';
    return 'The assistant never accepts, picks up, or delivers a mission. Those actions remain explicit human choices.';
  }
  if (oracle === 'taste') return 'L’assistant propose ; le client choisit. Aucune identité sensible ou culturelle n’est déduite.';
  if (oracle === 'service') return 'L’assistant ne change aucun statut de commande et ne marque jamais un plat prêt.';
  return 'L’assistant n’accepte, ne récupère et ne livre aucune mission. Ces gestes restent explicitement humains.';
}

export function localUncertainty(evidence: ConfluenceEvidence[]): ConfluenceUncertainty {
  if (!evidence.length) return 'insufficient_evidence';
  return evidence.some((item) => item.kind === 'estimate') ? 'contains_estimates' : 'facts_only';
}
