export const COURIER_FAIR_PAY_LAB_FLAG = 'DA_COURIER_FAIR_PAY_LAB_ENABLED';

export function courierFairPayLabEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return String(env[COURIER_FAIR_PAY_LAB_FLAG] || '').toLowerCase() === 'true';
}

export function assertCourierFairPayLabEnabled(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!courierFairPayLabEnabled(env)) {
    throw new Error('COURIER_FAIR_PAY_LAB_DISABLED');
  }
}
