import type { DaAuthPrincipal } from '../auth/auth.types';

export type PaymentsRequest = {
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, any>;
  rawBody?: Buffer;
  daPaymentsPrincipal?: DaAuthPrincipal;
};
