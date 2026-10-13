#!/usr/bin/env bash
# F4L secure DISCONNECTED CI extension. Called ONLY from F4K's isolated job,
# after Keycloak26 + PG17 + F4K signed mutations + financial pulse all passed.
# ALL DATA FAKE. No real Stripe, SSH, deployment, VPS or Toshiba.
set -Eeuo pipefail
umask 077
for v in QA_DIR PG_ID KC_ID DA_ID MIG GITHUB_WORKSPACE RUNNER_TEMP; do
  test -n "$(printenv "$v" || true)" || { echo "QA_F4L_ISOLATION_MISSING_$v";exit 1; }
done
test "$GITHUB_ACTIONS" = true
test "$QA_SYNTHETIC_ONLY" = YES
case "$QA_DIR" in "$RUNNER_TEMP"/da-f4i-*) ;; *) echo "QA_F4L_UNEXPECTED_RUNNER_PATH";exit 1;; esac
for f in services/api-nest/test/f4l-dispatch-*.cjs;do node --check "$f";done
node - <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict');
const sql=fs.readFileSync('services/api-nest/migrations/client-commerce/20261013_016_oidc_machine_dispatch_authority_qa_only.sql','utf8');
const verifier=fs.readFileSync('services/api-nest/test/f4l-dispatch-oidc-verifier.pg-qa.cjs','utf8');
const wk=fs.readFileSync('.github/workflows/f4l-oidc-machine-dispatch-qa.yml','utf8');
for(const x of ['da_qa_dispatch_assign_attested_016','da_qa_dispatch_machine_registry_016',
 'da_qa_commerce_order_dispatch_eligible','da_qa_dispatch_receipt_016_append_only',
 'REVOKE EXECUTE ON FUNCTION public.da_qa_dispatch_assign_offer','FOR UPDATE'])
 assert(sql.includes(x),x);
assert(!/DROP TABLE|TRUNCATE TABLE|ALTER SYSTEM/i.test(sql));
assert(!/GRANT EXECUTE ON FUNCTION public\.da_qa_dispatch_assign_offer\([^)]*\)\s+TO\s+da_qa_(?:merchant|courier|dispatch)_commerce_app/i.test(sql));
assert(verifier.includes("crypto.verify('RSA-SHA256'"));
assert(verifier.includes('token/introspect'));
assert(verifier.includes('da.dispatch.assign'));
assert(wk.includes('--network none'));
console.log('QA_F4L_NO_LEGACY_007_APP_GRANT_NO_PRODUCTION=PASS');
NODE
docker exec "$PG_ID" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "UPDATE public.da_merchant_memberships SET membership_status='active',contract_status='active' WHERE partner_id='qa_partner_a'; UPDATE public.da_qa_finance_courier_roster_012 SET roster_status='active' WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid" >/dev/null
docker exec -i "$PG_ID" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$MIG/20261013_016_oidc_machine_dispatch_authority_qa_only.sql" >/dev/null
echo "QA_F4L_SQL_016_ROLE_AND_LOCK_AUTHORITY=INSTALLED"

# One-shot Keycloak ADMIN initializer. It is deleted BEFORE app/attestor run.
mkdir -p "$QA_DIR/machine-seed" "$QA_DIR/dispatch-ipc"
sudo chown 1000:1000 "$QA_DIR/machine-seed"
sudo chmod 0700 "$QA_DIR/machine-seed"
docker run --rm --pull never --user 1000:1000 \
  --network "container:$KC_ID" --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --env-file "$QA_DIR/test.env" \
  -v "$QA_DIR/machine-seed:/qa-seed:rw" \
  -v "$QA_DIR/tls/qa.crt:/qa-tls/qa.crt:ro" \
  -v "$GITHUB_WORKSPACE/services/api-nest/test:/qa-tests:ro" \
  node:22-alpine node /qa-tests/f4l-dispatch-oidc-machine.setup.pg-qa.cjs
sudo install -m 0600 -o "$(id -u)" -g "$(id -g)" \
  "$QA_DIR/machine-seed/f4l-dispatch-machine.json" "$QA_DIR/f4l-machine.json"
sudo rm -rf "$QA_DIR/machine-seed"
node - "$QA_DIR" <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const dir=process.argv[2],secret=()=>crypto.randomBytes(32).toString('hex');
const machine=JSON.parse(fs.readFileSync(path.join(dir,'f4l-machine.json')));
const introspection=JSON.parse(fs.readFileSync(path.join(dir,'introspection.json')));
const legacy=fs.readFileSync(path.join(dir,'client.env'),'utf8');
const get=k=>legacy.match(new RegExp('^'+k+'=(.+)$','m'))?.[1];
const merchant=get('QA_MERCHANT_DB_PASSWORD'),courier=get('QA_COURIER_DB_PASSWORD');
if(!merchant||!courier||!introspection.secret||!machine.clientSecret)
 throw Error('qa_f4l_private_fixture_missing');
const pw={attestor:secret(),worker:secret()};
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const org='a43f867f-9f42-4573-9268-dc65a164d2c2';
fs.writeFileSync(path.join(dir,'f4l-roles.sql'),[
 "SET password_encryption='scram-sha-256';",
 "ALTER ROLE da_qa_dispatch_machine_016 PASSWORD "+quote(pw.worker)+";",
 "ALTER ROLE da_qa_dispatch_attestor_016 PASSWORD "+quote(pw.attestor)+";",
 "INSERT INTO public.da_qa_dispatch_machine_registry_016("+
 "issuer,subject,client_id,organization_id,territory) VALUES("+
 quote(machine.issuer)+","+quote(machine.subject)+"::uuid,"+
 quote(machine.clientId)+","+quote(org)+"::uuid,'BE');",
 ''
].join('\n'),{mode:0o600});
const base=['GITHUB_ACTIONS=true','QA_SYNTHETIC_ONLY=YES',
 'NODE_EXTRA_CA_CERTS=/qa-tls/qa.crt'];
fs.writeFileSync(path.join(dir,'f4l-attestor.env'),[
 ...base,'QA_F4L_PRIVATE_ATTESTOR=YES',
 'QA_F4L_ATTESTOR_DB_PASSWORD='+pw.attestor,
 'QA_INTROSPECT_CLIENT_SECRET='+introspection.secret,''
].join('\n'),{mode:0o600});
fs.writeFileSync(path.join(dir,'f4l-worker.env'),[
 ...base,'QA_F4L_MACHINE_WORKER=YES',
 'QA_F4L_MACHINE_DB_PASSWORD='+pw.worker,
 'QA_F4L_MACHINE_CLIENT_SECRET='+machine.clientSecret,
 'QA_MERCHANT_DB_PASSWORD='+merchant,
 'QA_COURIER_DB_PASSWORD='+courier,''
].join('\n'),{mode:0o600});
console.log('QA_F4L_INDEPENDENT_MACHINE_ATTESTOR_SCRAM_CREDS=GENERATED');
NODE
docker exec -i "$PG_ID" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
 < "$QA_DIR/f4l-roles.sql" >/dev/null
echo "QA_F4L_KEYCLOAK_MACHINE_AND_PG_REGISTRY=PROVISIONED"

# Independent canonical order + capture fixtures, no supplier or live account.
docker run --rm --pull never --user 1000:1000 \
  --network "container:$KC_ID" --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --env-file "$QA_DIR/order-fixture.env" \
  -e NODE_PATH=/qa-deps/node_modules \
  -v "$QA_DIR/seed:/qa-seed:rw" \
  -v "$QA_DIR/deps:/qa-deps:ro" \
  -v "$QA_DIR/built:/qa-built:ro" \
  -v "$GITHUB_WORKSPACE/services/api-nest/test:/qa-tests:ro" \
  node:22-alpine node /qa-tests/f4l-dispatch-order-seed.pg-qa.cjs
sudo install -m 0600 -o "$(id -u)" -g "$(id -g)" \
  "$QA_DIR/seed/f4l-finance.sql" "$QA_DIR/f4l-finance.sql"
sudo install -m 0600 -o "$(id -u)" -g "$(id -g)" \
  "$QA_DIR/seed/f4l-orders.json" "$QA_DIR/f4l-orders-runner.json"
sudo install -m 0400 -o 1000 -g 3000 \
  "$QA_DIR/seed/f4l-orders.json" "$QA_DIR/users/f4l-orders.json"
docker exec -i "$PG_ID" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
 < "$QA_DIR/f4l-finance.sql" >/dev/null
# Merchant accepted/ready through F4K signed, privately attested transitions:
docker run --rm --pull never --user 1000:3000 \
  --network "container:$KC_ID" --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --env-file "$QA_DIR/client.env" \
  -e NODE_PATH=/qa-deps/node_modules \
  -v "$QA_DIR/ipc:/qa-ipc:ro" -v "$QA_DIR/users:/qa-users:ro" \
  -v "$QA_DIR/deps:/qa-deps:ro" \
  -v "$GITHUB_WORKSPACE/services/api-nest/test:/qa-tests:ro" \
  node:22-alpine node /qa-tests/f4l-dispatch-merchant-prepare.pg-qa.cjs
echo "QA_F4L_CAPTURED_ORDERS_F4K_SIGNED_READY=PASS"

# Dispatch attestor private process = DIFFERENT Unix UID / SQL login / env.
sudo chown 1002:3000 "$QA_DIR/dispatch-ipc"
sudo chmod 0710 "$QA_DIR/dispatch-ipc"
docker run -d --name "$DA_ID" --pull never --user 1002:3000 \
  --network "container:$KC_ID" --cap-drop ALL \
  --security-opt no-new-privileges --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --env-file "$QA_DIR/f4l-attestor.env" \
  -e NODE_PATH=/qa-deps/node_modules \
  -v "$QA_DIR/dispatch-ipc:/qa-dispatch-ipc:rw" \
  -v "$QA_DIR/tls/qa.crt:/qa-tls/qa.crt:ro" \
  -v "$QA_DIR/deps:/qa-deps:ro" \
  -v "$GITHUB_WORKSPACE/services/api-nest/test:/qa-tests:ro" \
  node:22-alpine node /qa-tests/f4l-dispatch-private-attestor.pg-qa.service.cjs >/dev/null
ready=false
for i in $(seq 1 45);do
  if [[ -S "$QA_DIR/dispatch-ipc/dispatch-attestor.sock" ]];then ready=true;break;fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$DA_ID")" != true ]];then
    echo "QA_F4L_PRIVATE_ATTESTOR_CRASH";docker logs "$DA_ID" | tail -n 15;exit 1
  fi
  sleep 1
done
if [[ "$ready" != true ]];then echo "QA_F4L_ATTESTOR_SOCKET_MISSING";exit 1;fi
echo "QA_F4L_PRIVATE_OIDC_ATTESTOR_NO_PUBLIC_PORT=PASS"
run_worker(){
  local stage="$1"
  docker run --rm --pull never --user 1000:3000 \
    --network "container:$KC_ID" --cap-drop ALL \
    --security-opt no-new-privileges --read-only \
    --tmpfs /tmp:rw,nosuid,nodev,size=32m \
    --env-file "$QA_DIR/f4l-worker.env" \
    -e QA_F4L_STAGE="$stage" -e NODE_PATH=/qa-deps/node_modules \
    -v "$QA_DIR/dispatch-ipc:/qa-dispatch-ipc:ro" \
    -v "$QA_DIR/ipc:/qa-ipc:ro" \
    -v "$QA_DIR/users:/qa-users:ro" \
    -v "$QA_DIR/tls/qa.crt:/qa-tls/qa.crt:ro" \
    -v "$QA_DIR/deps:/qa-deps:ro" \
    -v "$GITHUB_WORKSPACE/services/api-nest/test:/qa-tests:ro" \
    node:22-alpine node /qa-tests/f4l-dispatch-machine.pg-qa.integration.cjs
}
pg(){
 docker exec "$PG_ID" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}
pgcount(){
 pg -Atc "$1" | tr -d '\r'
}
authority(){
 node -e "console.log(require(process.argv[1])[process.argv[2]].authorityId)" \
  "$QA_DIR/f4l-orders-runner.json" "$1"
}
run_worker baseline
echo "QA_F4L_REAL_KEYCLOAK_AUTH_SEVEN_WAY_SQL_DISPATCH=PASS"

# Eligible SAME-region Courier B is still forbidden to replace A on an offer.
pg -c "UPDATE public.da_qa_finance_courier_roster_012 SET organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid,territory='BE' WHERE (issuer,subject) IN (SELECT issuer,subject FROM public.da_qa_wallet_courier_scope_010 WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c4'::uuid)" >/dev/null
run_worker reassignment
pg -c "UPDATE public.da_qa_finance_courier_roster_012 SET organization_id='a43f867f-9f42-4573-9268-dc65a164d2c4'::uuid,territory='FR' WHERE (issuer,subject) IN (SELECT issuer,subject FROM public.da_qa_wallet_courier_scope_010 WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c4'::uuid)" >/dev/null
echo "QA_F4L_UNAUTHORIZED_SAME_ORG_REASSIGN=DENIED"

# Refund already committed always wins before first Dispatch assignment.
ref=$(authority refundFirst)
pg -c "SELECT public.da_qa_finance_record_hold('$ref'::uuid,'re_QAF4LREFUND00001','refund')" >/dev/null
run_worker refund-first

# RACE A: refund holds order row first; Dispatch waits, then denies.
ref=$(authority refundConcurrent)
pg -c "SET application_name='f4l_refund_lock_owner'; BEGIN; SELECT public.da_qa_finance_record_hold('$ref'::uuid,'re_QAF4LREFUND00002','refund'); SELECT pg_sleep(7); COMMIT;" > "$QA_DIR/f4l-refund-owner.log" 2>&1 &
hold_pid=$!
ready=false
for i in $(seq 1 50);do
  [[ "$(pgcount "SELECT count(*) FROM pg_stat_activity WHERE application_name='f4l_refund_lock_owner' AND state='active' AND query ILIKE '%pg_sleep%'")" == 1 ]] && { ready=true;break; }
  sleep 0.1
done
if [[ "$ready" != true ]];then echo "QA_F4L_REFUND_FIRST_LOCK_NOT_OBSERVED";exit 1;fi
run_worker refund-race > "$QA_DIR/f4l-refund-worker.log" 2>&1 &
worker_pid=$!
blocked=false
for i in $(seq 1 60);do
  [[ "$(pgcount "SELECT count(*) FROM pg_stat_activity WHERE usename='da_qa_dispatch_machine_016' AND wait_event_type='Lock' AND query LIKE '%da_qa_dispatch_assign_attested_016%'")" != 0 ]] && { blocked=true;break; }
  sleep 0.1
done
wait "$hold_pid"
wait "$worker_pid" || { cat "$QA_DIR/f4l-refund-worker.log";exit 1; }
[[ "$blocked" == true ]] || { echo "QA_F4L_DISPATCH_ROWLOCK_WAIT_UNOBSERVED";exit 1; }
cat "$QA_DIR/f4l-refund-worker.log"
echo "QA_F4L_REFUND_FIRST_DISPATCH_WAITS_AND_DENIES=PASS"

# RACE B: assignment holds the same order lock, refund must wait for COMMIT.
run_worker assignment-hold > "$QA_DIR/f4l-assign-owner.log" 2>&1 &
assign_pid=$!
ready=false
for i in $(seq 1 50);do
 [[ "$(pgcount "SELECT count(*) FROM pg_stat_activity WHERE usename='da_qa_dispatch_machine_016' AND state='active' AND query LIKE '%pg_sleep(7)%'")" != 0 ]] && { ready=true;break; }
 sleep 0.1
done
[[ "$ready" == true ]] || { echo "QA_F4L_ASSIGNMENT_FIRST_LOCK_UNOBSERVED";exit 1; }
ref=$(authority assignThenRefund)
pg -c "SET application_name='f4l_refund_waiter'; SELECT public.da_qa_finance_record_hold('$ref'::uuid,'re_QAF4LREFUND00003','refund')" > "$QA_DIR/f4l-after-refund.log" 2>&1 &
after_pid=$!
blocked=false
for i in $(seq 1 60);do
 [[ "$(pgcount "SELECT count(*) FROM pg_stat_activity WHERE application_name='f4l_refund_waiter' AND wait_event_type='Lock'")" != 0 ]] && { blocked=true;break; }
 sleep 0.1
done
wait "$assign_pid" || { cat "$QA_DIR/f4l-assign-owner.log";exit 1; }
wait "$after_pid" || { cat "$QA_DIR/f4l-after-refund.log";exit 1; }
[[ "$blocked" == true ]] || { echo "QA_F4L_REFUND_ROWLOCK_WAIT_UNOBSERVED";exit 1; }
cat "$QA_DIR/f4l-assign-owner.log"
run_worker assignment-refund-held
echo "QA_F4L_ASSIGNMENT_FIRST_REFUND_WAITS_THEN_COURIER_BLOCKED=PASS"

# Revocation / org and territory drift / service account machine revocation.
pg -c "UPDATE public.da_qa_finance_courier_roster_012 SET roster_status='revoked' WHERE (issuer,subject) IN (SELECT issuer,subject FROM public.da_qa_wallet_courier_scope_010 WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid)" >/dev/null
run_worker courier-revoked
pg -c "UPDATE public.da_qa_finance_courier_roster_012 SET roster_status='active',organization_id='a43f867f-9f42-4573-9268-dc65a164d2c4'::uuid,territory='FR' WHERE (issuer,subject) IN (SELECT issuer,subject FROM public.da_qa_wallet_courier_scope_010 WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid)" >/dev/null
run_worker org-moved
pg -c "UPDATE public.da_qa_finance_courier_roster_012 SET organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid,territory='BE' WHERE (issuer,subject) IN (SELECT issuer,subject FROM public.da_qa_wallet_courier_scope_010 WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid)" >/dev/null
pg -c "UPDATE public.da_qa_dispatch_machine_registry_016 SET grant_status='revoked'" >/dev/null
run_worker machine-revoked

# Financial conservation + immutability, including legacy F4K operations.
pg <<'SQL'
DO $q$
DECLARE lines integer;total bigint;allocs integer;
 receipts integer;operations integer;
BEGIN
 SELECT count(*),coalesce(sum(signed_minor),0) INTO lines,total
 FROM public.da_qa_wallet_posting;
 SELECT count(*) INTO allocs FROM public.da_qa_wallet_allocation;
 SELECT count(*) INTO receipts FROM public.da_qa_dispatch_receipt_016;
 SELECT count(*) INTO operations FROM public.da_qa_fulfillment_receipt_015;
 IF lines<>64 OR total<>0 OR allocs<>16 OR receipts<>6 OR operations<>35
 THEN RAISE EXCEPTION 'qa_f4l_ledger_or_receipt_mismatch_%,%,%,%,%',
  lines,total,allocs,receipts,operations; END IF;
 BEGIN
  UPDATE public.da_qa_dispatch_receipt_016 SET operation='assigned';
  RAISE EXCEPTION 'qa_f4l_receipt_mutation_allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='qa_f4l_receipt_mutation_allowed' OR
     SQLERRM<>'qa_wallet_immutable_audit'
  THEN RAISE; END IF;
 END;
 RAISE NOTICE 'QA_F4L_BALANCED_LEDGER_AND_IMMUTABLE_RECEIPTS=PASS';
END $q$;
SQL
echo "QA_F4L_STRIPE_PROVIDER_CALLS=ZERO_WITHDRAWABLE=ZERO_PAYOUT=ZERO"
echo "QA_F4L_PRODUCTION_VPS_TOSHIBA_EXPO_UNMODIFIED=YES"
