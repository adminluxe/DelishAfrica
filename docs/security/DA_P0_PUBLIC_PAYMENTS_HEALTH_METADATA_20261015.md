# DelishAfrica P0 — anonymous Payments health metadata minimization

Date: 15 October 2026. **PR DRAFT only. NO DEPLOY / NO MERGE / NO LIVE.**

## Observed risk

Public GET `/api/v1/payments/health` returned HTTP 200 and disclosed internal flags and strings about Stripe key presence, publishable key, webhook secret availability, settlement guards, order-commit authority and runtime payment authority storage. Those details can aid reconnaissance and are not necessary for unauthenticated liveness checks.

## Narrow candidate correction

On a branch from `main`, in `services/api-nest/src/payments/payments.controller.ts` only, preserve `@Get('health')`, HTTP success and the public response keys `ok` / `service`; internally invoke `PaymentsService.health()` but return **only** those two fields.

**Unchanged:** PaymentsService business logic, Stripe APIs, PaymentIntent, pricing, auth guard on `POST /payments/create-intent`, providers listing, webhooks, reconciliation, PostgreSQL, deployments and Apple/Expo. No other endpoint touched.

## Required evidence

- TypeScript API builds on exact SHA.
- Compiled Nest controller contract tests: public response has exactly `ok,service`; a failure status is not hidden; providers catalogue is unaffected.
- Confirm existing public probes continue to use `ok` / HTTP 200 and do not require sensitive fields.
- Before deployment, identify any external monitoring dashboards relying on removed flags. If present, migrate those consumers to protected, authenticated diagnostics in a separate approved change.

## Limitations

This is not a fix for Stripe account mismatch (LU official TEST vs BE VPS), the PostgreSQL-before-PSP requirement, financial authorization or historical FastAPI V0 exposure. A merged source change does not mean the VPS Docker image has been updated. **No deployment, no migration, no new payment, no LIVE or payout.**
