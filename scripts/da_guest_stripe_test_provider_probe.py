#!/usr/bin/env python3
"""DelishAfrica P5-E controlled Stripe TEST API probe.

No payment method, confirmation, capture, refund, live request, production DB,
account/merchant/courier mutation, or secret/response body in logs.

Only --execute performs an external Stripe TEST create -> read -> cancel.
Requires authorized OS access to canonical server .env files and keeps any
created Stripe PaymentIntent in a persistent restricted journal for recovery.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
import re
import secrets
import ssl
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_FILES = (
    Path('/opt/delishafrica/monorepo/.env'),
    Path('/opt/delishafrica/monorepo/services/api-nest/.env'),
)
STATE_ROOT = Path('/var/lib/delishafrica-stripe-test-provider-probe')
SECRET_RE = re.compile(r'^sk_test_[A-Za-z0-9]+$')
PUBLIC_RE = re.compile(r'^pk_test_[A-Za-z0-9]+$')
PI_RE = re.compile(r'^pi_[A-Za-z0-9_]{8,192}$')
ACCOUNT_RE = re.compile(r'^acct_[A-Za-z0-9]+$')
ASSIGN = re.compile(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
URL = 'https://api.stripe.com/v1'
CONTEXT = ssl.create_default_context()
ALLOWED_STATES = {'cancelled'}


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def emit(*parts):
    print(' '.join(str(p) for p in parts), flush=True)


def safe_read_env(path):
    try:
        st = path.lstat()
    except OSError:
        raise RuntimeError('protected_env_file_missing_or_inaccessible') from None
    if not stat.S_ISREG(st.st_mode) or st.st_size > 1024 * 1024:
        raise RuntimeError('protected_env_file_not_regular_or_too_large')
    if st.st_mode & 0o077:
        raise RuntimeError('protected_env_permissions_too_open')
    try:
        contents = path.read_text(encoding='utf-8')
    except OSError:
        raise RuntimeError('protected_env_read_denied') from None
    values = {}
    for line in contents.splitlines():
        if line.lstrip().startswith('#'):
            continue
        match = ASSIGN.match(line)
        if match and match.group(1) in ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'PAYMENTS_MODE', 'PAYMENTS_PROVIDER', 'STRIPE_MOCK_MODE'):
            v = match.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1]
            values[match.group(1)] = v
    return values


def load_credentials():
    first, second = [safe_read_env(path) for path in ENV_FILES]
    if any(first.get(k) != second.get(k) for k in ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY')):
        raise RuntimeError('protected_server_env_pair_mismatch')
    secret = first.get('STRIPE_SECRET_KEY', '')
    public = first.get('STRIPE_PUBLISHABLE_KEY', '')
    if not SECRET_RE.fullmatch(secret) or not PUBLIC_RE.fullmatch(public):
        raise RuntimeError('stripe_test_credentials_not_strictly_test')
    if first.get('PAYMENTS_MODE') != 'stripe_test' or first.get('PAYMENTS_PROVIDER') != 'stripe':
        raise RuntimeError('payments_mode_not_stripe_test')
    if first.get('STRIPE_MOCK_MODE') not in ('false', '0'):
        raise RuntimeError('unexpected_mock_mode')
    return secret, public


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]


def write_atomic(path, payload):
    temp = path.with_name(path.name + '.tmp.' + secrets.token_hex(4))
    file_desc = os.open(str(temp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(file_desc, 'w', encoding='utf-8') as writer:
            json.dump(payload, writer, separators=(',', ':'), sort_keys=True)
            writer.write('\n')
            writer.flush()
            os.fsync(writer.fileno())
        os.replace(temp, path)
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass


class StripeResponseError(Exception):
    def __init__(self, code):
        super().__init__('stripe_request_failed')
        self.code = code


def stripe_req(secret, method, endpoint, form=None, idem_key=None):
    if not endpoint.startswith('/') or endpoint.startswith('//') or '?' in endpoint or '..' in endpoint:
        raise RuntimeError('invalid_stripe_endpoint')
    allowed = endpoint == '/account' or endpoint == '/payment_intents' or bool(re.fullmatch(r'/payment_intents/pi_[A-Za-z0-9_]{8,192}(?:/cancel)?', endpoint))
    if not allowed or (method not in ('GET', 'POST')):
        raise RuntimeError('method_or_path_not_allowed')
    if endpoint == '/account' and method != 'GET':
        raise RuntimeError('account_is_readonly')
    if endpoint.endswith('/cancel') and method != 'POST':
        raise RuntimeError('cancel_must_post')
    if endpoint == '/payment_intents' and method != 'POST':
        raise RuntimeError('create_must_post')
    if not SECRET_RE.fullmatch(secret):
        raise RuntimeError('live_or_invalid_secret_refused')
    headers = {'Authorization': 'Bearer ' + secret, 'Accept': 'application/json'}
    data = None
    if method == 'POST':
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        if not isinstance(form, dict):
            raise RuntimeError('post_missing_body')
        data = urllib.parse.urlencode(form).encode('utf-8')
    if idem_key:
        if not re.fullmatch(r'[A-Za-z0-9:_-]{16,255}', idem_key):
            raise RuntimeError('invalid_idempotency_key')
        headers['Idempotency-Key'] = idem_key
    request = urllib.request.Request(URL + endpoint, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10, context=CONTEXT) as response:
            if response.status != 200:
                raise StripeResponseError(response.status)
            raw = response.read(128 * 1024 + 1)
            if len(raw) > 128 * 1024:
                raise RuntimeError('stripe_response_too_large')
    except urllib.error.HTTPError as error:
        raise StripeResponseError(error.code) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RuntimeError('stripe_network_outcome_uncertain') from None
    try:
        decoded = json.loads(raw)
    except (ValueError, TypeError):
        raise RuntimeError('stripe_invalid_json') from None
    if not isinstance(decoded, dict):
        raise RuntimeError('stripe_invalid_object')
    return decoded


def confirm_test_intent(intent, order_id, expected_amount=50, expected_status=None):
    if intent.get('object') != 'payment_intent':
        raise RuntimeError('stripe_returned_non_intent')
    if intent.get('livemode') is not False:
        raise RuntimeError('critical_non_test_intent_refused')
    pid = intent.get('id')
    if not isinstance(pid, str) or not PI_RE.fullmatch(pid):
        raise RuntimeError('invalid_provider_intent_id')
    if intent.get('amount') != expected_amount or intent.get('currency') != 'eur':
        raise RuntimeError('intent_amount_currency_mismatch')
    meta = intent.get('metadata')
    if not isinstance(meta, dict) or meta.get('orderId') != order_id or meta.get('probeOnly') != 'true':
        raise RuntimeError('stripe_intent_metadata_mismatch')
    if expected_status and intent.get('status') != expected_status:
        raise RuntimeError('unexpected_stripe_intent_status')
    return pid


def preflight_state_directory(path):
    if not path.is_absolute():
        raise RuntimeError('state_dir_must_be_absolute')
    if path.is_symlink():
        raise RuntimeError('state_dir_must_not_be_symlink')
    if not path.exists():
        path.mkdir(mode=0o700, parents=True, exist_ok=False)
    # A root-only parent prevents lower-privilege symlink attacks when sudo
    # executes this script. Never write a root journal under a user-owned tree.
    if path == STATE_ROOT and (path.parent.is_symlink() or path.parent.stat().st_uid != 0):
        raise RuntimeError('state_dir_untrusted_parent')
    if (path.stat().st_mode & 0o077) or not path.is_dir() or path.stat().st_uid != os.geteuid():
        raise RuntimeError('state_dir_permission_or_type_invalid')
    return path


def run(execute, state_dir):
    os.umask(0o077)
    emit('P5E_STRIPE_PROVIDER_PROBE=v1')
    emit('AUDIT_UTC=', utc())
    emit('INTENT_MODE=STRIPE_TEST_ONLY')
    emit('NO_LIVE_CHARGES=true')
    emit('NO_CARD_DETAILS=true')
    emit('NO_PRODUCTION_DB_MUTATIONS=true')
    emit('EXECUTION_MODE=', 'REAL_STRIPE_TEST_NO_CONFIRM' if execute else 'OFFLINE_PREFLIGHT')

    if os.getenv('NODE_ENV') == 'production':
        raise RuntimeError('production_shell_forbidden')
    if os.getenv('DA_GUEST_STRIPE_TEST_ONLY') != '1':
        raise RuntimeError('explicit_stripe_test_flag_required')
    secret, public = load_credentials()
    emit('SECRET_CATEGORY=SK_TEST')
    emit('PUBLIC_CATEGORY=PK_TEST')
    emit('ENV_FILES_AGREE=true')
    emit('SECRET_HASH_PREFIX=', digest(secret))
    emit('PUBLIC_HASH_PREFIX=', digest(public))
    emit('PAIR_BELONGS_TO_SAME_ACCOUNT=UNVERIFIED')
    if not execute:
        emit('REMOTE_CALLS=0')
        emit('P5E_STRIPE_TEST_RESULT=DRY_RUN_PASS')
        return

    target = preflight_state_directory(state_dir)
    lock_path = target / '.exclusive.lock'
    with open(lock_path, 'a+', encoding='utf-8') as lock:
        os.chmod(lock_path, 0o600)
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('concurrent_test_probe_refused') from None
        unresolved = []
        for existing in target.glob('stripe-test-*.json'):
            try:
                obj = json.loads(existing.read_text('utf-8'))
                if obj.get('state') not in ALLOWED_STATES:
                    unresolved.append(existing.name)
            except (OSError, ValueError, TypeError):
                unresolved.append(existing.name)
        if unresolved:
            emit('OUTSTANDING_PROBES_COUNT=', len(unresolved))
            raise RuntimeError('prior_stripe_test_intent_needs_manual_review')

        account = stripe_req(secret, 'GET', '/account')
        if account.get('object') != 'account' or not ACCOUNT_RE.fullmatch(str(account.get('id', ''))):
            raise RuntimeError('stripe_test_account_probe_invalid')
        emit('STRIPE_TEST_ACCOUNT_READ=AUTHENTICATED')
        emit('STRIPE_TEST_ACCOUNT_ID_SHA256_12=', digest(account['id']))
        # Account pairing cannot be proven from a publishable string alone.

        order = 'DA-G-' + secrets.token_hex(16)
        key = 'da-gc-pi-v1:' + order
        quote = hashlib.sha256(('orchid-free-p5e-test-only:' + order).encode('utf-8')).hexdigest()
        form = {
            'amount': '50', 'currency': 'eur', 'capture_method': 'automatic',
            'confirm': 'false', 'payment_method_types[]': 'card',
            'metadata[source]': 'delishafrica-guest-checkout',
            'metadata[clientIssuer]': 'urn:delishafrica:guest-checkout:v1',
            'metadata[clientSubject]': 'p5e-lab-test-only',
            'metadata[clientMutationId]': 'p5e-probe:' + order,
            'metadata[quoteFingerprint]': quote,
            'metadata[orderId]': order,
            'metadata[probeOnly]': 'true',
        }
        filename = target / ('stripe-test-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + secrets.token_hex(4) + '.json')
        state = {'state': 'creating', 'order_id': order, 'idempotency_key': key,
                 'intent_id': None, 'created_at_utc': utc(), 'mode': 'TEST_ONLY', 'amount_cents': 50}
        write_atomic(filename, state)
        emit('PROBE_ORDER_ID=', order)
        emit('PROBE_JOURNAL=', str(filename))

        pid = None
        cancel_ok = False
        try:
            created = stripe_req(secret, 'POST', '/payment_intents', form, key)
            pid = confirm_test_intent(created, order, expected_status='requires_payment_method')
            state.update(state='created', intent_id=pid)
            write_atomic(filename, state)
            emit('CREATE_TEST_INTENT=PASS', 'INTENT_SHA256_12=' + digest(pid))

            # One exact replay using the same deterministic idempotency key.
            repeat = stripe_req(secret, 'POST', '/payment_intents', form, key)
            repeated_id = confirm_test_intent(repeat, order, expected_status='requires_payment_method')
            if repeated_id != pid:
                raise RuntimeError('critical_idempotency_created_distinct_intent')
            emit('IDEMPOTENT_REPLAY_SAME_ID=PASS')

            retrieved = stripe_req(secret, 'GET', '/payment_intents/' + pid)
            if confirm_test_intent(retrieved, order, expected_status='requires_payment_method') != pid:
                raise RuntimeError('retrieval_identity_mismatch')
            state['state'] = 'retrieved'
            write_atomic(filename, state)
            emit('GET_TEST_INTENT=PASS')
        finally:
            if pid:
                state['state'] = 'cancelling'
                write_atomic(filename, state)
                try:
                    cancelled = stripe_req(secret, 'POST', '/payment_intents/' + pid + '/cancel',
                        {'cancellation_reason': 'abandoned'}, 'da-gc-cancel-v1:' + pid)
                    if confirm_test_intent(cancelled, order, expected_status='canceled') != pid:
                        raise RuntimeError('cancel_identity_mismatch')
                    final = stripe_req(secret, 'GET', '/payment_intents/' + pid)
                    if confirm_test_intent(final, order, expected_status='canceled') != pid:
                        raise RuntimeError('final_state_identity_mismatch')
                    cancel_ok = True
                except Exception:
                    emit('CANCEL_FINAL_GET=UNVERIFIED_MANUAL_RECONCILIATION_REQUIRED')
                state['state'] = 'cancelled' if cancel_ok else 'cancel_unverified'
                state['finished_at_utc'] = utc()
                write_atomic(filename, state)
            else:
                state['state'] = 'provider_creation_uncertain'
                state['finished_at_utc'] = utc()
                write_atomic(filename, state)
        if not cancel_ok:
            raise RuntimeError('stripe_test_orphan_requires_manual_reconciliation')
        emit('CANCEL_TEST_INTENT=PASS')
        emit('FINAL_GET_STATUS=canceled')
        emit('REAL_MONEY_RECEIVED=0')
        emit('PAYMENT_METHOD_ATTACHED=false')
        emit('P5E_STRIPE_TEST_RESULT=PASS')


def main():
    ap = argparse.ArgumentParser(description='Stripe TEST account + cancel-only contract probe')
    ap.add_argument('--execute', action='store_true', help='Create an UNCONFIRMED Stripe TEST PaymentIntent then cancel it')
    ap.add_argument('--state-dir', type=Path, default=STATE_ROOT)
    args = ap.parse_args()
    try:
        run(args.execute, args.state_dir)
    except StripeResponseError as error:
        emit('STRIPE_TEST_HTTP_ERROR_STATUS=', error.code)
        emit('P5E_STRIPE_TEST_RESULT=FAIL_CLOSED')
        return 2
    except Exception as error:
        # Never log external HTTP responses, secret values, URLs with IDs or raw stack traces.
        name = str(error)
        known = {
            'protected_env_file_missing_or_inaccessible', 'protected_env_file_not_regular_or_too_large',
            'protected_env_permissions_too_open', 'protected_env_read_denied', 'protected_server_env_pair_mismatch',
            'stripe_test_credentials_not_strictly_test', 'payments_mode_not_stripe_test', 'unexpected_mock_mode',
            'production_shell_forbidden', 'explicit_stripe_test_flag_required', 'state_dir_must_be_absolute',
            'state_dir_must_not_be_symlink', 'state_dir_permission_or_type_invalid', 'state_dir_untrusted_parent', 'concurrent_test_probe_refused',
            'prior_stripe_test_intent_needs_manual_review', 'stripe_test_account_probe_invalid',
            'stripe_returned_non_intent', 'critical_non_test_intent_refused', 'invalid_provider_intent_id',
            'intent_amount_currency_mismatch', 'stripe_intent_metadata_mismatch', 'unexpected_stripe_intent_status',
            'critical_idempotency_created_distinct_intent', 'retrieval_identity_mismatch', 'cancel_identity_mismatch',
            'final_state_identity_mismatch', 'stripe_test_orphan_requires_manual_reconciliation',
            'stripe_network_outcome_uncertain', 'stripe_invalid_json', 'stripe_invalid_object',
            'stripe_response_too_large', 'invalid_stripe_endpoint', 'method_or_path_not_allowed',
            'account_is_readonly', 'cancel_must_post', 'create_must_post', 'live_or_invalid_secret_refused',
            'post_missing_body', 'invalid_idempotency_key',
        }
        emit('P5E_STRIPE_TEST_FAILURE=', name if name in known else 'UNCLASSIFIED_INTERNAL_ERROR')
        emit('P5E_STRIPE_TEST_RESULT=FAIL_CLOSED')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
