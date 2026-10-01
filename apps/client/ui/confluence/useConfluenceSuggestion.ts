import { useEffect, useMemo, useRef, useState } from "react";
import { daOrdersFetch } from "../../utils/daOrdersApi";

export type ConfluenceOracleKind = "taste" | "service" | "route";
export type ConfluenceEvidenceKind = "fact" | "estimate" | "context";
export type ConfluenceUncertainty = "facts_only" | "contains_context" | "contains_estimates" | "insufficient_evidence";

export type ConfluenceEvidenceInput = {
  label: string;
  value: string;
  kind?: ConfluenceEvidenceKind;
};

type ConfluenceServerPayload = {
  ok?: boolean;
  mode?: "local" | "ai";
  oracle?: ConfluenceOracleKind;
  suggestion?: string;
  evidenceIndexes?: number[];
  uncertainty?: ConfluenceUncertainty;
  caution?: string;
  humanBoundary?: string;
  meta?: {
    provider?: string;
    generatedAt?: string;
    fallbackReason?: string;
    structured?: boolean;
    actionSideEffects?: boolean;
    providerStore?: boolean;
    sensitiveEvidenceTransit?: boolean;
  };
};

type DisplayState = {
  key: string;
  suggestion: string;
  humanBoundary: string;
  engineLabel: string;
  footnote: string;
  mode: "embedded" | "server_local" | "ai";
  evidenceIndexes: number[];
  uncertainty: ConfluenceUncertainty;
  generatedAt?: string;
  privacyNote: string;
};

type Params = {
  oracle: ConfluenceOracleKind;
  evidence: ReadonlyArray<ConfluenceEvidenceInput>;
  localSuggestion: string;
  localHumanBoundary: string;
  enabled?: boolean;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const CACHE_TTL_MS = 60_000;
const DEBOUNCE_MS = 520;
const cache = new Map<string, { at: number; value: DisplayState }>();

function compact(value: unknown, max = 420): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function requestKey(
  oracle: ConfluenceOracleKind,
  evidence: ReadonlyArray<ConfluenceEvidenceInput>,
  localSuggestion: string,
): string {
  return JSON.stringify([
    oracle,
    evidence.map((item) => [compact(item.label, 80), compact(item.value, 240), item.kind || "context"]),
    compact(localSuggestion, 520),
  ]);
}

function uncertaintyFromEvidence(evidence: ReadonlyArray<ConfluenceEvidenceInput>): ConfluenceUncertainty {
  if (!evidence.length) return "insufficient_evidence";
  if (evidence.some((item) => item.kind === "estimate")) return "contains_estimates";
  if (evidence.some((item) => item.kind === "context" || !item.kind)) return "contains_context";
  return "facts_only";
}

function fallbackState(
  key: string,
  evidence: ReadonlyArray<ConfluenceEvidenceInput>,
  localSuggestion: string,
  localHumanBoundary: string,
  reason = "Le cerveau serveur reste optionnel : cette lecture embarquée ne bloque jamais le parcours.",
): DisplayState {
  return {
    key,
    suggestion: localSuggestion,
    humanBoundary: localHumanBoundary,
    engineLabel: "Confluence embarqué · preuve locale",
    footnote: reason,
    mode: "embedded",
    evidenceIndexes: evidence.map((_, index) => index),
    uncertainty: uncertaintyFromEvidence(evidence),
    privacyNote: "Passeport IA · aucune clé fournisseur dans l’app · suggestion locale de secours.",
  };
}

function humanFallbackReason(reason: unknown): string {
  const value = compact(reason, 80);
  if (!value || value === "feature_disabled") return "IA externe désactivée · réponse déterministe du serveur.";
  if (value === "provider_unconfigured") return "Fournisseur IA non configuré · réponse déterministe du serveur.";
  if (value === "insufficient_evidence") return "Preuves insuffisantes · réponse déterministe du serveur.";
  if (value === "numerical_claim_guard") return "Une précision non prouvée a été bloquée · retour déterministe.";
  if (value === "provider_unavailable") return "Fournisseur IA indisponible · retour déterministe.";
  return "Réponse déterministe du serveur.";
}

function privacyNoteFromServer(value: ConfluenceServerPayload): string {
  const sensitiveBlocked = value.meta?.sensitiveEvidenceTransit === false;
  const storeOff = value.meta?.providerStore === false;
  if (sensitiveBlocked && storeOff) {
    return "Passeport IA · données sensibles bloquées · stockage fournisseur désactivé.";
  }
  return "Passeport IA · protections fail-closed actives côté serveur.";
}

function validateServer(
  raw: unknown,
  key: string,
  evidence: ReadonlyArray<ConfluenceEvidenceInput>,
  localSuggestion: string,
  localHumanBoundary: string,
): DisplayState | null {
  const value = raw as ConfluenceServerPayload;
  if (!value || value.ok !== true) return null;

  const suggestion = compact(value.suggestion, 420);
  const humanBoundary = compact(value.humanBoundary, 420) || localHumanBoundary;
  const caution = compact(value.caution, 220);
  const evidenceIndexes = Array.from(
    new Set(
      (Array.isArray(value.evidenceIndexes) ? value.evidenceIndexes : [])
        .filter((index) => Number.isInteger(index) && index >= 0 && index < evidence.length),
    ),
  );
  const uncertainty =
    value.uncertainty === "facts_only" ||
    value.uncertainty === "contains_context" ||
    value.uncertainty === "contains_estimates" ||
    value.uncertainty === "insufficient_evidence"
      ? value.uncertainty
      : uncertaintyFromEvidence(evidence);
  const generatedAt = compact(value.meta?.generatedAt, 80) || undefined;
  if (!suggestion || value.meta?.actionSideEffects === true) return null;

  if (value.mode === "ai") {
    return {
      key,
      suggestion,
      humanBoundary,
      engineLabel: "Confluence AI serveur · sortie structurée",
      footnote: caution || "Suggestion IA bornée aux preuves visibles.",
      mode: "ai",
      evidenceIndexes,
      uncertainty,
      generatedAt,
      privacyNote: privacyNoteFromServer(value),
    };
  }

  if (value.mode === "local") {
    const fallbackReason = humanFallbackReason(value.meta?.fallbackReason);
    return {
      key,
      suggestion,
      humanBoundary,
      engineLabel: "Confluence serveur · fallback déterministe",
      footnote: [caution, fallbackReason].filter(Boolean).join(" "),
      mode: "server_local",
      evidenceIndexes: evidenceIndexes.length ? evidenceIndexes : evidence.map((_, index) => index),
      uncertainty,
      generatedAt,
      privacyNote: privacyNoteFromServer(value),
    };
  }

  return fallbackState(key, evidence, localSuggestion, localHumanBoundary);
}

export function useConfluenceSuggestion({
  oracle,
  evidence,
  localSuggestion,
  localHumanBoundary,
  enabled = true,
}: Params): DisplayState {
  const key = useMemo(
    () => requestKey(oracle, evidence, localSuggestion),
    [evidence, localSuggestion, oracle],
  );

  const immediate = useMemo(
    () => fallbackState(key, evidence, localSuggestion, localHumanBoundary),
    [evidence, key, localHumanBoundary, localSuggestion],
  );

  const [resolved, setResolved] = useState<DisplayState | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;

    if (!enabled || !evidence.length) {
      setResolved(null);
      return undefined;
    }

    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setResolved(cached.value);
      return undefined;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await daOrdersFetch(`${API_BASE}/confluence/ai/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              oracle,
              locale: "fr",
              evidence,
              localSuggestion,
            }),
          });

          if (!response.ok) throw new Error(`HTTP_${response.status}`);
          const json = await response.json().catch(() => null);
          const next = validateServer(json, key, evidence, localSuggestion, localHumanBoundary);
          if (!next) throw new Error("INVALID_CONFLUENCE_RESPONSE");

          cache.set(key, { at: Date.now(), value: next });
          if (mine === generation.current) setResolved(next);
        } catch {
          if (mine === generation.current) {
            setResolved(
              fallbackState(
                key,
                evidence,
                localSuggestion,
                localHumanBoundary,
                "Serveur Confluence non joint ou session indisponible · la suggestion locale reste active.",
              ),
            );
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [enabled, evidence, key, localHumanBoundary, localSuggestion, oracle]);

  return resolved?.key === key ? resolved : immediate;
}
