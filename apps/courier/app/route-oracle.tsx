import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { daOrdersFetch, daSessionRehydrationStatus } from "../utils/daOrdersApi";
import {
  loadCourierPresence,
  saveCourierPresence,
  syncCourierPresence,
} from "../utils/daPresenceStore";
import { WaterRouteCurrent } from "../ui/water/WaterRouteCurrent";
// DA_GALA_CAPILLARY_FUSION_V1 - Route Oracle keeps its mature dark-water grammar while light mission surfaces receive restrained capillary refraction; no new timer or business mutation.
// DA_GALA_OSMOTIC_SEAM_V1 - Courier remains the visual reference: only edge contrast and caustic hardness are reduced, structure is preserved.
// DA_GALA_PHASE_DECOHERENCE_V1 - multi-axis phase drift and boundary evaporation dissolve residual layer geometry while preserving business truth and existing animation clocks.
import { ConfluenceOracleLens, type ConfluenceAiMode } from "../ui/confluence/ConfluenceOracleLens";
import { useConfluenceSuggestion } from "../ui/confluence/useConfluenceSuggestion";

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";
const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const OFFERS_PATH = "/orders/demo/courier/offers";
const ACCEPT_PATH = "/orders/demo/courier/offers/accept";
const REJECT_PATH = "/orders/demo/courier/offers/reject";
const HEARTBEAT_MS = 60_000;
const SESSION_GRACE_DELAYS_MS = [0, 250, 600, 1200] as const;

type AnyRecord = Record<string, any>;

type PresenceProof = {
  token?: string;
  verifiedAt?: string;
  expiresAt?: string;
  destination?: string;
};

type CourierProfileLite = {
  id?: string;
  riderName?: string;
  phone?: string;
  email?: string;
  activeZone?: string;
  vehicle?: string;
  capacity?: string | number;
  emergencyContact?: string;
  notes?: string;
  available?: boolean;
  territory?: {
    city?: string;
    country?: string;
    countryCode?: string;
    key?: string;
  };
  territoryEvidence?: {
    latitude?: number;
    longitude?: number;
    detectedAt?: string;
    source?: string;
  };
  proofs?: {
    phone?: PresenceProof;
    email?: PresenceProof;
  };
  trust?: {
    status?: string;
  };
  updatedAt?: string;
};

type OfferView = {
  order: AnyRecord;
  proposal: AnyRecord;
  orderId: string;
  restaurantName: string;
  itemName: string;
  totalLabel: string;
  proposalStatus: string;
  score: number | null;
  confidence: number | null;
  etaMin: number | null;
  territoryKey: string;
  offerAttempt: number | null;
  expiresAt: string;
  reasons: string[];
};

type ScreenState = {
  loading: boolean;
  activating: boolean;
  deciding: boolean;
  online: boolean;
  profile: CourierProfileLite | null;
  offer: OfferView | null;
  message: string;
  error: string;
};

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function orderIdOf(order: AnyRecord): string {
  return clean(order?.publicId || order?.orderId || order?.id);
}

function firstItemName(order: AnyRecord): string {
  const first = Array.isArray(order?.items) ? order.items[0] : null;
  return clean(first?.name || first?.title || order?.restaurantName || "Mission DelishAfrica");
}

function totalLabel(order: AnyRecord): string {
  const raw = numberOrNull(order?.total ?? order?.amount);
  if (raw === null) return "Montant synchronisé";
  const euros = raw > 500 ? raw / 100 : raw;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function proposalStatusOf(proposal: AnyRecord): string {
  return clean(proposal?.status || proposal?.proposalStatus).toLowerCase();
}

function extractOrders(payload: AnyRecord): AnyRecord[] {
  const candidates = [
    payload?.orders,
    payload?.items,
    payload?.data,
    payload?.offers,
    payload?.data?.orders,
    payload?.data?.offers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry) => entry && typeof entry === "object");
    }
  }

  return [];
}

function buildOffer(order: AnyRecord): OfferView | null {
  const proposal =
    order?.assignmentProposal && typeof order.assignmentProposal === "object"
      ? order.assignmentProposal
      : null;

  const orderId = orderIdOf(order);
  if (!orderId || !proposal) return null;

  const proposalStatus = proposalStatusOf(proposal);
  if (!["proposed", "accepted"].includes(proposalStatus)) return null;

  const score = numberOrNull(proposal?.score);
  const confidence = numberOrNull(proposal?.confidence);
  const etaMin = numberOrNull(proposal?.totalEtaMin ?? proposal?.etaMin);
  const territoryKey = clean(proposal?.territoryKey);
  const offerAttempt = numberOrNull(proposal?.offerAttempt);
  const expiresAt = clean(proposal?.expiresAt);

  const reasons: string[] = [];
  if (score !== null) {
    reasons.push(`Compatibilité calculée par le dispatch : ${Math.round(score)}/100.`);
  }
  if (confidence !== null) {
    reasons.push(`Confiance de la recommandation : ${Math.round(confidence)}%.`);
  }
  if (etaMin !== null) {
    reasons.push(`ETA mission estimée : ${Math.max(1, Math.round(etaMin))} min.`);
  }
  if (territoryKey) {
    reasons.push(`Territoire compatible : ${territoryKey}.`);
  }
  if (offerAttempt !== null) {
    reasons.push(`Tentative de proposition serveur : ${Math.max(1, Math.round(offerAttempt))}.`);
  }
  reasons.push("Cette offre est ciblée sur votre identité Courier authentifiée.");
  reasons.push("Le serveur propose. Vous seul décidez d’accepter ou de décliner.");

  return {
    order,
    proposal,
    orderId,
    restaurantName: clean(order?.restaurantName || order?.merchantName || "Restaurant partenaire"),
    itemName: firstItemName(order),
    totalLabel: totalLabel(order),
    proposalStatus,
    score,
    confidence,
    etaMin,
    territoryKey,
    offerAttempt,
    expiresAt,
    reasons,
  };
}

function findPriorityOffer(payload: AnyRecord): OfferView | null {
  return extractOrders(payload)
    .map(buildOffer)
    .filter((offer): offer is OfferView => Boolean(offer))
    .sort((a, b) => {
      if (a.proposalStatus === "accepted" && b.proposalStatus !== "accepted") return -1;
      if (b.proposalStatus === "accepted" && a.proposalStatus !== "accepted") return 1;
      return (b.score ?? -1) - (a.score ?? -1);
    })[0] ?? null;
}

type CourierHandoffView = { label: string; kitchen: string; terrain: string; bridge: string; proof: string; active: boolean };

function courierHandoffView(offer: OfferView): CourierHandoffView {
  const status = clean(offer.order?.status || "pending").toLowerCase();
  const eta = offer.etaMin;
  const etaText = eta !== null ? `${Math.max(1, Math.round(eta))} min` : "non reçue";

  if (status === "picked_up" || status === "delivered") return {
    label: "RELAIS EFFECTUÉ", kitchen: "Remise confirmée", terrain: status === "delivered" ? "Livraison terminée" : "Trajet client actif",
    bridge: "Le retrait n’est plus une estimation : la commande a franchi le relais restaurant → coursier.",
    proof: `Preuve : statut serveur ${status}.`, active: true,
  };
  if (status === "ready") return {
    label: "FENÊTRE DE RETRAIT OUVERTE", kitchen: "Commande prête", terrain: eta !== null ? `Approche estimée · ${etaText}` : "ETA dispatch non reçue",
    bridge: "La cuisine est prête. L’ETA aide à lire l’approche, mais seul votre geste explicite confirme la récupération.",
    proof: eta !== null ? "Preuve : statut ready + ETA dispatch." : "Preuve : statut ready uniquement.", active: true,
  };
  if (status === "accepted") return {
    label: "CUISINE EN COURS", kitchen: "Préparation confirmée", terrain: eta !== null ? `ETA mission estimée · ${etaText}` : "Approche non chiffrée",
    bridge: "Ne courez pas après une estimation : Route Oracle garde la proposition lisible jusqu’au vrai signal prêt.",
    proof: eta !== null ? "Preuve : statut accepted + ETA dispatch estimée." : "Preuve : statut accepted uniquement.", active: true,
  };
  return {
    label: "RETRAIT FERMÉ", kitchen: "Commande non prête", terrain: eta !== null ? `ETA mission estimée · ${etaText}` : "Aucun départ requis",
    bridge: "Le dispatch peut proposer une mission ; il ne transforme pas une commande non prête en ordre de départ.",
    proof: eta !== null ? `Preuve : statut ${status} + ETA dispatch.` : `Preuve : statut serveur ${status}.`, active: false,
  };
}

function CourierHandoffCurrent({ offer }: { offer: OfferView }) {
  const view = courierHandoffView(offer);
  return (
    <View style={styles.confluenceCard}>
      <View style={styles.confluenceTop}>
        <View style={styles.flex}>
          <Text style={styles.confluenceKicker}>CONFLUENCE · HANDOFF CURRENT</Text>
          <Text style={styles.confluenceTitle}>Lire la remise avant d’agir.</Text>
        </View>
        <View style={[styles.confluenceBadge, view.active && styles.confluenceBadgeActive]}>
          <Text style={[styles.confluenceBadgeText, view.active && styles.confluenceBadgeTextActive]}>{view.label}</Text>
        </View>
      </View>
      <View style={styles.confluenceStreams}>
        <View style={styles.confluenceStream}><Text style={styles.confluenceStreamLabel}>CUISINE</Text><Text style={styles.confluenceStreamValue}>{view.kitchen}</Text></View>
        <View style={styles.confluenceJoin}><View style={styles.confluenceJoinLine} /><View style={[styles.confluenceJoinDrop, view.active && styles.confluenceJoinDropActive]} /><View style={styles.confluenceJoinLine} /></View>
        <View style={styles.confluenceStream}><Text style={styles.confluenceStreamLabel}>ROUTE</Text><Text style={styles.confluenceStreamValue}>{view.terrain}</Text></View>
      </View>
      <Text style={styles.confluenceBridge}>{view.bridge}</Text>
      <Text style={styles.confluenceProof}>{view.proof}</Text>
    </View>
  );
}

async function postJson(path: string, body: AnyRecord = {}): Promise<AnyRecord> {
  const response = await daOrdersFetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.ok === false || !json) {
    const code = clean(json?.code || json?.error || json?.message || `HTTP_${response.status}`);
    throw new Error(code || `HTTP_${response.status}`);
  }

  return json as AnyRecord;
}

function humanError(error: unknown): string {
  const raw = clean(error instanceof Error ? error.message : error);
  if (!raw) return "Le dispatch n’a pas répondu.";
  if (raw.includes("courier_oidc_session_required")) return "Session Courier sécurisée requise.";
  if (raw.includes("orders_auth_required")) return "Session Courier expirée. Renouvelez votre session.";
  if (raw.includes("courier_role_required")) return "Cette action est réservée au rôle Courier.";
  if (raw.includes("dispatch_offer_not_found")) return "Cette proposition n’est plus active. Le radar va se resynchroniser.";
  return raw.replace(/_/g, " ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSessionError(error: unknown): boolean {
  const raw = clean(error instanceof Error ? error.message : error);
  return raw.includes("courier_oidc_session_required") || raw.includes("orders_auth_required");
}

async function waitForCourierSession(): Promise<boolean> {
  for (const delayMs of SESSION_GRACE_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      const status = await daSessionRehydrationStatus();
      if (status?.ok === true) return true;
    } catch {
      // The next grace attempt retries encrypted OIDC restoration.
    }
  }
  return false;
}

function proofIsCurrent(proof: PresenceProof | undefined, destination: string): boolean {
  if (!proof?.token || !proof?.expiresAt || clean(proof.destination) !== destination) return false;
  const expiresAt = new Date(proof.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function profileReady(profile: CourierProfileLite | null): boolean {
  if (!profile) return false;

  const phone = clean(profile.phone);
  const email = clean(profile.email).toLowerCase();
  const territoryReady = Boolean(
    clean(profile.activeZone) &&
      clean(profile.territory?.city) &&
      clean(profile.territory?.countryCode) &&
      Number.isFinite(Number(profile.territoryEvidence?.latitude)) &&
      Number.isFinite(Number(profile.territoryEvidence?.longitude)),
  );

  return (
    territoryReady &&
    proofIsCurrent(profile.proofs?.phone, phone) &&
    proofIsCurrent(profile.proofs?.email, email) &&
    profile.trust?.status === "screened"
  );
}

export default function RouteOracleScreen() {
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<ScreenState>({
    loading: true,
    activating: false,
    deciding: false,
    online: false,
    profile: null,
    offer: null,
    message: "",
    error: "",
  });
  const [decisionPreviewOpen, setDecisionPreviewOpen] = useState(false);
  const [confluenceAiMode, setConfluenceAiMode] = useState<ConfluenceAiMode>("server");

  useEffect(() => {
    setDecisionPreviewOpen(false);
  }, [state.offer?.orderId, state.offer?.proposalStatus]);

  const readOffers = useCallback(async (quiet = false) => {
    if (!quiet) {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: "",
        message: "Restauration de la session sécurisée…",
      }));
    }

    try {
      if (!(await waitForCourierSession())) {
        throw new Error("courier_oidc_session_required");
      }

      const payload = await postJson(OFFERS_PATH, {});
      const offer = findPriorityOffer(payload);

      setState((prev) => ({
        ...prev,
        loading: false,
        offer,
        message: offer
          ? "Une proposition ciblée est disponible."
          : "Aucune proposition active pour le moment.",
        error: "",
      }));
    } catch (error) {
      if (quiet && isSessionError(error)) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "",
          message: "Session sécurisée en cours de restauration…",
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: humanError(error),
      }));
    }
  }, []);

  const refreshPresence = useCallback(
    async (profile: CourierProfileLite, quiet = true) => {
      try {
        if (!(await waitForCourierSession())) {
          throw new Error("courier_oidc_session_required");
        }

        const next = {
          ...profile,
          available: true,
          updatedAt: new Date().toISOString(),
        };
        await syncCourierPresence(next);
        setState((prev) => ({
          ...prev,
          loading: false,
          online: true,
          profile: next,
          error: "",
          ...(quiet ? {} : { message: "Présence terrain confirmée." }),
        }));
        await readOffers(true);
      } catch (error) {
        if (quiet && isSessionError(error)) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "",
            message: "Session sécurisée en cours de restauration…",
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          online: false,
          error: humanError(error),
        }));
      }
    },
    [readOffers],
  );

  const bootstrap = useCallback(async () => {
    let profile: CourierProfileLite | null = null;
    try {
      profile = await loadCourierPresence<CourierProfileLite>();
    } catch {
      profile = null;
    }

    const online = Boolean(profile?.available);

    setState((prev) => ({
      ...prev,
      profile,
      online,
      error: "",
    }));

    if (online && profile) {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: "",
        message: "Restauration de la session sécurisée…",
      }));
      await refreshPresence(profile, false);
      return;
    }

    await readOffers(false);
  }, [readOffers, refreshPresence]);

  useFocusEffect(
    useCallback(() => {
      void bootstrap();

      return () => {
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = null;
        }
      };
    }, [bootstrap]),
  );

  useEffect(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }

    if (!state.online || !state.profile) return;

    heartbeatTimer.current = setInterval(() => {
      void refreshPresence(state.profile as CourierProfileLite, true);
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
    };
  }, [refreshPresence, state.online, state.profile]);

  async function activatePresence() {
    if (state.activating) return;

    if (!profileReady(state.profile)) {
      setState((prev) => ({
        ...prev,
        error: "Complétez d’abord votre territoire et votre véhicule dans Mon espace Courier.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      activating: true,
      error: "",
      message: "",
    }));

    try {
      if (!(await waitForCourierSession())) {
        throw new Error("courier_oidc_session_required");
      }

      const next = {
        ...(state.profile as CourierProfileLite),
        available: true,
        updatedAt: new Date().toISOString(),
      };

      await saveCourierPresence(next);
      await syncCourierPresence(next);

      setState((prev) => ({
        ...prev,
        activating: false,
        online: true,
        profile: next,
        message: "Présence terrain activée. Le serveur peut maintenant vous proposer une mission.",
      }));

      await readOffers(true);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        activating: false,
        error: humanError(error),
      }));
    }
  }

  async function decide(kind: "accept" | "reject") {
    const offer = state.offer;
    if (!offer || state.deciding) return;

    setState((prev) => ({
      ...prev,
      deciding: true,
      error: "",
      message: "",
    }));

    try {
      const path = kind === "accept" ? ACCEPT_PATH : REJECT_PATH;
      const payload = await postJson(path, {
        orderId: offer.orderId,
        ...(kind === "reject" ? { reason: "courier_declined" } : {}),
      });

      if (kind === "accept") {
        const acceptedOrder =
          payload?.order && typeof payload.order === "object" ? payload.order : offer.order;
        const acceptedOffer = buildOffer(acceptedOrder);

        setState((prev) => ({
          ...prev,
          deciding: false,
          offer: acceptedOffer || prev.offer,
          message:
            "Mission acceptée. La commande reste prête jusqu’à votre confirmation de récupération.",
        }));

        setTimeout(() => router.push("/orders" as any), 450);
        return;
      }

      setState((prev) => ({
        ...prev,
        deciding: false,
        offer: null,
        message:
          "Proposition déclinée. Le serveur peut maintenant recommander un autre coursier.",
      }));

      await readOffers(true);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        deciding: false,
        error: humanError(error),
      }));
    }
  }

  const metrics = useMemo(() => {
    const offer = state.offer;
    return [
      {
        label: "Score",
        value:
          offer?.score !== null && offer?.score !== undefined
            ? `${Math.round(offer.score)}`
            : "Ciblée",
      },
      {
        label: "ETA",
        value:
          offer?.etaMin !== null && offer?.etaMin !== undefined
            ? `${Math.max(1, Math.round(offer.etaMin))} min`
            : "Live",
      },
      {
        label: "Décision",
        value: offer?.proposalStatus === "accepted" ? "Acceptée" : "Humaine",
      },
    ];
  }, [state.offer]);

  const proposalReady = state.offer?.proposalStatus === "proposed";
  const proposalAccepted = state.offer?.proposalStatus === "accepted";

  const oracleLens = useMemo(() => {
    const offer = state.offer;
    if (!offer) return null;
    const handoff = courierHandoffView(offer);
    const status = clean(offer.order?.status || "pending").toLowerCase();
    const etaLabel = offer.etaMin !== null ? `${Math.max(1, Math.round(offer.etaMin))} min` : "Non reçue";
    const suggestion =
      status === "ready"
        ? "La cuisine est prête : utilisez l’ETA comme contexte, puis confirmez le retrait uniquement quand il a réellement eu lieu."
        : status === "accepted"
          ? "La cuisine prépare encore : gardez la mission lisible et attendez le vrai signal prêt avant de traiter la remise comme ouverte."
          : status === "picked_up" || status === "delivered"
            ? "Le relais est déjà confirmé : ne rejouez aucune décision de retrait."
            : "Le dispatch peut proposer une mission, mais aucun signal ne justifie encore de traiter le retrait comme ouvert.";

    return {
      suggestion,
      evidence: [
        { label: "Statut commande", value: status, kind: "fact" as const },
        { label: "Fenêtre de remise", value: handoff.label, kind: "context" as const },
        { label: "ETA dispatch", value: etaLabel, kind: offer.etaMin !== null ? "estimate" as const : "context" as const },
        { label: "Score dispatch", value: offer.score !== null ? `${Math.round(offer.score)}/100` : "Non reçu", kind: offer.score !== null ? "estimate" as const : "context" as const },
      ],
    };
  }, [state.offer]);

  const confluenceSuggestion = useConfluenceSuggestion({
    oracle: "route",
    evidence: oracleLens?.evidence ?? [],
    localSuggestion:
      oracleLens?.suggestion ??
      "Aucune proposition active : attendre une preuve dispatch avant toute lecture.",
    localHumanBoundary:
      "Cette lecture n’accepte, ne récupère et ne livre aucune mission à votre place. Les trois gestes restent explicitement humains.",
    enabled: Boolean(oracleLens) && confluenceAiMode === "server",
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.loading}
            onRefresh={() => void bootstrap()}
            tintColor="#6EF0B0"
          />
        }
      >
                <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroSubsurfaceVeil} />
          <View pointerEvents="none" style={styles.heroCausticTrace} />
          <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
          <Text style={styles.title}>Route Oracle</Text>
          <Text style={styles.subtitle}>
            Le serveur propose. Vous gardez la décision. Chaque proposition explique uniquement les signaux réellement disponibles.
          </Text>

          <View style={styles.contractRow}>
            <View style={[styles.dot, state.online && styles.dotOnline]} />
            <View style={styles.contractCopy}>
              <Text style={styles.contractKicker}>CONTRAT HUMAIN</Text>
              <Text style={styles.contractText}>
                Aucun départ automatique · acceptation ou refus explicite.
              </Text>
            </View>
          </View>
        </View>

        <WaterRouteCurrent
          phase={proposalAccepted ? "pickup" : proposalReady ? "offer" : "idle"}
          statusLabel={state.online ? "LIVE" : "VEILLE"}
          headline={
            proposalAccepted
              ? "Mission acceptée. Le courant attend votre retrait."
              : proposalReady
                ? "Une proposition remonte. Vous gardez la décision."
                : state.online
                  ? "Le radar reste ouvert, sans urgence inventée."
                  : "Le terrain attend votre présence."
          }
          body={
            state.offer
              ? "Score, confiance et ETA viennent du dispatch déjà reçu. Route Current les rend lisibles sans accepter la mission à votre place."
              : "Aucun mouvement n’est fabriqué. Le prochain courant apparaîtra seulement lorsqu’une proposition réelle sera disponible."
          }
          orderId={state.offer?.orderId}
          destination={state.offer?.restaurantName || state.offer?.territoryKey}
          metrics={[
            {
              label: "ETA",
              value:
                state.offer?.etaMin !== null && state.offer?.etaMin !== undefined
                  ? `${Math.max(1, Math.round(state.offer.etaMin))} min`
                  : "—",
            },
            {
              label: "Score",
              value:
                state.offer?.score !== null && state.offer?.score !== undefined
                  ? `${Math.round(state.offer.score)}`
                  : "—",
            },
            {
              label: "Confiance",
              value:
                state.offer?.confidence !== null && state.offer?.confidence !== undefined
                  ? `${Math.round(state.offer.confidence)}%`
                  : "—",
            },
          ]}
          actionLabel={proposalAccepted ? "Ouvrir le cockpit mission" : undefined}
          onOpen={proposalAccepted ? () => router.push("/orders" as any) : undefined}
        />

        {state.offer ? <CourierHandoffCurrent offer={state.offer} /> : null}

        {!state.online ? (
                    <View style={styles.presenceCard}>
            <View pointerEvents="none" style={styles.lightSurfaceVeil} />
            <View pointerEvents="none" style={styles.lightSurfaceCaustic} />
            <Text style={styles.sectionKicker}>PRÉSENCE TERRAIN</Text>
            <Text style={styles.cardTitle}>Entrez dans le radar du dispatch.</Text>
            <Text style={styles.body}>
              Route Oracle ne vous affecte rien tout seul. Activez votre disponibilité pour recevoir uniquement les offres ciblées sur votre identité sécurisée.
            </Text>

            <Pressable
              style={[styles.primaryButton, state.activating && styles.buttonDisabled]}
              disabled={state.activating}
              onPress={() => void activatePresence()}
            >
              {state.activating ? (
                <ActivityIndicator color="#001E15" />
              ) : (
                <Text style={styles.primaryText}>Je suis disponible</Text>
              )}
            </Pressable>

            {!profileReady(state.profile) ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.push("/courier-space" as any)}
              >
                <Text style={styles.secondaryText}>Compléter Mon espace Courier</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {state.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Route Oracle à resynchroniser</Text>
            <Text style={styles.errorText}>{state.error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void bootstrap()}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {state.loading && !state.offer ? (
          <View style={styles.waitCard}>
            <ActivityIndicator size="large" color="#6EF0B0" />
            <Text style={styles.waitTitle}>Lecture du dispatch…</Text>
            <Text style={styles.body}>
              Présence, charge et proposition sécurisée sont synchronisées.
            </Text>
          </View>
        ) : null}

        {!state.loading && !state.offer && !state.error ? (
          <View style={styles.waitCard}>
            <Text style={styles.sectionKicker}>RADAR ACTIF</Text>
            <Text style={styles.cardTitle}>Aucune offre pour le moment.</Text>
            <Text style={styles.body}>
              Dès qu’une commande prête vous est proposée par le serveur, elle apparaît ici sans exposer les missions des autres coursiers.
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => void bootstrap()}>
              <Text style={styles.secondaryText}>Rafraîchir le radar</Text>
            </Pressable>
          </View>
        ) : null}

        {state.offer ? (
          <>
                        <View style={styles.offerCard}>
              <View pointerEvents="none" style={styles.lightSurfaceVeil} />
              <View pointerEvents="none" style={styles.lightSurfaceCaustic} />
              <View style={styles.offerTop}>
                <View style={styles.flex}>
                  <Text style={styles.sectionKicker}>PROPOSITION CIBLÉE</Text>
                  <Text style={styles.offerTitle}>{state.offer.itemName}</Text>
                  <Text style={styles.offerMeta}>
                    {state.offer.orderId} · {state.offer.restaurantName} · {state.offer.totalLabel}
                  </Text>
                </View>

                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {proposalAccepted ? "ACCEPTÉE" : proposalReady ? "À DÉCIDER" : "CIBLÉE"}
                  </Text>
                </View>
              </View>

              <View style={styles.metrics}>
                {metrics.map((metric) => (
                  <View key={metric.label} style={styles.metric}>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {oracleLens ? (
              <ConfluenceOracleLens
                accent="#6EF0B0"
                engineLabel={confluenceSuggestion.engineLabel}
                title="Route Oracle explique avant de proposer"
                suggestion={confluenceSuggestion.suggestion}
                evidence={oracleLens.evidence}
                humanBoundary={confluenceSuggestion.humanBoundary}
                footnote={confluenceSuggestion.footnote}
          mode={confluenceSuggestion.mode}
          uncertainty={confluenceSuggestion.uncertainty}
          evidenceIndexes={confluenceSuggestion.evidenceIndexes}
          generatedAt={confluenceSuggestion.generatedAt}
          privacyNote={confluenceSuggestion.privacyNote}
          excludedSignals={["Taux de refus", "Nom ou identité personnelle", "Données de paiement"]}
          aiMode={confluenceAiMode}
          onAiModeChange={setConfluenceAiMode}
              />
            ) : null}

            <View style={styles.whyCard}>
              <Text style={styles.sectionKicker}>POURQUOI VOUS ?</Text>
              <Text style={styles.cardTitle}>La recommandation reste explicable.</Text>

              <View style={styles.reasons}>
                {state.offer.reasons.map((reason, index) => (
                  <View key={`${reason}-${index}`} style={styles.reasonRow}>
                    <View style={styles.reasonNumber}>
                      <Text style={styles.reasonNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </View>

            {proposalReady ? (
              <View style={styles.decisionCard}>
                <Text style={styles.sectionKicker}>VOTRE DÉCISION</Text>
                <Text style={styles.cardTitle}>Vous gardez le dernier mot.</Text>

                <Pressable
                  style={({ pressed }) => [styles.decisionPreviewButton, pressed && styles.buttonPressed]}
                  onPress={() => setDecisionPreviewOpen((value) => !value)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: decisionPreviewOpen }}
                  accessibilityLabel={decisionPreviewOpen ? "Masquer le sas de décision" : "Prévisualiser les conséquences de votre décision"}
                >
                  <View style={styles.decisionPreviewButtonCopy}>
                    <Text style={styles.decisionPreviewKicker}>SAS HUMAIN · AUCUNE ACTION ENVOYÉE</Text>
                    <Text style={styles.decisionPreviewButtonText}>
                      {decisionPreviewOpen ? "Masquer la prévisualisation" : "Voir ce qui se passe avant de choisir"}
                    </Text>
                  </View>
                  <Text style={styles.decisionPreviewArrow}>{decisionPreviewOpen ? "↑" : "↓"}</Text>
                </Pressable>

                {decisionPreviewOpen ? (
                  <View style={styles.decisionPreviewPanel}>
                    <View style={styles.decisionPreviewRow}>
                      <Text style={styles.decisionPreviewLabel}>SI VOUS ACCEPTEZ</Text>
                      <Text style={styles.decisionPreviewText}>
                        La mission rejoint votre cockpit. Le retrait et la livraison restent deux confirmations humaines séparées.
                      </Text>
                    </View>
                    <View style={styles.decisionPreviewDivider} />
                    <View style={styles.decisionPreviewRow}>
                      <Text style={styles.decisionPreviewLabel}>SI VOUS DÉCLINEZ</Text>
                      <Text style={styles.decisionPreviewText}>
                        Cette proposition est libérée pour que le serveur puisse poursuivre le dispatch vers un autre coursier.
                      </Text>
                    </View>
                    <Text style={styles.decisionPreviewFootnote}>
                      Cette prévisualisation est locale : aucun appel réseau n’est envoyé tant que vous n’appuyez pas sur Accepter ou Décliner.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={[styles.primaryButton, state.deciding && styles.buttonDisabled]}
                  disabled={state.deciding}
                  onPress={() => void decide("accept")}
                >
                  {state.deciding ? (
                    <ActivityIndicator color="#001E15" />
                  ) : (
                    <Text style={styles.primaryText}>Accepter la mission</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.secondaryButton, state.deciding && styles.buttonDisabled]}
                  disabled={state.deciding}
                  onPress={() => void decide("reject")}
                >
                  <Text style={styles.secondaryText}>Décliner cette proposition</Text>
                </Pressable>
              </View>
            ) : null}

            {proposalAccepted ? (
                            <View style={styles.acceptedCard}>
                <View pointerEvents="none" style={styles.lightSurfaceVeil} />
                <View pointerEvents="none" style={styles.lightSurfaceCaustic} />
                <Text style={styles.acceptedKicker}>MISSION CONFIRMÉE</Text>
                <Text style={styles.acceptedTitle}>La mission est à vous.</Text>
                <Text style={styles.acceptedText}>
                  L’acceptation ne déclenche ni récupération ni livraison. Ces deux étapes restent des confirmations explicites dans le cockpit.
                </Text>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push("/orders" as any)}
                >
                  <Text style={styles.primaryText}>Ouvrir le cockpit mission</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {state.message ? <Text style={styles.footerMessage}>{state.message}</Text> : null}

        <Pressable style={styles.linkButton} onPress={() => router.push("/orders" as any)}>
          <Text style={styles.linkText}>Missions</Text>
        </Pressable>

        <Text style={styles.footer}>
          Dispatch serveur · identité Courier · décision humaine · aucune auto-livraison.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  confluenceCard: { borderRadius: 26, padding: 16, backgroundColor: "rgba(4, 40, 30, 0.89)", borderWidth: 1, borderColor: "rgba(110,240,176,0.20)", gap: 13 },
  confluenceTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  confluenceKicker: { color: "#6EF0B0", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  confluenceTitle: { color: "#FFF8E8", fontSize: 16, lineHeight: 21, fontWeight: "900", marginTop: 5 },
  confluenceBadge: { maxWidth: 150, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(110,240,176,0.13)", backgroundColor: "rgba(255,255,255,0.035)" },
  confluenceBadgeActive: { borderColor: "rgba(110,240,176,0.42)", backgroundColor: "rgba(23,105,77,0.28)" },
  confluenceBadgeText: { color: "rgba(255,248,232,0.54)", fontSize: 8.5, lineHeight: 11, fontWeight: "900", letterSpacing: 0.6, textAlign: "center" },
  confluenceBadgeTextActive: { color: "#89F4C2" },
  confluenceStreams: { flexDirection: "row", alignItems: "stretch", gap: 7 },
  confluenceStream: { flex: 1, minHeight: 66, borderRadius: 16, padding: 10, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(110,240,176,0.08)" },
  confluenceStreamLabel: { color: "rgba(255,248,232,0.50)", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 },
  confluenceStreamValue: { color: "#FFF8E8", fontSize: 12.5, lineHeight: 17, fontWeight: "800", marginTop: 6 },
  confluenceJoin: { width: 26, alignItems: "center", justifyContent: "center" },
  confluenceJoinLine: { width: 1, flex: 1, backgroundColor: "rgba(110,240,176,0.08)" },
  confluenceJoinDrop: { width: 11, height: 11, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 7, borderBottomRightRadius: 3, borderWidth: 1, borderColor: "rgba(110,240,176,0.30)", backgroundColor: "rgba(110,240,176,0.08)", transform: [{ rotate: "45deg" }] },
  confluenceJoinDropActive: { borderColor: "rgba(137,244,194,0.78)", backgroundColor: "rgba(137,244,194,0.26)" },
  confluenceBridge: { color: "rgba(255,248,232,0.74)", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  confluenceProof: { color: "rgba(255,248,232,0.44)", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
  safe: { flex: 1, backgroundColor: "#001C14" },
  content: { padding: 22, paddingBottom: 48, gap: 18 },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    padding: 28,
    backgroundColor: "rgba(6,43,32,0.89)",
    borderWidth: 1,
    borderColor: "rgba(110,240,176,0.21)",
  },
  heroSubsurfaceVeil: { position: "absolute", width: 338, height: 128, right: -126, top: 118, borderTopLeftRadius: 150, borderTopRightRadius: 42, borderBottomRightRadius: 130, borderBottomLeftRadius: 34, backgroundColor: "rgba(110,240,176,0.050)", transform: [{ rotate: "-4deg" }], shadowColor: "#6EF0B0", shadowOpacity: 0.05, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  heroCausticTrace: { position: "absolute", width: 176, height: 1, right: 34, top: 202, borderRadius: 99, backgroundColor: "rgba(232,255,243,0.08)", transform: [{ rotate: "-4deg" }], shadowColor: "#DFFFF0", shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } },
  brand: { color: "#6EF0B0", fontSize: 13, fontWeight: "900", letterSpacing: 4 },
  title: {
    color: "#FFF8E8",
    fontSize: 46,
    lineHeight: 50,
    fontWeight: "900",
    marginTop: 18,
  },
  subtitle: {
    color: "#B7C8C0",
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    marginTop: 16,
  },
  contractRow: {
    marginTop: 24,
    borderRadius: 21,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.050)",
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#8A6B55" },
  dotOnline: { backgroundColor: "#6EF0B0" },
  contractCopy: { flex: 1 },
  contractKicker: {
    color: "#E8BC68",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  contractText: {
    color: "#E9EEE9",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    marginTop: 6,
  },
  presenceCard: { position: "relative", overflow: "hidden", borderRadius: 30, padding: 25, backgroundColor: "rgba(231,255,243,0.89)", borderWidth: 1, borderColor: "rgba(110,240,176,0.08)" },
  lightSurfaceVeil: { position: "absolute", width: 270, height: 110, right: -82, top: 52, borderTopLeftRadius: 122, borderTopRightRadius: 38, borderBottomRightRadius: 108, borderBottomLeftRadius: 30, backgroundColor: "rgba(23,123,89,0.050)", transform: [{ rotate: "-5deg" }], shadowColor: "#6EF0B0", shadowOpacity: 0.040, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  lightSurfaceCaustic: { position: "absolute", width: 146, height: 1, right: 28, top: 122, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.21)", transform: [{ rotate: "-5deg" }], shadowColor: "#FFFFFF", shadowOpacity: 0.11, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  sectionKicker: {
    color: "#157B59",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3.2,
  },
  cardTitle: {
    color: "#002218",
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    marginTop: 10,
  },
  body: {
    color: "#60736B",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    marginTop: 12,
  },
  primaryButton: {
    marginTop: 22,
    borderRadius: 21,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#6EF0B0",
  },
  primaryText: { color: "#001E15", fontSize: 18, fontWeight: "900" },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 21,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(110,240,176,0.34)",
    backgroundColor: "rgba(110,240,176,0.050)",
  },
  secondaryText: { color: "#A7F7CF", fontSize: 17, fontWeight: "900" },
  buttonPressed: { opacity: 0.76 },
  buttonDisabled: { opacity: 0.55 },
  errorCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: "#49231F",
    borderWidth: 1,
    borderColor: "#B25A4E",
  },
  errorTitle: { color: "#FFD7D2", fontSize: 25, fontWeight: "900" },
  errorText: {
    color: "#F4C2BC",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    fontWeight: "700",
  },
  retryButton: {
    marginTop: 18,
    borderRadius: 18,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8BC68",
  },
  retryText: { color: "#2B1600", fontSize: 17, fontWeight: "900" },
  waitCard: {
    borderRadius: 30,
    padding: 28,
    backgroundColor: "#08271E",
    borderWidth: 1,
    borderColor: "rgba(110,240,176,0.13)",
  },
  waitTitle: { color: "#FFF8E8", fontSize: 27, fontWeight: "900", marginTop: 16 },
  offerCard: { position: "relative", overflow: "hidden", borderRadius: 34, padding: 25, backgroundColor: "rgba(233,255,245,0.89)", borderWidth: 1, borderColor: "rgba(110,240,176,0.08)" },
  offerTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  flex: { flex: 1 },
  offerTitle: {
    color: "#002218",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    marginTop: 10,
  },
  offerMeta: {
    color: "#71847C",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#D7F4E6",
  },
  badgeText: {
    color: "#145B43",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  metrics: { flexDirection: "row", gap: 9, marginTop: 22 },
  metric: {
    flex: 1,
    borderRadius: 21,
    padding: 15,
    backgroundColor: "#CFF2E2",
    minHeight: 92,
  },
  metricValue: { color: "#002218", fontSize: 21, fontWeight: "900" },
  metricLabel: {
    color: "#617A70",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginTop: 8,
    textTransform: "uppercase",
  },
  whyCard: {
    borderRadius: 30,
    padding: 25,
    backgroundColor: "#0C2B22",
    borderWidth: 1,
    borderColor: "rgba(110,240,176,0.21)",
  },
  reasons: { marginTop: 18, gap: 13 },
  reasonRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  reasonNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6EF0B0",
  },
  reasonNumberText: { color: "#002218", fontWeight: "900" },
  reasonText: {
    color: "#D9E6E0",
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  decisionCard: {
    borderRadius: 30,
    padding: 25,
    backgroundColor: "#062B20",
    borderWidth: 1,
    borderColor: "rgba(232,188,104,0.32)",
  },
  decisionPreviewButton: { marginTop: 18, minHeight: 58, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(232,188,104,0.055)", borderWidth: 1, borderColor: "rgba(232,188,104,0.20)" },
  decisionPreviewButtonCopy: { flex: 1 },
  decisionPreviewKicker: { color: "#E8BC68", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.25 },
  decisionPreviewButtonText: { color: "#FFF8E8", fontSize: 12.5, lineHeight: 17, fontWeight: "900", marginTop: 4 },
  decisionPreviewArrow: { color: "#E8BC68", fontSize: 16, fontWeight: "900" },
  decisionPreviewPanel: { marginTop: 10, borderRadius: 18, padding: 14, backgroundColor: "rgba(255,255,255,0.025)", borderWidth: 1, borderColor: "rgba(255,255,255,0.055)", gap: 11 },
  decisionPreviewRow: { gap: 5 },
  decisionPreviewLabel: { color: "#E8BC68", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.15 },
  decisionPreviewText: { color: "rgba(255,248,232,0.70)", fontSize: 11.5, lineHeight: 17, fontWeight: "700" },
  decisionPreviewDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.055)" },
  decisionPreviewFootnote: { color: "rgba(255,248,232,0.40)", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
  acceptedCard: { position: "relative", overflow: "hidden", borderRadius: 30, padding: 25, backgroundColor: "rgba(221,251,234,0.89)", borderWidth: 1, borderColor: "rgba(110,240,176,0.08)" },
  acceptedKicker: {
    color: "#157B59",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
  },
  acceptedTitle: {
    color: "#002218",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 10,
  },
  acceptedText: {
    color: "#526A60",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 10,
  },
  footerMessage: {
    color: "#8FA99D",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  linkButton: { paddingVertical: 16, alignItems: "center" },
  linkText: { color: "#6EF0B0", fontSize: 18, fontWeight: "900" },
  footer: {
    color: "#567168",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
});
