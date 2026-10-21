import { DA_OIDC_CONFIG } from '../auth/daOidcConfig';
import { daOrdersFetch } from './daOrdersApi';

export type CourierProfessionalStatus =
  | 'unavailable'
  | 'identity_verified'
  | 'profile_draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type CourierProfessionalTruth = {
  status: CourierProfessionalStatus;
  approved: boolean;
  checkedAt: string;
  reason: string;
};

const RAW_API = process.env.EXPO_PUBLIC_API_BASE_URL
  || process.env.EXPO_PUBLIC_API_URL
  || 'https://api.delishafrica.me/api/v1';
const API = RAW_API.replace(/\/$/, '').endsWith('/api/v1')
  ? RAW_API.replace(/\/$/, '')
  : RAW_API.replace(/\/$/, '') + '/api/v1';

export function unavailableCourierTruth(reason = 'statut_professionnel_indisponible'): CourierProfessionalTruth {
  return { status: 'unavailable', approved: false, reason, checkedAt: new Date().toISOString() };
}

// This result is informational UI state, never a substitute for a server-side guard.
export async function readCourierProfessionalTruth(subject: string): Promise<CourierProfessionalTruth> {
  const checkedAt = new Date().toISOString();
  if (!subject.trim()) return unavailableCourierTruth('oidc_subject_missing');
  try {
    const response = await daOrdersFetch(API + '/auth/courier/eligibility', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true || payload?.principal?.subject !== subject
      || payload?.principal?.issuer !== DA_OIDC_CONFIG.issuer) {
      return unavailableCourierTruth('server_status_unconfirmed');
    }
    const allowed: CourierProfessionalStatus[] = [
      'identity_verified', 'profile_draft', 'pending_review', 'approved', 'rejected', 'suspended',
    ];
    const status: CourierProfessionalStatus = allowed.includes(payload?.status)
      ? payload.status : 'unavailable';
    const expiresAt = Date.parse(String(payload?.approvalExpiresAt || ''));
    const approved = status === 'approved'
      && payload?.professionalApproved === true
      && payload?.permissions?.goOnline === true
      && payload?.permissions?.receiveMissions === true
      && Number.isFinite(expiresAt)
      && expiresAt > Date.now();
    return {
      status: approved ? 'approved' : status === 'approved' ? 'unavailable' : status,
      approved,
      checkedAt,
      reason: approved ? 'server_professional_approval_confirmed' : 'professional_approval_not_confirmed',
    };
  } catch {
    return unavailableCourierTruth('server_unreachable');
  }
}
