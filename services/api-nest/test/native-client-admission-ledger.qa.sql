-- Native Client realm schema adversarial checks.
-- Only run after the QA-only DDL in an ephemeral, disconnected PostgreSQL.
-- All values below are SYNTHETIC. This script rolls back all of its rows.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  owner uuid := 'a63f867f-9f42-4573-9268-dc65a164d2c1';
  secondary uuid := 'b63f867f-9f42-4573-9268-dc65a164d2c2';
  fake_issuer text := 'https://auth.qa.example.invalid/realms/da-client';
  pending_rows bigint;
  approved_rows bigint;
BEGIN
  INSERT INTO public.da_native_client_admissions (
    issuer, subject_id, email_binding_hmac
  ) VALUES (fake_issuer, owner, repeat('a',64));

  SELECT count(*) INTO pending_rows
  FROM public.da_native_client_admissions
  WHERE issuer=fake_issuer AND subject_id=owner AND status='pending';
  IF pending_rows<>1 THEN
    RAISE EXCEPTION 'qa_pending_identity_must_exist';
  END IF;
  RAISE NOTICE 'QA_PASS=pending_identity_is_not_approved';

  BEGIN
    UPDATE public.da_native_client_admissions
    SET status='approved', committed_at=statement_timestamp()
    WHERE issuer=fake_issuer AND subject_id=owner;
    RAISE EXCEPTION 'qa_missing_sms_was_accepted';
  EXCEPTION WHEN others THEN
    IF SQLSTATE <> '23514' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=cannot_approve_without_email_and_sms';
  END;

  UPDATE public.da_native_client_admissions
  SET status='approved',
      email_server_verified=true,
      sms_provider_verified=true,
      email_verified_at=statement_timestamp()-interval '2 minutes',
      sms_verified_at=statement_timestamp()-interval '1 minute',
      sms_recipient_hmac=repeat('b',64),
      sms_provider_proof_hmac=repeat('c',64),
      committed_at=statement_timestamp()
  WHERE issuer=fake_issuer AND subject_id=owner;

  SELECT count(*) INTO approved_rows
  FROM public.da_native_client_admissions
  WHERE issuer=fake_issuer AND subject_id=owner
    AND status='approved' AND revoked_at IS NULL
    AND sms_provider_verified=true AND email_server_verified=true
    AND committed_at IS NOT NULL;
  IF approved_rows<>1 THEN RAISE EXCEPTION 'qa_full_proof_commit_failed'; END IF;
  RAISE NOTICE 'QA_PASS=fresh_independent_proofs_allow_approved_ledger_row';

  BEGIN
    INSERT INTO public.da_native_client_admissions (
      issuer, subject_id, email_binding_hmac
    ) VALUES (fake_issuer, owner, repeat('d',64));
    RAISE EXCEPTION 'qa_subject_duplicate_accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'QA_PASS=cannot_duplicate_issuer_and_subject';
  END;

  BEGIN
    UPDATE public.da_native_client_admissions
    SET subject_id=secondary
    WHERE issuer=fake_issuer AND subject_id=owner;
    RAISE EXCEPTION 'qa_subject_replace_allowed';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'native_immutable_client_identity' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=identity_subject_immutable';
  END;

  BEGIN
    UPDATE public.da_native_client_admissions
    SET email_binding_hmac=repeat('e',64)
    WHERE issuer=fake_issuer AND subject_id=owner;
    RAISE EXCEPTION 'qa_email_binding_replace_allowed';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'native_immutable_client_identity' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=email_binding_immutable';
  END;

  INSERT INTO public.da_native_client_admissions (
    issuer, subject_id, email_binding_hmac
  ) VALUES (fake_issuer, secondary, repeat('d',64));

  BEGIN
    UPDATE public.da_native_client_admissions
    SET status='approved',
        email_server_verified=true,
        sms_provider_verified=true,
        email_verified_at=statement_timestamp()-interval '3 minutes',
        sms_verified_at=statement_timestamp()-interval '1 minute',
        sms_recipient_hmac=repeat('e',64),
        sms_provider_proof_hmac=repeat('c',64),
        committed_at=statement_timestamp()
    WHERE issuer=fake_issuer AND subject_id=secondary;
    RAISE EXCEPTION 'qa_sms_proof_replay_accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'QA_PASS=sms_proof_cannot_be_reused_for_another_subject';
  END;

  BEGIN
    UPDATE public.da_native_client_admissions
    SET status='approved',
        email_server_verified=true,
        sms_provider_verified=true,
        email_verified_at=statement_timestamp()-interval '80 minutes',
        sms_verified_at=statement_timestamp()-interval '1 hour',
        sms_recipient_hmac=repeat('e',64),
        sms_provider_proof_hmac=repeat('f',64),
        committed_at=statement_timestamp()
    WHERE issuer=fake_issuer AND subject_id=secondary;
    RAISE EXCEPTION 'qa_stale_sms_proof_accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'native_sms_proof_not_fresh_for_approval' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=stale_sms_proof_not_valid_for_first_approval';
  END;

  BEGIN
    UPDATE public.da_native_client_admissions
    SET sms_provider_proof_hmac=repeat('f',64)
    WHERE issuer=fake_issuer AND subject_id=owner;
    RAISE EXCEPTION 'qa_approved_sms_proof_replacement_allowed';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'native_sms_proof_cannot_be_replaced' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=verified_sms_proof_immutable';
  END;

  UPDATE public.da_native_client_admissions
  SET status='revoked', revoked_at=statement_timestamp()
  WHERE issuer=fake_issuer AND subject_id=owner;

  SELECT count(*) INTO approved_rows
  FROM public.da_native_client_admissions
  WHERE issuer=fake_issuer AND subject_id=owner
    AND status='approved' AND revoked_at IS NULL;
  IF approved_rows<>0 THEN RAISE EXCEPTION 'qa_revoked_identity_still_approved'; END IF;
  RAISE NOTICE 'QA_PASS=revoked_identity_removed_from_approved_admission';

  BEGIN
    UPDATE public.da_native_client_admissions
    SET status='approved', revoked_at=NULL
    WHERE issuer=fake_issuer AND subject_id=owner;
    RAISE EXCEPTION 'qa_revoked_identity_reactivated';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'native_revoked_identity_cannot_reactivate' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=revocation_cannot_be_reverted';
  END;
END
$$;

ROLLBACK;
