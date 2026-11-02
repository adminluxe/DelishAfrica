/** Read-only mobile projection: invalid reads cannot masquerade as an empty service. */
export type OrderReadState = 'loading' | 'ready' | 'auth_required' | 'forbidden' | 'unavailable';
export function orderReadFailure(error: any): Exclude<OrderReadState, 'loading' | 'ready'> {
  const code = String(error?.code || error?.message || '');
  if (error?.status === 401 || /(?:oidc_session_required|auth_required|token_unavailable)/.test(code)) return 'auth_required';
  if (error?.status === 403 || /(?:access_forbidden|binding_required|membership_pending|selection_required)/.test(code)) return 'forbidden';
  return 'unavailable';
}
export function orderReadMessage(state: OrderReadState): string {
  if (state === 'loading') return 'Lecture des commandes en cours.';
  if (state === 'auth_required') return 'Connectez votre compte Merchant pour lire les commandes.';
  if (state === 'forbidden') return 'Vérifiez le rattachement et les droits de votre établissement.';
  if (state === 'ready') return 'Commandes synchronisées.';
  return 'Lecture des commandes non confirmée. Réessayez.';
}
function record(value: unknown): any {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
export function readOrderList<T>(payload: unknown): T[] {
  const p = record(payload);
  if (p?.ok === false) throw new Error('orders_response_rejected');
  const source = Array.isArray(payload) ? payload :
    [p?.orders, p?.data?.orders, p?.items, p?.data].find(Array.isArray);
  if (!source) throw new Error('orders_response_invalid');
  const seen = new Set<string>();
  return source.map((value: unknown) => {
    const order = record(value);
    const id = String(order?.publicId || order?.orderId || order?.id || '').trim();
    if (!order || !id || id === 'UNKNOWN' || id === 'DA-ORDER' || seen.has(id)) throw new Error('orders_identity_invalid');
    seen.add(id);
    // Canonical prices from legacy adapters may infer units. Only explicitly typed
    // amounts on the source record are used below; safety never loses legacy flags.
    return order as T;
  });
}
export function orderMoneyLabel(value: unknown): string {
  const o = record(value);
  if (!o) return '—';
  let amount: unknown, currency: unknown;
  if (record(o.pricing?.total)) {
    amount = o.pricing.total.amountMinor; currency = o.pricing.total.currency;
  } else if (o.totalMinor !== undefined) {
    amount = o.totalMinor; currency = o.currency;
  } else if (typeof o.totalEUR === 'number' && Number.isFinite(o.totalEUR) && o.totalEUR >= 0) {
    amount = Math.round(o.totalEUR * 100); currency = 'EUR';
  } else return '—';
  if (!Number.isSafeInteger(amount) || (amount as number) < 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return '—';
  // Supported currencies in the platform contract; unknown units remain unknown.
  const digits: Record<string, number> = { EUR: 2, USD: 2, GBP: 2, CHF: 2, CAD: 2, XOF: 0, XAF: 0 };
  const scale = digits[currency];
  if (scale === undefined) return '—';
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency, minimumFractionDigits: scale, maximumFractionDigits: scale }).format((amount as number) / 10 ** scale);
}
export function orderSafety(value: unknown) {
  const o = record(value) || {};
  const sources = [o.canonical?.safety, o.safety, o, o.customer].filter(Boolean);
  const values = (key: string) => [...new Set<string>(sources.flatMap(s => Array.isArray(s[key]) ? s[key].map((v: unknown) => String(v || '').trim()).filter(Boolean) : []))];
  const allergens = values('allergenFlags'), dietary = values('dietaryTags');
  const note = [...new Set<string>(sources.map(s => String(s.note || s.foodSafetyNote || '').trim()).filter(Boolean))].join(' · ');
  return { allergens, dietary, note, urgent: allergens.length > 0 || sources.some(s => s.requiresMerchantAcknowledgement === true) };
}
