import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Alert,
Pressable,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { router } from "expo-router";

const API_BASE_URL =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

function daApiV1(path: string) {
const base = API_BASE_URL.replace(/\/+$/, "");
const apiBase = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
const cleanPath = path.startsWith("/") ? path : `/${path}`;
return `${apiBase}${cleanPath}`;
}

// DA_ROUTE_ORACLE_GOOGLE_ROUTES_V1
type RoutePreviewApiPayload = {
ok?: boolean;
provider?: string;
distanceMeters?: number;
durationSeconds?: number;
etaMinutes?: number;
confidence?: number;
fallback?: boolean;
polyline?: string | null;
meta?: {
trafficAware?: boolean;
reason?: string;
computedAt?: string;
source?: string;
};
};

type RoutePreviewApiState = {
loading: boolean;
data: RoutePreviewApiPayload | null;
error: string | null;
updatedAt: string | null;
};

const ROUTE_PREVIEW_SAMPLE = {
origin: { lat: 50.83312, lng: 4.37142, label: "Coursier Ixelles" },
waypoints: [{ lat: 50.83397, lng: 4.36588, label: "Thieyp" }],
destination: { lat: 50.84673, lng: 4.35247, label: "Client Bruxelles" },
mode: "TWO_WHEELER",
orderId: "DA-ROUTE-ORACLE",
source: "courier-route-oracle",
};

function routeProviderLabel(provider?: string | null) {
if (provider === "google_routes") return "Google Routes";
if (provider === "fallback_haversine") return "Fallback Haversine";
if (provider === "fallback_google_unavailable") return "Fallback API";
if (provider === "fallback_invalid_input") return "Fallback coordonnées";
return "Route API";
}

function routeDistanceLabel(meters?: number) {
if (!Number.isFinite(Number(meters))) return "distance en cours";
const km = Number(meters) / 1000;
return km >= 1 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(Number(meters))} m`;
}



type Factor = {
label?: string;
score?: number;
weight?: number;
value?: number | string | null;
explanation?: string;
};

type Candidate = {
id?: string;
name?: string;
vehicle?: string;
score?: number;
confidence?: number;
pickupEtaMin?: number;
deliveryEtaMin?: number;
totalEtaMin?: number;
pickupDistanceKm?: number;
deliveryDistanceKm?: number;
activeMissions?: number;
completedToday?: number;
reliabilityScore?: number;
freshnessScore?: number;
fairnessScore?: number;
factors?: Factor[];
warnings?: string[];
};

type PreviewResponse = {
ok?: boolean;
service?: string;
version?: string;
mode?: string;
willMutate?: boolean;
autoAssignAllowed?: boolean;
order?: Record<string, any> | null;
orderId?: string | null;
orderStatus?: string | null;
eligibleForAssignment?: boolean;
recommendedCourier?: Candidate | null;
candidates?: Candidate[];
confidence?: number;
reason?: string;
warnings?: string[];
policy?: {
mutation?: string;
assignment?: string;
humanFallbackBelowConfidence?: number;
autoAssignThresholdFuture?: number;
};
};

type ProposalResponse = {
ok?: boolean;
service?: string;
version?: string;
mode?: string;
willMutate?: boolean;
autoAssignAllowed?: boolean;
orderId?: string | null;
orderStatus?: string | null;
eligibleForAssignment?: boolean;
courierId?: string | null;
courierName?: string | null;
proposalStatus?: string | null;
auditId?: string | null;
message?: string;
error?: string;
order?: Record<string, any> | null;
proposal?: Record<string, any> | null;
};

type ScreenState = {
loading: boolean;
refreshing: boolean;
error: string | null;
data: PreviewResponse | null;
updatedAt: Date | null;
};

function numberLabel(value: unknown, suffix = "") {
if (typeof value === "number" && Number.isFinite(value)) {
return `${Math.round(value * 10) / 10}${suffix}`;
}
return `--${suffix}`;
}

function scoreLabel(value: unknown) {
if (typeof value === "number" && Number.isFinite(value)) {
return `${Math.round(value)}/100`;
}
return "--/100";
}

function confidenceTone(value?: number) {
if (typeof value !== "number") return "À confirmer";
if (value >= 90) return "Très forte";
if (value >= 70) return "Solide";
if (value >= 50) return "A valider";
return "Faible";
}

function statusLabel(status?: string | null) {
switch ((status || "").toLowerCase()) {
case "pending":
return "Reçue";
case "accepted":
return "Acceptée";
case "ready":
return "Prête";
case "picked_up":
return "En route";
case "delivered":
return "Livrée";
case "cancelled":
return "Annulée";
default:
return status || "Indisponible";
}
}

function vehicleLabel(vehicle?: string) {
switch ((vehicle || "").toLowerCase()) {
case "bike":
return "Vélo";
case "scooter":
return "Scooter";
case "car":
return "Voiture";
case "walk":
return "À pied";
default:
return vehicle || "Terrain";
}
}

export default function RouteOracleScreen() {
const [state, setState] = useState<ScreenState>({
loading: true,
refreshing: false,
error: null,
data: null,
updatedAt: null,
});

const [proposalState, setProposalState] = useState<{
loading: boolean;
error: string | null;
result: ProposalResponse | null;
}>({
loading: false,
error: null,
result: null,
});

const [acceptState, setAcceptState] = useState<{
loading: boolean;
error: string | null;
result: ProposalResponse | null;
}>({
loading: false,
error: null,
result: null,
});


const [routePreviewState, setRoutePreviewState] = useState<RoutePreviewApiState>({
loading: false,
data: null,
error: null,
updatedAt: null,
});

const loadRoutePreview = useCallback(async () => {
setRoutePreviewState((current) => ({
...current,
loading: true,
error: null,
}));

try {
const response = await fetch(daApiV1("/routes/preview"), {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(ROUTE_PREVIEW_SAMPLE),
});

const text = await response.text();
const json = text ? JSON.parse(text) : null;

if (!response.ok || !json) {
throw new Error("Route API indisponible");
}

setRoutePreviewState({
loading: false,
data: json,
error: null,
updatedAt: new Date().toISOString(),
});
} catch (error) {
setRoutePreviewState((current) => ({
loading: false,
data: current.data,
error: error instanceof Error ? error.message : "Route API indisponible",
updatedAt: new Date().toISOString(),
}));
}
}, []);

useEffect(() => {
void loadRoutePreview();
}, [loadRoutePreview]);

const loadPreview = useCallback(async (refreshing = false) => {
setProposalState((current) => ({ ...current, error: null }));
setAcceptState((current) => ({ ...current, error: null }));
setState((current) => ({
...current,
loading: !refreshing,
refreshing,
error: null,
}));

try {
const response = await fetch(daApiV1("/dispatch/assignment/preview"), {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
allowDeliveredPreview: true,
}),
});

const text = await response.text();
let json: PreviewResponse | null = null;

try {
json = text ? JSON.parse(text) : null;
} catch {
throw new Error("Réponse Route Oracle illisible.");
}

if (!response.ok || !json?.ok) {
throw new Error(`Route Oracle indisponible (${response.status}).`);
}

setState({
loading: false,
refreshing: false,
error: null,
data: json,
updatedAt: new Date(),
});
} catch (error) {
setState((current) => ({
...current,
loading: false,
refreshing: false,
error: error instanceof Error ? error.message : "Erreur Route Oracle.",
}));
}
}, []);

useEffect(() => {
loadPreview(false);
}, [loadPreview]);

const candidate = state.data?.recommendedCourier || null;
const factors = useMemo(() => candidate?.factors || [], [candidate]);
const warnings = useMemo(() => {
const apiWarnings = state.data?.warnings || [];
const candidateWarnings = candidate?.warnings || [];
return [...apiWarnings, ...candidateWarnings]
.filter(Boolean)
.filter((warning) => {
const text = String(warning).toLowerCase();
return !text.includes("v1a") && !text.includes("read-only") && !text.includes("assignation persistée");
});
}, [state.data, candidate]);

const updatedLabel = state.updatedAt
? state.updatedAt.toLocaleTimeString("fr-BE", {
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
})
: "--:--";

const existingProposal = (state.data?.order as any)?.assignmentProposal || null;
const latestProposal =
acceptState.result?.proposal ||
proposalState.result?.proposal ||
existingProposal;

const proposalStatus = String(
acceptState.result?.proposalStatus ||
latestProposal?.status ||
proposalState.result?.proposalStatus ||
"",
).toLowerCase();

const proposalAccepted = proposalStatus === "accepted";
const proposalPending = proposalStatus === "proposed";
const proposalSent =
proposalState.result?.ok === true ||
proposalPending ||
proposalAccepted ||
proposalState.result?.proposalStatus === "proposed";

const proposalAuditId =
acceptState.result?.auditId ||
latestProposal?.acceptAuditId ||
proposalState.result?.auditId ||
latestProposal?.auditId ||
null;

const proposalCourierId =
acceptState.result?.courierId ||
latestProposal?.courierId ||
candidate?.id ||
null;

const proposalCourierName =
acceptState.result?.courierName ||
proposalState.result?.courierName ||
latestProposal?.courierName ||
candidate?.name ||
"coursier recommandé";

const canPropose =
Boolean(state.data?.eligibleForAssignment) &&
Boolean(state.data?.orderId) &&
Boolean(candidate?.id) &&
!proposalState.loading &&
!acceptState.loading &&
!proposalSent;

const canAcceptProposal =
Boolean(state.data?.eligibleForAssignment) &&
Boolean(state.data?.orderId) &&
Boolean(proposalCourierId) &&
proposalPending &&
!proposalAccepted &&
!proposalState.loading &&
!acceptState.loading;

const submitProposal = useCallback(async () => {
if (!state.data?.orderId || !candidate?.id) {
setProposalState((current) => ({
...current,
error: "Commande ou coursier indisponible pour la proposition.",
}));
return;
}

if (!state.data?.eligibleForAssignment) {
setProposalState((current) => ({
...current,
error: "Commande non assignable pour le moment.",
}));
return;
}

setProposalState({
loading: true,
error: null,
result: null,
});

try {
const response = await fetch(daApiV1("/dispatch/assignment/propose"), {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
orderId: state.data.orderId,
courierId: candidate.id,
confirmed: true,
source: "courier-route-oracle",
decisionMode: "human_confirmed",
previewVersion: state.data.version || "v1a_readonly",
score: candidate.score,
confidence: candidate.confidence,
totalEtaMin: candidate.totalEtaMin,
}),
});

const bodyText = await response.text();
let json: ProposalResponse | null = null;

try {
json = bodyText ? JSON.parse(bodyText) : null;
} catch {
throw new Error("Réponse proposition illisible.");
}

if (!response.ok || !json?.ok) {
throw new Error(json?.message || json?.error || `Proposition refusée (${response.status}).`);
}

setProposalState({
loading: false,
error: null,
result: json,
});

await loadPreview(true);
} catch (error) {
setProposalState({
loading: false,
error: error instanceof Error ? error.message : "Erreur proposition coursier.",
result: null,
});
}
}, [candidate, state.data, loadPreview]);

const confirmProposal = useCallback(() => {
if (!canPropose) return;

Alert.alert(
"Confirmer la proposition",
`Proposer ${candidate?.name || "ce coursier"} pour ${state.data?.orderId || "cette commande"} ?`,
[
{
text: "Annuler",
style: "cancel",
},
{
text: "Confirmer la proposition",
style: "default",
onPress: () => {
void submitProposal();
},
},
],
);
}, [canPropose, candidate?.name, state.data?.orderId, submitProposal]);

const submitAccept = useCallback(async () => {
if (!state.data?.orderId || !proposalCourierId) {
setAcceptState((current) => ({
...current,
error: "Commande ou coursier indisponible pour l’acceptation.",
}));
return;
}

if (!state.data?.eligibleForAssignment) {
setAcceptState((current) => ({
...current,
error: "Commande non assignable pour le moment.",
}));
return;
}

if (!proposalPending || proposalAccepted) {
setAcceptState((current) => ({
...current,
error: "Aucune proposition en attente à accepter.",
}));
return;
}

setAcceptState({
loading: true,
error: null,
result: null,
});

try {
const response = await fetch(daApiV1("/dispatch/assignment/accept"), {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
orderId: state.data.orderId,
courierId: proposalCourierId,
confirmed: true,
source: "courier-route-oracle",
decisionMode: "courier_confirmed",
}),
});

const bodyText = await response.text();
let json: ProposalResponse | null = null;

try {
json = bodyText ? JSON.parse(bodyText) : null;
} catch {
throw new Error("Réponse acceptation illisible.");
}

if (!response.ok || !json?.ok) {
throw new Error(json?.message || json?.error || `Acceptation refusée (${response.status}).`);
}

setAcceptState({
loading: false,
error: null,
result: json,
});

await loadPreview(true);
} catch (error) {
setAcceptState({
loading: false,
error: error instanceof Error ? error.message : "Erreur acceptation coursier.",
result: null,
});
}
}, [
loadPreview,
proposalAccepted,
proposalCourierId,
proposalPending,
state.data?.eligibleForAssignment,
state.data?.orderId,
]);

const confirmAccept = useCallback(() => {
if (!canAcceptProposal) return;

Alert.alert(
"Accepter la proposition",
`Confirmer la mission ${state.data?.orderId || "sélectionnée"} pour ${proposalCourierName} ?`,
[
{
text: "Annuler",
style: "cancel",
},
{
text: "Accepter la proposition",
style: "default",
onPress: () => {
void submitAccept();
},
},
],
);
}, [canAcceptProposal, proposalCourierName, state.data?.orderId, submitAccept]);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.content}
refreshControl={
<RefreshControl
refreshing={state.refreshing}
onRefresh={() => loadPreview(true)}
/>
}
>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA® · COURIER</Text>
<Text style={styles.title}>Route Oracle</Text>
<Text style={styles.subtitle}>
Route Oracle analyse les missions, l’ETA, la charge et la fiabilité terrain pour recommander le meilleur coursier avec validation humaine.
</Text>

<View style={styles.heroBadges}>
<View style={styles.badgeGold}>
<Text style={styles.badgeGoldText}>Recommandation IA</Text>
</View>
<View style={styles.badgeDark}>
<Text style={styles.badgeDarkText}>Validation humaine</Text>
</View>
</View>
</View>

<View style={styles.guardCard}>
<Text style={styles.guardTitle}>Contrat sécurité</Text>
<Text style={styles.guardText}>
Aucun départ automatique · validation coursier obligatoire
</Text>
<Text style={styles.guardText}>
Validation manuelle obligatoire. Le coursier garde le contrôle de chaque étape depuis son cockpit.
</Text>
</View>

{state.loading ? (
<View style={styles.loadingCard}>
<ActivityIndicator />
<Text style={styles.loadingText}>Analyse Route Oracle…</Text>
</View>
) : null}

{state.error ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Route Oracle indisponible</Text>
<Text style={styles.errorText}>{state.error}</Text>
<Pressable style={styles.primaryButton} onPress={() => loadPreview(false)}>
<Text style={styles.primaryButtonText}>Réessayer</Text>
</Pressable>
</View>
) : null}

{!state.loading && !state.error && candidate ? (
<>
<View style={styles.scoreCard}>
<View style={styles.scoreTop}>
<View>
<Text style={styles.sectionLabel}>Coursier recommandé</Text>
<Text style={styles.courierName}>{candidate.name || "Coursier DelishAfrica®"}</Text>
<Text style={styles.courierMeta}>
{candidate.id || "courier"} · {vehicleLabel(candidate.vehicle)}
</Text>

<View
style={{
marginTop: 12,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(125, 249, 255, 0.22)",
backgroundColor: "rgba(6, 18, 24, 0.72)",
padding: 14,
}}
>
<Text
style={{
color: "#7DF9FF",
fontSize: 11,
fontWeight: "800",
letterSpacing: 0.8,
textTransform: "uppercase",
}}
>
Route terrain API
</Text>
<Text
style={{
color: "#F8FAFC",
fontSize: 15,
fontWeight: "900",
marginTop: 6,
}}
>
{routePreviewState.loading
? "Synchronisation ETA terrain…"
: routePreviewState.error && !routePreviewState.data
? "Fallback local actif"
: `${routePreviewState.data?.etaMinutes || "—"} min · ${routeDistanceLabel(routePreviewState.data?.distanceMeters)}`}
</Text>
<Text
style={{
color: "rgba(226, 232, 240, 0.76)",
fontSize: 12,
lineHeight: 17,
marginTop: 6,
}}
>
{routePreviewState.data
? `${routeProviderLabel(routePreviewState.data.provider)} · ${routePreviewState.data.fallback ? "mode sécurisé sans clé Google" : "trafic Google actif"} · confiance ${Math.round(Number(routePreviewState.data.confidence || 0) * 100)}%`
: routePreviewState.error || "Connexion au cerveau terrain…"}
</Text>
</View>
</View>

<View style={styles.scoreBubble}>
<Text style={styles.scoreValue}>{Math.round(candidate.score || 0)}</Text>
<Text style={styles.scoreUnit}>/100</Text>
</View>
</View>

<View style={styles.metricsGrid}>
<View style={styles.scoreMetricBox}>
<Text style={styles.metricValue}>{scoreLabel(candidate.confidence)}</Text>
<Text style={styles.metricLabel}>Confiance</Text>
<Text style={styles.metricHint}>{confidenceTone(candidate.confidence)}</Text>
</View>

<View style={styles.scoreMetricBox}>
<Text style={styles.metricValue}>{numberLabel(candidate.totalEtaMin, " min")}</Text>
<Text style={styles.metricLabel}>ETA totale</Text>
<Text style={styles.metricHint}>Retrait + livraison</Text>
</View>

<View style={styles.scoreMetricBox}>
<Text style={styles.metricValue}>{numberLabel(candidate.pickupEtaMin, " min")}</Text>
<Text style={styles.metricLabel}>Vers restaurant</Text>
<Text style={styles.metricHint}>{numberLabel(candidate.pickupDistanceKm, " km")}</Text>
</View>

<View style={styles.scoreMetricBox}>
<Text style={styles.metricValue}>{numberLabel(candidate.deliveryEtaMin, " min")}</Text>
<Text style={styles.metricLabel}>Vers client</Text>
<Text style={styles.metricHint}>{numberLabel(candidate.deliveryDistanceKm, " km")}</Text>
</View>
</View>
</View>

<View style={proposalSent ? styles.proposalCardSuccess : styles.proposalCard}>
<Text style={styles.proposalTitle}>
{proposalAccepted
? "Proposition acceptée"
: proposalPending
? "Proposition reçue"
: "Proposer au coursier"}
</Text>
<Text style={styles.proposalText}>
{proposalAccepted
? `Mission confirmée par ${proposalCourierName}. La commande reste prête, sans passage automatique en livraison.`
: proposalPending
? `Proposition reçue pour ${proposalCourierName}. Le coursier doit confirmer avant toute mission terrain.`
: "Aucune assignation automatique. Une confirmation humaine sera demandée avant l’envoi."}
</Text>
{proposalAuditId ? (
<Text style={styles.proposalAudit}>Audit: {proposalAuditId}</Text>
) : null}
{proposalState.error ? (
<Text style={styles.proposalError}>{proposalState.error}</Text>
) : null}
{acceptState.error ? (
<Text style={styles.proposalError}>{acceptState.error}</Text>
) : null}

{proposalPending && !proposalAccepted ? (
<Pressable
style={[
styles.acceptButton,
(!canAcceptProposal || acceptState.loading) && styles.proposeButtonDisabled,
]}
disabled={!canAcceptProposal || acceptState.loading}
onPress={confirmAccept}
>
<Text style={styles.acceptButtonText}>
{acceptState.loading ? "Acceptation en cours…" : "Accepter la proposition"}
</Text>
</Pressable>
) : null}

{!proposalPending && !proposalAccepted ? (
<Pressable
style={[
styles.proposeButton,
(!canPropose || proposalState.loading) && styles.proposeButtonDisabled,
]}
disabled={!canPropose || proposalState.loading}
onPress={confirmProposal}
>
<Text style={styles.proposeButtonText}>
{proposalState.loading ? "Envoi de la proposition…" : "Proposer au coursier"}
</Text>
</Pressable>
) : null}

{proposalAccepted ? (
<View style={styles.acceptedBadge}>
<Text style={styles.acceptedBadgeText}>Mission confirmée · statut commande conservé prêt</Text>
</View>
) : null}
</View>

<View style={styles.card}>
<Text style={styles.sectionLabel}>Mission analysée</Text>
<View style={styles.rowBetween}>
<Text style={styles.orderId}>{state.data?.orderId || "Commande disponible"}</Text>
<Text style={styles.statusPill}>{statusLabel(state.data?.orderStatus)}</Text>
</View>
<Text style={styles.bodyText}>
{state.data?.reason || "Recommandation calculée par Route Oracle."}
</Text>
<Text style={styles.miniText}>
Oracle livraison · MAJ {updatedLabel}
</Text>
</View>

<View style={styles.card}>
<Text style={styles.sectionLabel}>Facteurs de décision</Text>
{factors.map((factor, index) => (
<View key={`${factor.label || "factor"}-${index}`} style={styles.factorRow}>
<View style={styles.factorHeader}>
<Text style={styles.factorLabel}>{factor.label || "Facteur"}</Text>
<Text style={styles.factorScore}>{scoreLabel(factor.score)}</Text>
</View>
<View style={styles.progressTrack}>
<View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, factor.score || 0))}%` }]} />
</View>
<Text style={styles.factorExplanation}>
{factor.explanation || `Poids ${factor.weight || "--"} · valeur ${factor.value ?? "--"}`}
</Text>
</View>
))}
</View>

<View style={styles.card}>
<Text style={styles.sectionLabel}>Charge & fiabilité</Text>
<View style={styles.oracleStatsGrid}>
<View style={styles.oracleStatCard}>
<Text style={[styles.metricValue, styles.metricValueOracleDark]}>{candidate.activeMissions ?? "--"}</Text>
<Text style={[styles.metricLabel, styles.metricLabelOracleDark]}>Mission active</Text>
</View>

<View style={styles.oracleStatCard}>
<Text style={[styles.metricValue, styles.metricValueOracleDark]}>{candidate.completedToday ?? "--"}</Text>
<Text style={[styles.metricLabel, styles.metricLabelOracleDark]}>Livrées aujourd’hui</Text>
</View>

<View style={styles.oracleStatCard}>
<Text style={[styles.metricValue, styles.metricValueOracleDark]}>{scoreLabel(candidate.reliabilityScore)}</Text>
<Text style={[styles.metricLabel, styles.metricLabelOracleDark]}>Fiabilité</Text>
</View>

<View style={styles.oracleStatCard}>
<Text style={[styles.metricValue, styles.metricValueOracleDark]}>{scoreLabel(candidate.freshnessScore)}</Text>
<Text style={[styles.metricLabel, styles.metricLabelOracleDark]}>Position</Text>
</View>
</View>
</View>

{warnings.length ? (
<View style={styles.warningCard}>
<Text style={styles.warningTitle}>Garde-fous actifs</Text>
{warnings.slice(0, 5).map((warning, index) => (
<Text key={`${warning}-${index}`} style={styles.warningText}>• {warning}</Text>
))}
</View>
) : null}

<View style={styles.actions}>
<Pressable style={styles.primaryButton} onPress={() => loadPreview(false)}>
<Text style={styles.primaryButtonText}>Rafraîchir l’oracle</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/courier-eta")}>
<Text style={styles.secondaryButtonText}>Voir ETA mission</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/orders")}>
<Text style={styles.secondaryButtonText}>Voir les missions</Text>
</Pressable>
</View>
</>
) : null}

{!state.loading && !state.error && !candidate ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Aucun candidat disponible</Text>
<Text style={styles.errorText}>
Route Oracle n’a reçu aucun coursier candidat. La mission reste en validation humaine.
</Text>
</View>
) : null}
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(200, 255, 232, 0.052)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 255, 238, 0.042)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(220, 255, 240, 0.052)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(212, 255, 236, 0.014)", borderWidth: 1, borderColor: "rgba(224, 255, 241, 0.040)" },
safe: {
flex: 1,
backgroundColor: "#080F0C",
},
content: {
paddingHorizontal: 18,
paddingTop: 0,
paddingBottom: 38,
},
hero: {
borderRadius: 30,
padding: 22,
backgroundColor: "#102018",
borderWidth: 1,
borderColor: "rgba(212, 176, 92, 0.35)",
marginBottom: 14,
},
kicker: {
color: "#D9B86F",
fontSize: 12,
fontWeight: "800",
letterSpacing: 1.2,
textTransform: "uppercase",
},
title: {
color: "#FFFFFF",
fontSize: 34,
fontWeight: "900",
marginTop: 10,
},
subtitle: {
color: "rgba(255,255,255,0.78)",
fontSize: 15,
lineHeight: 22,
marginTop: 10,
},
heroBadges: {
flexDirection: "row",
gap: 10,
marginTop: 18,
flexWrap: "wrap",
},
badgeGold: {
borderRadius: 999,
paddingHorizontal: 13,
paddingVertical: 8,
backgroundColor: "#D9B86F",
},
badgeGoldText: {
color: "#11130F",
fontWeight: "900",
fontSize: 12,
},
badgeDark: {
borderRadius: 999,
paddingHorizontal: 13,
paddingVertical: 8,
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.14)",
},
badgeDarkText: {
color: "#FFFFFF",
fontWeight: "800",
fontSize: 12,
},
guardCard: {
borderRadius: 22,
padding: 16,
backgroundColor: "rgba(41, 73, 53, 0.52)",
borderWidth: 1,
borderColor: "rgba(125, 211, 160, 0.28)",
marginBottom: 14,
},
guardTitle: {
color: "#B9F6CA",
fontSize: 14,
fontWeight: "900",
marginBottom: 5,
},
guardText: {
color: "rgba(255,255,255,0.76)",
fontSize: 13,
lineHeight: 18,
},
loadingCard: {
borderRadius: 24,
padding: 22,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.1)",
},
loadingText: {
color: "#FFFFFF",
marginTop: 12,
fontWeight: "700",
},
errorCard: {
borderRadius: 24,
padding: 18,
backgroundColor: "rgba(131, 45, 45, 0.4)",
borderWidth: 1,
borderColor: "rgba(255, 138, 128, 0.35)",
},
errorTitle: {
color: "#FFD7D7",
fontSize: 18,
fontWeight: "900",
},
errorText: {
color: "rgba(255,255,255,0.82)",
marginTop: 8,
lineHeight: 20,
},
scoreCard: {
borderRadius: 28,
padding: 18,
backgroundColor: "#F4ECD8",
marginBottom: 14,
},
scoreTop: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 14,
},
sectionLabel: {
color: "#D9B86F",
fontSize: 12,
fontWeight: "900",
letterSpacing: 0.8,
textTransform: "uppercase",
marginBottom: 8,
},
courierName: {
color: "#11130F",
fontSize: 23,
fontWeight: "900",
},
courierMeta: {
color: "rgba(17,19,15,0.65)",
fontSize: 13,
marginTop: 5,
fontWeight: "700",
},
scoreBubble: {
width: 86,
height: 86,
borderRadius: 43,
backgroundColor: "#11130F",
alignItems: "center",
justifyContent: "center",
},
scoreValue: {
color: "#D9B86F",
fontSize: 31,
fontWeight: "900",
},
scoreUnit: {
color: "rgba(255,255,255,0.72)",
fontWeight: "800",
marginTop: -4,
},
metricsGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginTop: 16,
},
metricBox: {
flexGrow: 1,
flexBasis: "46%",
borderRadius: 18,
padding: 13,
backgroundColor: "rgba(244, 236, 216, 0.10)",
},
metricValue: {
color: "#11130F",
fontSize: 20,
fontWeight: "900",
},
metricLabel: {
color: "rgba(17,19,15,0.62)",
fontSize: 12,
fontWeight: "800",
marginTop: 3,
},
metricHint: {
color: "rgba(17,19,15,0.48)",
fontSize: 11,
marginTop: 3,
fontWeight: "700",
},
card: {
borderRadius: 24,
padding: 17,
backgroundColor: "rgba(255,255,255,0.07)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.1)",
marginBottom: 14,
},
rowBetween: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
},
orderId: {
color: "#FFFFFF",
fontSize: 20,
fontWeight: "900",
},
statusPill: {
overflow: "hidden",
borderRadius: 999,
paddingHorizontal: 11,
paddingVertical: 7,
color: "#11130F",
backgroundColor: "#D9B86F",
fontWeight: "900",
fontSize: 12,
},
bodyText: {
color: "rgba(255,255,255,0.82)",
marginTop: 12,
lineHeight: 21,
fontSize: 14,
},
miniText: {
color: "rgba(255,255,255,0.48)",
marginTop: 12,
fontSize: 12,
fontWeight: "700",
},
factorRow: {
marginTop: 13,
},
factorHeader: {
flexDirection: "row",
justifyContent: "space-between",
gap: 10,
},
factorLabel: {
color: "#FFFFFF",
fontWeight: "800",
flex: 1,
},
factorScore: {
color: "#D9B86F",
fontWeight: "900",
},
progressTrack: {
height: 8,
borderRadius: 99,
backgroundColor: "rgba(255,255,255,0.1)",
overflow: "hidden",
marginTop: 8,
},
progressFill: {
height: 8,
borderRadius: 99,
backgroundColor: "#D9B86F",
},
factorExplanation: {
color: "rgba(255,255,255,0.62)",
marginTop: 7,
fontSize: 12,
lineHeight: 17,
},
warningCard: {
borderRadius: 24,
padding: 17,
backgroundColor: "rgba(217, 184, 111, 0.13)",
borderWidth: 1,
borderColor: "rgba(217, 184, 111, 0.35)",
marginBottom: 14,
},
warningTitle: {
color: "#F9E6B0",
fontSize: 15,
fontWeight: "900",
marginBottom: 8,
},
warningText: {
color: "rgba(255,255,255,0.78)",
lineHeight: 20,
fontSize: 13,
},
proposalCard: {
borderRadius: 24,
padding: 17,
backgroundColor: "rgba(217, 184, 111, 0.12)",
borderWidth: 1,
borderColor: "rgba(217, 184, 111, 0.34)",
marginBottom: 14,
},
proposalCardSuccess: {
borderRadius: 24,
padding: 17,
backgroundColor: "rgba(42, 105, 66, 0.36)",
borderWidth: 1,
borderColor: "rgba(125, 211, 160, 0.36)",
marginBottom: 14,
},
proposalTitle: {
color: "#F9E6B0",
fontSize: 17,
fontWeight: "900",
marginBottom: 7,
},
proposalText: {
color: "rgba(255,255,255,0.82)",
fontSize: 13,
lineHeight: 19,
},
proposalAudit: {
color: "rgba(255,255,255,0.58)",
fontSize: 11,
fontWeight: "800",
marginTop: 8,
},
proposalError: {
color: "#FFD7D7",
fontSize: 12,
fontWeight: "800",
marginTop: 8,
},
proposeButton: {
borderRadius: 18,
paddingVertical: 14,
paddingHorizontal: 16,
backgroundColor: "#D9B86F",
alignItems: "center",
marginTop: 13,
},
proposeButtonDisabled: {
opacity: 0.58,
},
proposeButtonText: {
color: "#11130F",
fontWeight: "900",
fontSize: 14,
},
acceptButton: {
borderRadius: 18,
paddingVertical: 14,
paddingHorizontal: 16,
backgroundColor: "#B9F6CA",
alignItems: "center",
marginTop: 13,
},
acceptButtonText: {
color: "#062A1A",
fontWeight: "900",
fontSize: 14,
},
acceptedBadge: {
borderRadius: 18,
paddingVertical: 12,
paddingHorizontal: 14,
backgroundColor: "rgba(185, 246, 202, 0.14)",
borderWidth: 1,
borderColor: "rgba(185, 246, 202, 0.34)",
marginTop: 13,
},
acceptedBadgeText: {
color: "#B9F6CA",
fontWeight: "900",
fontSize: 12,
textAlign: "center",
},
actions: {
gap: 10,
marginTop: 2,
},
primaryButton: {
borderRadius: 18,
paddingVertical: 15,
paddingHorizontal: 16,
backgroundColor: "#D9B86F",
alignItems: "center",
},
primaryButtonText: {
color: "#11130F",
fontWeight: "900",
fontSize: 15,
},
secondaryButton: {
borderRadius: 18,
paddingVertical: 14,
paddingHorizontal: 16,
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
alignItems: "center",
},
secondaryButtonText: {
color: "#FFFFFF",
fontWeight: "800",
fontSize: 15,
},

metricValueOracleDark: {
color: "#FFFFFF",
fontSize: 24,
fontWeight: "900",
letterSpacing: 0.2,
},
metricLabelOracleDark: {
color: "rgba(255,255,255,0.82)",
fontSize: 13,
fontWeight: "900",
marginTop: 4,
},
metricHintOracleDark: {
color: "rgba(255,255,255,0.68)",
fontSize: 12,
fontWeight: "700",
marginTop: 4,
},

scoreMetricBox: {
width: "47%",
minHeight: 104,
borderRadius: 22,
paddingVertical: 16,
paddingHorizontal: 15,
backgroundColor: "rgba(255,255,255,0.13)",
borderWidth: 1,
borderColor: "rgba(217, 184, 111, 0.34)",
justifyContent: "center",
},

oracleStatsGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 12,
marginTop: 12,
},
oracleStatCard: {
width: "47%",
minHeight: 104,
borderRadius: 22,
paddingVertical: 16,
paddingHorizontal: 15,
backgroundColor: "rgba(255,255,255,0.13)",
borderWidth: 1,
borderColor: "rgba(217, 184, 111, 0.34)",
justifyContent: "center",
},
});
