import { Injectable } from '@nestjs/common';
import { acceptDemoOrderCourier, listDemoOrders, proposeDemoOrderCourier } from '../orders/orders.demo.store';
import {
AssignmentCandidate,
AssignmentFactorScore,
AssignmentPreviewInput,
AssignmentPreviewResponse,
AssignmentAcceptInput,
AssignmentProposeInput,
AssignmentAcceptResult,
AssignmentProposeResult,
CourierCandidateInput,
DispatchOrderStatus,
GeoPoint,
} from './assignment-intelligence.types';

type AnyRecord = Record<string, any>;

const VERSION = 'v1a_readonly' as const;
const SERVICE = 'dispatch_intelligence' as const;

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'ready', 'picked_up']);
const ASSIGNABLE_STATUSES = new Set(['accepted', 'ready']);

const DEFAULT_RESTAURANT_POSITION: GeoPoint = {
lat: 50.83397,
lng: 4.36588,
label: 'Thieyp - Ixelles',
};

const DEFAULT_CUSTOMER_POSITION: GeoPoint = {
lat: 50.84673,
lng: 4.35247,
label: 'Bruxelles centre',
};

const DEFAULT_COURIERS: Required<CourierCandidateInput>[] = [
{
id: 'da-courier-ixelles-01',
name: 'Coursier Ixelles',
vehicle: 'bike',
position: { lat: 50.83312, lng: 4.37142, label: 'Ixelles' },
lat: 50.83312,
lng: 4.37142,
activeMissions: 0,
completedToday: 6,
reliabilityScore: 93,
acceptanceRate: 96,
lastSeenSec: 32,
},
{
id: 'da-courier-louise-02',
name: 'Coursier Louise',
vehicle: 'bike',
position: { lat: 50.82681, lng: 4.35621, label: 'Louise' },
lat: 50.82681,
lng: 4.35621,
activeMissions: 1,
completedToday: 8,
reliabilityScore: 88,
acceptanceRate: 91,
lastSeenSec: 74,
},
{
id: 'da-courier-eu-03',
name: 'Coursier Quartier Européen',
vehicle: 'bike',
position: { lat: 50.84454, lng: 4.38291, label: 'Quartier Européen' },
lat: 50.84454,
lng: 4.38291,
activeMissions: 0,
completedToday: 4,
reliabilityScore: 84,
acceptanceRate: 89,
lastSeenSec: 145,
},
];

function clamp(value: number, min = 0, max = 100): number {
if (!Number.isFinite(value)) return min;
return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0): number {
const factor = Math.pow(10, digits);
return Math.round(value * factor) / factor;
}

function toNumber(value: any): number | null {
const n = Number(value);
return Number.isFinite(n) ? n : null;
}

function normalizeStatus(value: any): string {
return String(value || '').trim().toLowerCase();
}

function normalizeId(value: any): string {
return String(value || '').trim();
}

function firstNonEmpty(...values: any[]): string {
for (const value of values) {
const s = normalizeId(value);
if (s) return s;
}
return '';
}

function deg2rad(value: number): number {
return (value * Math.PI) / 180;
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
const earthKm = 6371;
const dLat = deg2rad(b.lat - a.lat);
const dLng = deg2rad(b.lng - a.lng);
const lat1 = deg2rad(a.lat);
const lat2 = deg2rad(b.lat);

const x =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

return earthKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function etaMin(distanceKm: number, vehicle = 'bike'): number {
const speedKmH =
vehicle === 'walk' ? 5 :
vehicle === 'car' ? 22 :
vehicle === 'scooter' ? 20 :
15;

const moving = (distanceKm / speedKmH) * 60;
const operationalBuffer = vehicle === 'car' ? 5 : 3;
return Math.max(1, Math.round(moving + operationalBuffer));
}

function scoreFromEta(minutes: number, ideal: number, max: number): number {
if (minutes <= ideal) return 100;
if (minutes >= max) return 20;
return clamp(100 - ((minutes - ideal) / (max - ideal)) * 80);
}

function scoreFromLoad(activeMissions: number): number {
if (activeMissions <= 0) return 100;
if (activeMissions === 1) return 78;
if (activeMissions === 2) return 55;
return 25;
}

function scoreFromFreshness(lastSeenSec: number): number {
if (lastSeenSec <= 60) return 100;
if (lastSeenSec <= 180) return 82;
if (lastSeenSec <= 420) return 60;
return 35;
}

function scoreFromFairness(completedToday: number, activeMissions: number): number {
const completedPenalty = Math.min(35, completedToday * 3);
const activePenalty = Math.min(30, activeMissions * 15);
return clamp(100 - completedPenalty - activePenalty, 25, 100);
}

function weightedScore(factors: AssignmentFactorScore[]): number {
const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
if (!totalWeight) return 0;
const raw = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;
return Math.round(raw);
}

function extractGeo(value: any): GeoPoint | null {
if (!value || typeof value !== 'object') return null;

const lat =
toNumber(value.lat) ??
toNumber(value.latitude) ??
toNumber(value.coords?.lat) ??
toNumber(value.coords?.latitude);

const lng =
toNumber(value.lng) ??
toNumber(value.lon) ??
toNumber(value.longitude) ??
toNumber(value.coords?.lng) ??
toNumber(value.coords?.lon) ??
toNumber(value.coords?.longitude);

if (lat === null || lng === null) return null;
return { lat, lng, label: value.label || value.name || value.address || undefined };
}

function extractOrderGeo(order: AnyRecord | null, side: 'restaurant' | 'customer'): GeoPoint | null {
if (!order) return null;

const candidates =
side === 'restaurant'
? [
order.restaurantPosition,
order.partnerPosition,
order.merchantPosition,
order.restaurant?.position,
order.partner?.position,
order.merchant?.position,
]
: [
order.customerPosition,
order.deliveryPosition,
order.customer?.position,
order.customer?.coords,
order.delivery?.position,
order.delivery?.coords,
];

for (const candidate of candidates) {
const geo = extractGeo(candidate);
if (geo) return geo;
}

return null;
}

function normalizeCourier(input: CourierCandidateInput, idx: number): Required<CourierCandidateInput> {
const position = extractGeo(input.position) || extractGeo(input) || DEFAULT_COURIERS[idx % DEFAULT_COURIERS.length].position;
const fallback = DEFAULT_COURIERS[idx % DEFAULT_COURIERS.length];

return {
id: input.id || fallback.id,
name: input.name || fallback.name,
vehicle: input.vehicle || fallback.vehicle,
position,
lat: position.lat,
lng: position.lng,
activeMissions: Number.isFinite(Number(input.activeMissions)) ? Number(input.activeMissions) : fallback.activeMissions,
completedToday: Number.isFinite(Number(input.completedToday)) ? Number(input.completedToday) : fallback.completedToday,
reliabilityScore: Number.isFinite(Number(input.reliabilityScore)) ? Number(input.reliabilityScore) : fallback.reliabilityScore,
acceptanceRate: Number.isFinite(Number(input.acceptanceRate)) ? Number(input.acceptanceRate) : fallback.acceptanceRate,
lastSeenSec: Number.isFinite(Number(input.lastSeenSec)) ? Number(input.lastSeenSec) : fallback.lastSeenSec,
};
}

function publicOrderId(order: AnyRecord | null): string | null {
if (!order) return null;
return firstNonEmpty(order.publicId, order.orderId, order.id) || null;
}

@Injectable()
export class AssignmentIntelligenceService {


propose(input: AssignmentProposeInput = {}): AssignmentProposeResult {
const orderId = firstNonEmpty(input.orderId, input.publicId, input.id);

if (!orderId) {
return this.rejectProposal('missing_order_id', 'Commande absente.', null, null, false, null, null);
}

const courierId = normalizeId(input.courierId);
if (!courierId) {
return this.rejectProposal('missing_courier_id', 'Coursier absent.', orderId, null, false, null, null);
}

if (input.confirmed !== true) {
return this.rejectProposal('human_confirmation_required', 'Confirmation humaine obligatoire.', orderId, null, false, courierId, null);
}

const preview = this.preview({ orderId });
const orderStatus = preview.orderStatus;
const eligibleForAssignment = preview.eligibleForAssignment === true;

if (!preview.order) {
return this.rejectProposal('order_not_found', 'Commande introuvable.', orderId, orderStatus, eligibleForAssignment, courierId, null);
}

if (!eligibleForAssignment || !orderStatus || !ASSIGNABLE_STATUSES.has(normalizeStatus(orderStatus))) {
return this.rejectProposal('order_not_assignable', 'Commande non assignable.', orderId, orderStatus, eligibleForAssignment, courierId, null, preview.order);
}

const candidate = preview.candidates.find((item) => item.id === courierId) || null;
if (!candidate) {
return this.rejectProposal('courier_not_in_preview_candidates', 'Coursier absent des candidats du dernier preview.', orderId, orderStatus, eligibleForAssignment, courierId, null, preview.order);
}

const score = typeof input.score === 'number' ? input.score : candidate.score;
if (score < 70) {
return this.rejectProposal('score_below_threshold', 'Score coursier insuffisant pour proposition.', orderId, orderStatus, eligibleForAssignment, courierId, candidate.name, preview.order);
}

const order = proposeDemoOrderCourier({
orderId,
courierId: candidate.id,
courierName: candidate.name,
source: input.source || 'courier-route-oracle',
decisionMode: input.decisionMode || 'human_confirmed',
previewVersion: input.previewVersion || preview.version,
score,
confidence: typeof input.confidence === 'number' ? input.confidence : candidate.confidence,
totalEtaMin: typeof input.totalEtaMin === 'number' ? input.totalEtaMin : candidate.totalEtaMin,
confirmed: true,
});

const proposal = order?.assignmentProposal || null;

return {
ok: true,
service: SERVICE,
version: 'v2_propose',
mode: 'human_confirmed_proposal',
willMutate: true,
autoAssignAllowed: false,
orderId,
orderStatus,
eligibleForAssignment,
courierId: candidate.id,
courierName: candidate.name,
proposalStatus: 'proposed',
auditId: proposal?.auditId || null,
message: `Proposition envoyée à ${candidate.name}.`,
order: order || null,
proposal,
};
}


accept(input: AssignmentAcceptInput = {}): AssignmentAcceptResult {
const orderId = String(input.orderId || input.id || '').trim();
const courierId = String(input.courierId || '').trim();

if (!orderId) {
return this.rejectAccept('missing_order_id', 'Commande manquante.', null, null, false, courierId || null, null, null);
}

if (!courierId) {
return this.rejectAccept('missing_courier_id', 'Coursier manquant.', orderId, null, false, null, null, null);
}

if (input.confirmed !== true) {
return this.rejectAccept('courier_confirmation_required', 'Confirmation coursier obligatoire.', orderId, null, false, courierId, null, null);
}

const order = listDemoOrders().find((candidate: any) => {
const ids = [candidate?.id, candidate?.orderId, candidate?.publicId].filter(Boolean).map(String);
return ids.includes(orderId);
}) as any;

if (!order) {
return this.rejectAccept('order_not_found', 'Commande introuvable.', orderId, null, false, courierId, null, null);
}

const orderStatus = String(order.status || '').trim();
const eligibleForAssignment = orderStatus === 'ready';
const proposal = order.assignmentProposal || null;

if (!eligibleForAssignment) {
return this.rejectAccept('order_not_assignable', 'Commande non assignable.', orderId, orderStatus, false, courierId, null, order);
}

if (!proposal || proposal.status !== 'proposed') {
return this.rejectAccept('proposal_not_pending', 'Aucune proposition en attente pour cette commande.', orderId, orderStatus, true, courierId, null, order);
}

if (String(proposal.courierId || '') !== courierId) {
return this.rejectAccept('courier_mismatch', 'Le coursier ne correspond pas à la proposition.', orderId, orderStatus, true, courierId, proposal.courierName || null, order);
}

const updatedOrder = acceptDemoOrderCourier({
orderId,
courierId,
source: input.source || 'courier-proposal-card',
decisionMode: input.decisionMode || 'courier_confirmed',
});

const acceptedProposal = (updatedOrder as any)?.assignmentProposal || null;
const auditId = acceptedProposal?.acceptAuditId || null;

return {
ok: true,
service: 'dispatch_intelligence',
version: 'v2_accept',
mode: 'courier_confirmed_acceptance',
willMutate: true,
autoAssignAllowed: false,
orderId,
orderStatus: String((updatedOrder as any)?.status || orderStatus || ''),
eligibleForAssignment: true,
courierId,
courierName: acceptedProposal?.courierName || proposal.courierName || null,
proposalStatus: 'accepted',
auditId,
message: `Proposition acceptée par ${acceptedProposal?.courierName || proposal.courierName || courierId}.`,
order: updatedOrder as any,
proposal: acceptedProposal as any,
};
}

private rejectAccept(
error: string,
message: string,
orderId: string | null,
orderStatus: string | null,
eligibleForAssignment: boolean,
courierId: string | null,
courierName: string | null,
order: any | null,
): AssignmentAcceptResult {
return {
ok: false,
service: 'dispatch_intelligence',
version: 'v2_accept',
mode: 'courier_confirmed_acceptance',
willMutate: false,
autoAssignAllowed: false,
orderId,
orderStatus,
eligibleForAssignment,
courierId,
courierName,
proposalStatus: 'rejected',
auditId: null,
message,
error,
order: order || null,
proposal: order?.assignmentProposal || null,
};
}

private rejectProposal(
error: string,
message: string,
orderId: string | null,
orderStatus: DispatchOrderStatus | null,
eligibleForAssignment: boolean,
courierId: string | null,
courierName: string | null,
order: Record<string, any> | null = null,
): AssignmentProposeResult {
return {
ok: false,
service: SERVICE,
version: 'v2_propose',
mode: 'human_confirmed_proposal',
willMutate: false,
autoAssignAllowed: false,
orderId,
orderStatus,
eligibleForAssignment,
courierId,
courierName,
proposalStatus: 'rejected',
auditId: null,
message,
error,
order,
proposal: null,
};
}

preview(input: AssignmentPreviewInput = {}): AssignmentPreviewResponse {
const allOrders = listDemoOrders({});
const requestedId = firstNonEmpty(input.orderId, input.publicId, input.id, input.order?.id, input.order?.orderId, input.order?.publicId);

const directOrder = input.order && typeof input.order === 'object' ? input.order : null;
const matchedOrder =
directOrder ||
this.findRequestedOrder(allOrders, requestedId) ||
this.pickBestRuntimeOrder(allOrders, Boolean(input.allowDeliveredPreview));

const orderStatus = matchedOrder ? normalizeStatus(matchedOrder.status) : null;
const orderId = publicOrderId(matchedOrder);
const eligibleForAssignment = !!orderStatus && ASSIGNABLE_STATUSES.has(orderStatus);

const restaurantPosition =
extractGeo(input.restaurantPosition) ||
extractOrderGeo(matchedOrder, 'restaurant') ||
DEFAULT_RESTAURANT_POSITION;

const customerPosition =
extractGeo(input.customerPosition) ||
extractOrderGeo(matchedOrder, 'customer') ||
DEFAULT_CUSTOMER_POSITION;

const candidateInputs =
Array.isArray(input.couriers) && input.couriers.length
? input.couriers
: input.courierPosition
? [{ ...DEFAULT_COURIERS[0], position: input.courierPosition }]
: DEFAULT_COURIERS;

const warnings: string[] = [];

if (!matchedOrder) {
warnings.push('Aucune commande runtime exploitable pour la prévisualisation.');
}

if (matchedOrder && orderStatus && !ACTIVE_STATUSES.has(orderStatus)) {
warnings.push(`Commande ${orderId || ''} en statut ${orderStatus}: recommandation informative uniquement.`);
}

if (matchedOrder && orderStatus && ACTIVE_STATUSES.has(orderStatus) && !eligibleForAssignment) {
warnings.push(`Commande ${orderId || ''} active mais pas encore assignable automatiquement en V1A.`);
}

warnings.push('V1A est read-only: aucune assignation persistée, aucun statut modifié.');

const candidates = candidateInputs
.map((candidate, idx) => this.scoreCourier(normalizeCourier(candidate, idx), restaurantPosition, customerPosition, eligibleForAssignment, orderStatus))
.sort((a, b) => b.score - a.score);

const recommendedCourier = candidates[0] || null;
const confidence = recommendedCourier ? recommendedCourier.confidence : 0;

return {
ok: true,
service: SERVICE,
version: VERSION,
mode: 'read_only_preview',
willMutate: false,
autoAssignAllowed: false,
order: matchedOrder || null,
orderId,
orderStatus,
eligibleForAssignment,
recommendedCourier,
candidates,
confidence,
reason: this.reason(recommendedCourier, eligibleForAssignment, orderStatus),
warnings,
policy: {
mutation: 'disabled',
assignment: 'recommendation_only',
humanFallbackBelowConfidence: 70,
autoAssignThresholdFuture: 90,
},
};
}

private findRequestedOrder(orders: AnyRecord[], requestedId: string): AnyRecord | null {
if (!requestedId) return null;

return (
orders.find((order) => {
const id = publicOrderId(order);
return id === requestedId || String(order.id || '') === requestedId || String(order.orderId || '') === requestedId;
}) || null
);
}

private pickBestRuntimeOrder(orders: AnyRecord[], allowDeliveredPreview: boolean): AnyRecord | null {
const byPriority = ['ready', 'accepted', 'pending', 'picked_up'];

for (const status of byPriority) {
const found = orders.find((order) => normalizeStatus(order.status) === status);
if (found) return found;
}

if (allowDeliveredPreview) {
return orders[0] || null;
}

return orders[0] || null;
}

private scoreCourier(
courier: Required<CourierCandidateInput>,
restaurantPosition: GeoPoint,
customerPosition: GeoPoint,
eligibleForAssignment: boolean,
orderStatus: string | null,
): AssignmentCandidate {
const courierPosition = courier.position;
const pickupDistanceKm = haversineKm(courierPosition, restaurantPosition);
const deliveryDistanceKm = haversineKm(restaurantPosition, customerPosition);

const pickupEtaMin = etaMin(pickupDistanceKm, courier.vehicle);
const deliveryEtaMin = etaMin(deliveryDistanceKm, courier.vehicle);

const pickupEtaScore = scoreFromEta(pickupEtaMin, 7, 25);
const deliveryEtaScore = scoreFromEta(deliveryEtaMin, 12, 35);
const loadScore = scoreFromLoad(courier.activeMissions);
const reliabilityScore = clamp((courier.reliabilityScore * 0.7) + (courier.acceptanceRate * 0.3));
const freshnessScore = scoreFromFreshness(courier.lastSeenSec);
const fairnessScore = scoreFromFairness(courier.completedToday, courier.activeMissions);

const factors: AssignmentFactorScore[] = [
{
label: 'ETA vers restaurant',
score: pickupEtaScore,
weight: 35,
value: pickupEtaMin,
explanation: `${pickupEtaMin} min estimées avant récupération.`,
},
{
label: 'ETA restaurant vers client',
score: deliveryEtaScore,
weight: 25,
value: deliveryEtaMin,
explanation: `${deliveryEtaMin} min estimées entre restaurant et client.`,
},
{
label: 'Charge coursier',
score: loadScore,
weight: 20,
value: courier.activeMissions,
explanation: `${courier.activeMissions} mission(s) active(s).`,
},
{
label: 'Fiabilité terrain',
score: reliabilityScore,
weight: 10,
value: round(reliabilityScore),
explanation: `Fiabilité ${round(reliabilityScore)} / 100.`,
},
{
label: 'Fraîcheur position',
score: freshnessScore,
weight: 5,
value: `${courier.lastSeenSec}s`,
explanation: `Dernier signal il y a ${courier.lastSeenSec}s.`,
},
{
label: 'Équité charge',
score: fairnessScore,
weight: 5,
value: courier.completedToday,
explanation: `${courier.completedToday} livraison(s) déjà terminée(s) aujourd'hui.`,
},
];

const score = weightedScore(factors);
const dataConfidence = eligibleForAssignment ? 96 : orderStatus === 'delivered' || orderStatus === 'cancelled' ? 62 : 76;
const confidence = Math.round(clamp((score * 0.65) + (dataConfidence * 0.35)));

const warnings: string[] = [];
if (!eligibleForAssignment) warnings.push('Candidat informatif: statut commande non assignable en V1A.');
if (courier.lastSeenSec > 300) warnings.push('Position coursier à rafraîchir avant assignation réelle.');
if (courier.activeMissions >= 2) warnings.push('Charge élevée: éviter auto-assignation sans validation humaine.');

return {
id: courier.id,
name: courier.name,
vehicle: courier.vehicle,
score,
confidence,
pickupEtaMin,
deliveryEtaMin,
totalEtaMin: pickupEtaMin + deliveryEtaMin,
pickupDistanceKm: round(pickupDistanceKm, 2),
deliveryDistanceKm: round(deliveryDistanceKm, 2),
activeMissions: courier.activeMissions,
completedToday: courier.completedToday,
reliabilityScore: round(reliabilityScore),
freshnessScore: round(freshnessScore),
fairnessScore: round(fairnessScore),
factors,
warnings,
};
}

private reason(candidate: AssignmentCandidate | null, eligibleForAssignment: boolean, orderStatus: string | null): string {
if (!candidate) return 'Aucun coursier candidat disponible.';

const base = `${candidate.name} recommandé: score ${candidate.score}/100, ETA totale ${candidate.totalEtaMin} min, confiance ${candidate.confidence}/100.`;

if (!eligibleForAssignment) {
return `${base} Recommandation informative uniquement car le statut commande actuel est ${orderStatus || 'inconnu'}.`;
}

if (candidate.confidence >= 90) {
return `${base} Candidat fort pour une future assignation automatique.`;
}

if (candidate.confidence >= 70) {
return `${base} Candidat exploitable avec validation humaine recommandée.`;
}

return `${base} Confiance insuffisante pour automatiser.`;
}
}
