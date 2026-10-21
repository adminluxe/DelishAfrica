-- DelishAfrica catalog cleanup migration
-- Version: 34b4b5b2a5a2_002
-- Purpose: placeholder/demo/test partners must never remain publicly published.
-- Runtime policy: execute only through a dedicated migration/admin identity.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('delishafrica:catalog-foundation:34b4b5b2a5a2_002')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM da_catalog_schema_migrations
     WHERE version = '34b4b5b2a5a2_002'
  ) THEN
    INSERT INTO da_catalog_audit(
      partner_id,
      actor_subject,
      action,
      before_payload,
      after_payload,
      metadata
    )
    SELECT
      partner_id,
      'system:migration:34b4b5b2a5a2_002',
      'archive_non_public_fixture',
      published_payload,
      published_payload,
      jsonb_build_object(
        'previousLifecycleStatus', lifecycle_status,
        'nextLifecycleStatus', 'archived',
        'reason', 'non_public_fixture_status'
      )
      FROM da_catalog_partners
     WHERE lifecycle_status = 'published'
       AND COALESCE(LOWER(published_payload->>'status'), '') IN (
         'placeholder',
         'demo',
         'test',
         'draft',
         'internal'
       );

    UPDATE da_catalog_partners
       SET lifecycle_status = 'archived',
           updated_at = now()
     WHERE lifecycle_status = 'published'
       AND COALESCE(LOWER(published_payload->>'status'), '') IN (
         'placeholder',
         'demo',
         'test',
         'draft',
         'internal'
       );

    INSERT INTO da_catalog_schema_migrations(version)
    VALUES ('34b4b5b2a5a2_002');
  END IF;
END;
$$;

COMMIT;
