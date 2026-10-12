-- DelishAfrica native Client realm admission: CANDIDATE QA ONLY / NOT DEPLOYED.
-- Security architecture review, fresh independent backup and migration testing
-- are MANDATORY before ANY application to a persistent or production DB.
--
-- This ledger deliberately contains NO raw e-mail, phone, SMS token, password,
-- recovery URL or personally identifiable display name. It binds a separate
-- Client Keycloak issuer + sub to independently server-verified proof digests.
-- Approved status alone is insufficient: product APIs must validate signed
-- access JWT, role and issuer, recheck the authoritative DB, and enforce RBAC.
BEGIN;

CREATE TABLE public.da_native_client_admissions (
  admission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK (
    issuer ~ '^https://[a-zA-Z0-9.-]+/realms/[a-zA-Z0-9_-]+$'
  ),
  subject_id uuid NOT NULL,
  email_binding_hmac char(64) NOT NULL CHECK (email_binding_hmac ~ '^[0-9a-f]{64}$'),
  sms_recipient_hmac char(64) CHECK (
    sms_recipient_hmac IS NULL OR sms_recipient_hmac ~ '^[0-9a-f]{64}$'
  ),
  sms_provider_proof_hmac char(64) UNIQUE CHECK (
    sms_provider_proof_hmac IS NULL OR sms_provider_proof_hmac ~ '^[0-9a-f]{64}$'
  ),
  email_server_verified boolean NOT NULL DEFAULT false,
  sms_provider_verified boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz,
  sms_verified_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','needs_review','revoked')),
  committed_at timestamptz,
  revoked_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject_id),
  UNIQUE (issuer, email_binding_hmac),
  CONSTRAINT native_client_approval_requires_two_proofs CHECK (
    status <> 'approved' OR (
      email_server_verified IS TRUE AND sms_provider_verified IS TRUE AND
      sms_recipient_hmac IS NOT NULL AND sms_provider_proof_hmac IS NOT NULL AND
      email_verified_at IS NOT NULL AND sms_verified_at IS NOT NULL AND
      committed_at IS NOT NULL AND revoked_at IS NULL
    )
  ),
  CONSTRAINT native_client_revoke_must_be_dated CHECK (
    status <> 'revoked' OR revoked_at IS NOT NULL
  )
);

CREATE INDEX idx_da_native_client_admissions_state
  ON public.da_native_client_admissions(status, created_at DESC);

-- Database layer safeguards: immutable identity/issuer, revocation monotonic,
-- no stale/future SMS proof accepted when FIRST granting admission.
-- These triggers DO NOT independently verify the external SMS provider.
CREATE FUNCTION public.da_native_client_admission_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.issuer IS DISTINCT FROM OLD.issuer OR
       NEW.subject_id IS DISTINCT FROM OLD.subject_id OR
       NEW.email_binding_hmac IS DISTINCT FROM OLD.email_binding_hmac THEN
      RAISE EXCEPTION 'native_immutable_client_identity';
    END IF;
    IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
      RAISE EXCEPTION 'native_revoked_identity_cannot_reactivate';
    END IF;
    IF OLD.status = 'approved' AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'native_approved_identity_cannot_return_to_pending';
    END IF;
    IF OLD.sms_provider_proof_hmac IS NOT NULL AND
       NEW.sms_provider_proof_hmac IS DISTINCT FROM OLD.sms_provider_proof_hmac THEN
      RAISE EXCEPTION 'native_sms_proof_cannot_be_replaced';
    END IF;
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      IF NEW.sms_verified_at IS NULL OR
         NEW.sms_verified_at < statement_timestamp() - interval '15 minutes' OR
         NEW.sms_verified_at > statement_timestamp() + interval '60 seconds' OR
         NEW.email_verified_at > statement_timestamp() + interval '60 seconds' THEN
        RAISE EXCEPTION 'native_sms_proof_not_fresh_for_approval';
      END IF;
    END IF;
    NEW.updated_at := statement_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER da_native_client_admission_guard_before_update
BEFORE UPDATE ON public.da_native_client_admissions
FOR EACH ROW EXECUTE FUNCTION public.da_native_client_admission_guard();

COMMENT ON TABLE public.da_native_client_admissions IS
  'QA candidate: native Keycloak Client role is NOT commercial authorization. '
  'Only a server-confirmed SMS + email proof on a specific issuer/sub and an '
  'approved committed ledger can allow separate commerce admission guards. '
  'Never trust client flags or apply automatically to production.';
COMMIT;
