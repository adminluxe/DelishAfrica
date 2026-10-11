#!/usr/bin/env bash
# DELISHAFRICA / SAFE CLIENT ENROLLMENT GATE v1
# READ-ONLY by design: NEVER creates users, changes Keycloak, runs migrations,
# restarts APIs, reads secret values, enables Stripe, or submits builds.
# On VPS: bash ops/client-enrollment/DA_CLIENT_ENROLLMENT_SAFE_GATE_V1.sh
set -Eeuo pipefail
umask 077
export LC_ALL=C

for cmd in curl python3 sudo; do
  command -v "$cmd" >/dev/null || { echo "FATAL: missing $cmd"; exit 2; }
done
if ! sudo -n docker info >/dev/null 2>&1; then
  echo "FATAL: sudo docker read-only inspection unavailable"; exit 2
fi
echo "# DELISHAFRICA — CLIENT ENROLLMENT ACTIVATION GATE"
date -u '+time_utc=%Y-%m-%dT%H:%M:%SZ'
echo 'mode=READ_ONLY'
echo 'production_mutations=NONE'

check_api() {
  local port="$1" route="$2" http
  http=$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' \
      "http://127.0.0.1:${port}/api/v1/${route}" 2>/dev/null || true)
  case "$http" in
    200) printf 'api_%s_%s=HTTP_200\n' "$port" "${route//\//_}" ;;
    404) printf 'api_%s_%s=HTTP_404_NOT_DEPLOYED\n' "$port" "${route//\//_}" ;;
    *) printf 'api_%s_%s=HTTP_%s\n' "$port" "${route//\//_}" "${http:-UNREACHABLE}" ;;
  esac
}
check_api 3010 health
check_api 3011 health
check_api 3010 client-enrollment/readiness
check_api 3011 client-enrollment/readiness

# Print only environment variable presence; never the values.
sudo -n docker exec delish-api node -e '
  const keys = [
    "DATABASE_URL","DA_CLIENT_ENROLLMENT_ENABLED",
    "DA_CLIENT_ENROLLMENT_HMAC_SECRET",
    "DA_CLIENT_ENROLLMENT_KC_BASE_URL",
    "DA_CLIENT_ENROLLMENT_KC_CLIENT_ID",
    "DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET",
    "DA_CLIENT_ENROLLMENT_SECURITY_GATE",
  ];
  for (const k of keys) console.log("api_env_" + k + "_present=" + Boolean(process.env[k]));
  console.log("api_enrollment_flag_on=" + (process.env.DA_CLIENT_ENROLLMENT_ENABLED === "true"));
  console.log("api_security_gate_approved=" +
    (process.env.DA_CLIENT_ENROLLMENT_SECURITY_GATE === "APPROVED_AFTER_REVIEW"));
'

# Anonymous OIDC discovery only; no admin token.
sudo -n docker exec delish-api node -e '
  fetch("http://afritaste-keycloak:8080/realms/afritaste/.well-known/openid-configuration",
    {signal: AbortSignal.timeout(5000)})
    .then(r => console.log("keycloak_private_oidc_http=" + r.status))
    .catch(() => { console.log("keycloak_private_oidc_http=DOWN"); process.exitCode = 1; });
' || true

# Schema existence only. No user or transaction contents are read.
sudo -n docker exec delish-db psql -X -A -F '=' -t \
  -U postgres -d delish_db -v ON_ERROR_STOP=1 \
  -c "SELECT 'client_enrollment_table_exists',
         CASE WHEN to_regclass('public.da_client_enrollments') IS NOT NULL THEN 'true' ELSE 'false' END;" \
  2>/dev/null || echo 'client_enrollment_table_exists=UNKNOWN'

# Never return realm_attribute.value (could contain SMTP credentials).
sudo -n docker exec -i afritaste-keycloak-postgres sh -c \
  'exec psql -X -A -F "=" -t -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
SELECT 'realm_registration_allowed',registration_allowed FROM realm WHERE name='afritaste';
SELECT 'realm_reset_password_allowed',reset_password_allowed FROM realm WHERE name='afritaste';
SELECT 'realm_verify_email',verify_email FROM realm WHERE name='afritaste';
SELECT 'realm_smtp_config_count',COUNT(*) FROM realm_attribute
 WHERE name ILIKE '%smtp%' AND realm_id=(SELECT id FROM realm WHERE name='afritaste');
SELECT 'client_realm_role_count',COUNT(*) FROM keycloak_role
 WHERE name='client' AND client_role=false AND realm_id=(SELECT id FROM realm WHERE name='afritaste');
SELECT 'enrollment_service_account_client_count',COUNT(*) FROM client
 WHERE client_id='delishafrica-client-enrollment'
 AND realm_id=(SELECT id FROM realm WHERE name='afritaste');
SQL

# Fail-closed irrespective of apparent technical readiness.
echo 'release_gate=HOLD_UNTIL_MANUAL_QA_AND_SECURITY_SIGNOFF'
echo 'store_push=FORBIDDEN'
echo 'stripe_live=FORBIDDEN'
echo 'keycloak_global_registration=UNTOUCHED'
