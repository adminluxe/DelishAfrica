'use strict';

const path = require('path');
const { ConfluenceAiService } = require(
  path.join(__dirname, '..', 'services', 'api-nest', 'dist', 'confluence-ai', 'confluence-ai.service.js'),
);

const auth = {
  async resolvePrincipalFromAuthorization() {
    return {
      principal: {
        authSource: 'external',
        ownershipEligible: true,
        role: 'client',
        subject: 'frugal-probe-client',
      },
    };
  },
};

const service = new ConfluenceAiService(auth);

let providerCalls = 0;
let budgetCalls = 0;

service.runtimeConfig = () => ({ enabled: true, model: 'gpt-5.6-luna' });
service.apiKey = () => 'probe-key-123456789012345678901234567890';
service.consumeProviderBudget = () => {
  budgetCalls += 1;
  return 'ok';
};
service.providerSuggestion = async (input) => {
  providerCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 45));
  return {
    suggestion: 'Lecture calculée uniquement depuis les preuves autorisées.',
    evidenceIndexes: input.evidence.map((_, index) => index),
    uncertainty: 'contains_context',
    caution: 'Suggestion réversible.',
  };
};

const body = {
  oracle: 'taste',
  locale: 'fr',
  evidence: [
    { label: 'Intention choisie', value: 'Découverte douce', kind: 'fact' },
    { label: 'Intensité éditoriale', value: 'Modérée', kind: 'context' },
    { label: 'Fraîcheur éditoriale', value: 'Aujourd’hui', kind: 'fact' },
    { label: 'Voyage proposé', value: 'Dakar', kind: 'context' },
  ],
  localSuggestion: 'Suggestion locale A',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const first = await service.suggest('Bearer probe', body);
  const second = await service.suggest('Bearer probe', body);
  const localCopyOnly = await service.suggest('Bearer probe', {
    ...body,
    localSuggestion: 'Suggestion locale B',
  });

  assert(first.meta.computeSource === 'fresh', 'first request must compute once');
  assert(second.meta.computeSource === 'memoized', 'identical evidence must hit provider memo');
  assert(localCopyOnly.meta.computeSource === 'memoized', 'local wording change must not wake provider');
  assert(providerCalls === 1, 'same evidence should produce exactly one provider call');
  assert(budgetCalls === 1, 'same evidence should consume budget exactly once');

  const changed = {
    ...body,
    evidence: body.evidence.map((item, index) =>
      index === 3 ? { ...item, value: 'Abidjan' } : item,
    ),
  };

  const concurrent = await Promise.all([
    service.suggest('Bearer probe', changed),
    service.suggest('Bearer probe', changed),
    service.suggest('Bearer probe', changed),
  ]);

  const sources = concurrent.map((item) => item.meta.computeSource).sort();
  assert(
    JSON.stringify(sources) === JSON.stringify(['coalesced', 'coalesced', 'fresh']),
    'simultaneous identical evidence must singleflight to one provider call',
  );
  assert(providerCalls === 2, 'changed evidence should add only one provider call');
  assert(budgetCalls === 2, 'changed evidence should add only one budget charge');

  const health = service.health();
  assert(health.frugalCompute.freshCallsSinceBoot === 2, 'fresh call metric mismatch');
  assert(health.frugalCompute.memoHitsSinceBoot === 2, 'memo hit metric mismatch');
  assert(health.frugalCompute.coalescedHitsSinceBoot === 2, 'coalesced hit metric mismatch');
  assert(health.frugalCompute.memoEntries === 2, 'memo entry count mismatch');
  assert(health.frugalCompute.avoidedProviderCallsSinceBoot === 4, 'avoided provider-call metric mismatch');

  console.log(JSON.stringify({
    ok: true,
    providerCalls,
    budgetCalls,
    sources,
    frugalCompute: health.frugalCompute,
  }, null, 2));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(70);
});
