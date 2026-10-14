/**
 * P0 isolated QA composition root for Client checkout: PG-first, Stripe TEST stub.
 *
 * NOT imported by AppModule, OrdersModule, PaymentsModule, or published apps.
 * This supplies the pre-existing QA HTTP controller's ports. Its controller
 * MUST retain NativeClientNestCommerceGuard (pinned JWT + committed admission).
 * A QA runner has to provide separate PostgreSQL roles/pools; no public route.
 *
 * Durable order + immutable basket snapshot transaction -> payment authority
 * -> Stripe TEST idempotent request -> PostgreSQL intent binding.
 * Webhook inbox, finality and outbox remain separate authorization contracts.
 */
import type { QaNativeClientCheckoutPorts } from './native-client-checkout.qa.controller';
import {
  QaCanonicalClientQuoteAdapter,
  type QaPublishedCatalogQuoter,
} from './client-commerce-canonical-quote.pg-qa.adapter';
import {
  QaClientCommercePgAdapter,
  type QaPgPool,
} from './client-commerce.pg-qa.adapter';
import { QaCanonicalOrderSnapshotPgAdapter } from './client-order-snapshot.pg-qa.adapter';
import {
  QaStripeTestIntentCreator,
  type QaStripeTestIntentConfig,
} from './stripe-test-intent-create.pg-qa.adapter';
import { QaClientOwnedOrderReceiptReader } from './client-order-receipt.pg-qa.adapter';

export type QaPgFirstCheckoutPortsDeps = Readonly<{
  canonicalCatalog: QaPublishedCatalogQuoter;
  orderReservationPool: QaPgPool;
  stripeIntentCreatorPool: QaPgPool;
  ownedReceiptPool: QaPgPool;
  providerIdempotencyHmacKey: string;
  stripe: QaStripeTestIntentConfig;
}>;

function assertIsolatedQa(): void {
  if (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
      process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES' ||
      process.env.NODE_ENV === 'production') {
    throw Error('qa_pg_first_ports_disconnected_ci_only');
  }
}

/**
 * Inject only into QaIsolatedClientCommerceController's QA token in a
 * disconnected Nest test module. Never register in production AppModule.
 *
 * Stripe's fetcher MUST be an injected synthetic provider; key strings are
 * fake TEST fixtures, never read production env or contact an external PSP.
 */
export function createQaPgFirstCheckoutPorts(
  deps: QaPgFirstCheckoutPortsDeps,
): QaNativeClientCheckoutPorts {
  assertIsolatedQa();
  if (!deps || !deps.stripe || deps.stripe.syntheticOnly !== true ||
      typeof deps.stripe.fetcher !== 'function') {
    throw Error('qa_pg_first_synthetic_stripe_fetcher_required');
  }

  const catalog = new QaCanonicalClientQuoteAdapter(deps.canonicalCatalog);
  const order = new QaCanonicalOrderSnapshotPgAdapter(
    deps.orderReservationPool,
  );
  const paymentReservation = new QaClientCommercePgAdapter(
    deps.orderReservationPool,
    deps.providerIdempotencyHmacKey,
  );
  const intent = new QaStripeTestIntentCreator(
    paymentReservation,
    deps.stripeIntentCreatorPool,
    deps.stripe,
  );
  const receipt = new QaClientOwnedOrderReceiptReader(
    deps.ownedReceiptPool,
  );

  return Object.freeze({
    quoteFromServerCatalog: async (untrustedBody) => {
      assertIsolatedQa();
      return catalog.priceUntrustedCart(untrustedBody);
    },
    reserveCanonicalOrder: async (principal, quote, mutationId) => {
      assertIsolatedQa();
      // Atomic BEGIN/reserve order/write immutable basket/COMMIT.
      // No provider call can occur before this returns successfully.
      return order.reserveOrderAndSnapshot(principal, quote, mutationId);
    },
    readOwnedOrderStatus: async (principal, orderId, mutationId) => {
      assertIsolatedQa();
      return receipt.readOwned(principal, orderId, mutationId);
    },
    createOrResumeStripeTest: async (principal, quote, mutationId) => {
      assertIsolatedQa();
      // The creator re-reserves the same immutable order, atomically reserves
      // a payment authority and verifies it BEFORE contacting Stripe.
      // Both stages retain the SAME server-derived provider idempotency key.
      return intent.createOrResume(principal, quote, mutationId);
    },
  });
}
