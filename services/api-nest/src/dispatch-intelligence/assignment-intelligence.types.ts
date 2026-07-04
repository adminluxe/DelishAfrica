export type DispatchOrderStatus =
| 'pending'
| 'accepted'
| 'ready'
| 'picked_up'
| 'delivered'
| 'cancelled'
| string;

export type GeoPoint = {
lat: number;
lng: number;
label?: string;
};



export type AssignmentProposeInput = {
orderId?: string;
publicId?: string;
id?: string;
courierId?: string;
confirmed?: boolean;
source?: string;
decisionMode?: 'human_confirmed' | string;
previewVersion?: string;
score?: number;
confidence?: number;
totalEtaMin?: number;
};

export type AssignmentProposalAudit = {
auditId: string;
status: 'proposed';
courierId: string;
courierName: string;
proposedAt: string;
source: string;
decisionMode: string;
previewVersion: string;
score?: number;
confidence?: number;
totalEtaMin?: number;
};

export type AssignmentProposeResult = {
ok: boolean;
service: 'dispatch_intelligence';
version: 'v2_propose';
mode: 'human_confirmed_proposal';
willMutate: boolean;
autoAssignAllowed: false;
orderId: string | null;
orderStatus: DispatchOrderStatus | null;
eligibleForAssignment: boolean;
courierId: string | null;
courierName: string | null;
proposalStatus: 'proposed' | 'rejected';
auditId: string | null;
message: string;
error?: string;
order?: Record<string, any> | null;
proposal?: AssignmentProposalAudit | null;
};

export type CourierCandidateInput = {
id?: string;
name?: string;
vehicle?: string;
position?: GeoPoint;
lat?: number;
lng?: number;
activeMissions?: number;
completedToday?: number;
reliabilityScore?: number;
acceptanceRate?: number;
lastSeenSec?: number;
};


export type AssignmentAcceptInput = {
orderId?: string;
id?: string;
courierId?: string;
confirmed?: boolean;
source?: string;
decisionMode?: 'courier_confirmed' | 'human_confirmed' | string;
};

export type AssignmentAcceptResult = {
ok: boolean;
service: 'dispatch_intelligence';
version: 'v2_accept';
mode: 'courier_confirmed_acceptance';
willMutate: boolean;
autoAssignAllowed: false;
orderId: string | null;
orderStatus: string | null;
eligibleForAssignment: boolean;
courierId: string | null;
courierName: string | null;
proposalStatus: 'accepted' | 'rejected';
auditId: string | null;
message?: string;
error?: string;
order?: Record<string, any> | null;
proposal?: Record<string, any> | null;
};

export type AssignmentPreviewInput = {
orderId?: string;
publicId?: string;
id?: string;
order?: Record<string, any>;
couriers?: CourierCandidateInput[];
courierPosition?: GeoPoint;
restaurantPosition?: GeoPoint;
customerPosition?: GeoPoint;
allowDeliveredPreview?: boolean;
};

export type AssignmentFactorScore = {
label: string;
score: number;
weight: number;
value: number | string | null;
explanation: string;
};

export type AssignmentCandidate = {
id: string;
name: string;
vehicle: string;
score: number;
confidence: number;
pickupEtaMin: number;
deliveryEtaMin: number;
totalEtaMin: number;
pickupDistanceKm: number;
deliveryDistanceKm: number;
activeMissions: number;
completedToday: number;
reliabilityScore: number;
freshnessScore: number;
fairnessScore: number;
factors: AssignmentFactorScore[];
warnings: string[];
};

export type AssignmentPreviewResponse = {
ok: true;
service: 'dispatch_intelligence';
version: 'v1a_readonly';
mode: 'read_only_preview';
willMutate: false;
autoAssignAllowed: false;
order: Record<string, any> | null;
orderId: string | null;
orderStatus: DispatchOrderStatus | null;
eligibleForAssignment: boolean;
recommendedCourier: AssignmentCandidate | null;
candidates: AssignmentCandidate[];
confidence: number;
reason: string;
warnings: string[];
policy: {
mutation: 'disabled';
assignment: 'recommendation_only';
humanFallbackBelowConfidence: number;
autoAssignThresholdFuture: number;
};
};
