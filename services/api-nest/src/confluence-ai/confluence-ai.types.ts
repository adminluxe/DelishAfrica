import type { ConfluenceEvidence, ConfluenceOracle, ConfluenceUncertainty } from './confluence-ai.policy';

export type ConfluenceSuggestionRequest = {
  oracle?: ConfluenceOracle | string;
  locale?: 'fr' | 'en' | string;
  evidence?: Array<Partial<ConfluenceEvidence>>;
  localSuggestion?: string;
};

export type ConfluenceSuggestion = {
  ok: true;
  mode: 'local' | 'ai';
  oracle: ConfluenceOracle;
  suggestion: string;
  evidenceIndexes: number[];
  uncertainty: ConfluenceUncertainty;
  caution: string;
  humanBoundary: string;
  meta: {
    provider: 'deterministic_local' | 'openai_responses';
    generatedAt: string;
    fallbackReason?: string;
    computeSource?: 'fresh' | 'memoized' | 'coalesced';
    structured: true;
    actionSideEffects: false;
    providerStore: false;
    sensitiveEvidenceTransit: false;
  };
};
