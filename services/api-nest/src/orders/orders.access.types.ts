import type { DaAuthPrincipal } from '../auth/auth.types';

export type OrdersRequest = {
  headers?: Record<string, string | string[] | undefined>;
  daOrdersPrincipal?: DaAuthPrincipal;
};
