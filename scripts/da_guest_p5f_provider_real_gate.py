#!/usr/bin/env python3
"""P5-F provider E2E, explicit-test-only controlled launcher on the VPS.

Accepts --execute to run ONE TEST Stripe PaymentIntent through Guest Checkout.
Otherwise performs read-only preflight. Never logs Stripe keys or secrets.
A durable lab journal is created before provider I/O by the Node test.
Run exclusively as sudo/root via authorized SSH, NEVER copy keys to Git.
"""
import hashlib
import os
import pwd
import re
import stat
import subprocess
import sys
from pathlib import Path

WORKTREE=Path('/home/afripayadmin/worktrees/guest-p5f-real-stripe-lab-20261010')
EXPECTED_BRANCH='feature/client-guest-p5f-real-stripe-lab-20261010'
TEST_FILE=WORKTREE/'services/api-nest/test/guest-stripe-provider.real.postgres.test.cjs'
EXPECTED_SHA='608b6e91172cdf9a55821587534d6d9fe6405a476f553023e50b255d96fdc317'
ENV_FILES=[
    Path('/opt/delishafrica/monorepo/.env'),
    Path('/opt/delishafrica/monorepo/services/api-nest/.env'),
]
JOURNAL=Path('/home/afripayadmin/guest-checkout-evidence-20261010/p5f-provider-intent-journal')
LAB=Path('/home/afripayadmin/guest-checkout-evidence-20261010/pg-lab-p5f')
PORT=55442

def fail(code,message):
    print('P5F_GATE=REFUSED_'+message)
    raise SystemExit(code)

def read_env(path):
    s=path.stat()
    if not stat.S_ISREG(s.st_mode) or stat.S_IMODE(s.st_mode)!=0o600:
        fail(3,'ENV_PERMISSIONS')
    result={}
    for line in path.read_text(encoding='utf8',errors='replace').splitlines():
        m=re.match(r'^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$',line)
        if m and m.group(1) in (
            'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY',
            'PAYMENTS_MODE','PAYMENTS_PROVIDER','STRIPE_MOCK_MODE'
        ):
            result[m.group(1)]=m.group(2).strip().strip('"').strip("'")
    return result

def redact(value):
    value=re.sub(r'(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]+',
        '[REDACTED_STRIPE_KEY]',value)
    value=re.sub(r'pi_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+',
        '[REDACTED_INTENT_SECRET]',value)
    value=re.sub(r'Bearer\s+[A-Za-z0-9_-]+',
        'Bearer [REDACTED]',value)
    return value

print('P5F_REAL_PROVIDER_LAUNCHER=v1')
print('TARGET_MODE=STRIPE_TEST_ONLY')
print('PRODUCTION_DB_ALLOWED=NO')
print('PAYMENT_CONFIRMATION_ALLOWED=NO')
print('PRODUCTION_APPLICATION_MUTATION=NO')

if sys.argv[1:] not in ([],['--execute']):
    fail(2,'INVALID_ARGUMENTS')
do_execute=sys.argv[1:]==['--execute']
if os.geteuid()!=0:
    fail(2,'SUDO_REQUIRED')
if not TEST_FILE.is_file() or not LAB.is_dir():
    fail(3,'ISOLATED_WORKTREE_OR_LAB_MISSING')
if hashlib.sha256(TEST_FILE.read_bytes()).hexdigest()!=EXPECTED_SHA:
    fail(3,'TEST_SOURCE_HASH_MISMATCH')
branch=subprocess.run(['git','-C',str(WORKTREE),'branch','--show-current'],
    capture_output=True,text=True,timeout=9,check=True).stdout.strip()
if branch!=EXPECTED_BRANCH:
    fail(3,'WRONG_BRANCH')
prior='NONE'
if JOURNAL.exists():
    if not JOURNAL.is_dir():
        fail(4,'JOURNAL_PATH_INVALID')
    import json
    files=list(JOURNAL.iterdir())
    if files:
        if len(files)!=1 or files[0].name!='p5f-real-stripe-intent.json':
            fail(4,'JOURNAL_UNEXPECTED_FILES_MANUAL_REVIEW')
        f=files[0]
        if stat.S_IMODE(f.stat().st_mode)!=0o600:
            fail(4,'JOURNAL_PERMISSIONS_INVALID')
        try:
            record=json.loads(f.read_text(encoding='utf8'))
        except (OSError,ValueError):
            fail(4,'JOURNAL_UNREADABLE_MANUAL_REVIEW')
        if record.get('mode')!='TEST_ONLY' or record.get('status')!='cancelled':
            fail(4,'JOURNAL_NOT_SETTLED_MANUAL_REVIEW')
        prior='CANCELLED_VERIFIED_IN_JOURNAL'
        if do_execute:
            fail(4,'PREVIOUS_PROVIDER_RUN_PRESENT_NO_REPLAY')
db=subprocess.run([
    'psql','-h','127.0.0.1','-p',str(PORT),
    '-U','afripayadmin','-d','postgres','-Atqc',
    "SELECT inet_server_port() || ':' || current_database()"],
    capture_output=True,text=True,timeout=9)
if db.returncode!=0 or db.stdout.strip()!='55442:postgres':
    fail(4,'POSTGRES_ISOLATION_INVALID')
rows=subprocess.run([
    'psql','-h','127.0.0.1','-p',str(PORT),
    '-U','afripayadmin','-d','postgres','-Atqc',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],
    capture_output=True,text=True,timeout=9)
if rows.returncode!=0:
    fail(4,'POSTGRES_LAB_UNREADABLE')
lab_has_schema=rows.stdout.strip()!='0'
if do_execute and lab_has_schema:
    fail(4,'POSTGRES_LAB_NOT_EMPTY_NO_REPLAY')
print('P5F_LAB_SCHEMA='+('PRESENT_ISOLATED' if lab_has_schema else 'EMPTY'))
configs=[read_env(f) for f in ENV_FILES]
sk=configs[0].get('STRIPE_SECRET_KEY','')
pk=configs[0].get('STRIPE_PUBLISHABLE_KEY','')
if not re.fullmatch(r'sk_test_[A-Za-z0-9]+',sk):
    fail(3,'LIVE_OR_INVALID_SECRET')
if not re.fullmatch(r'pk_test_[A-Za-z0-9]+',pk):
    fail(3,'LIVE_OR_INVALID_PUBLIC')
if configs[1].get('STRIPE_SECRET_KEY')!=sk or \
   configs[1].get('STRIPE_PUBLISHABLE_KEY')!=pk:
    fail(3,'ENV_DISAGREEMENT')
if configs[0].get('PAYMENTS_MODE')!='stripe_test' or \
   configs[1].get('PAYMENTS_MODE')!='stripe_test':
    fail(3,'NOT_STRIPE_TEST_MODE')
if configs[0].get('STRIPE_MOCK_MODE')!='false':
    fail(3,'UNEXPECTED_MOCK_MODE')
print('STRIPE_TEST_SOURCE_CONSISTENCY=PASS')
print('P5F_PG_PRIVATE_PORT=55442')
print('P5F_TEST_SOURCE_SHA256=PASS')
print('P5F_PROVIDER_PRIOR_JOURNAL='+prior)
if not do_execute:
    print('P5F_PREFLIGHT_RESULT=PASS')
    print('NEW_STRIPE_INTENTS_CREATED=0')
    raise SystemExit(0)

user=pwd.getpwnam('afripayadmin')
env={
    'PATH':'/usr/local/bin:/usr/bin:/bin',
    'HOME':user.pw_dir,
    'USER':user.pw_name,
    'LOGNAME':user.pw_name,
    'NODE_ENV':'test',
    'DA_GUEST_STRIPE_TEST_ONLY':'1',
    'DA_P5F_PROVIDER_REAL_EXPLICIT':'YES',
    'DA_P5F_STRIPE_SECRET':sk,
}
def drop_privileges():
    os.setgroups([])
    os.setgid(user.pw_gid)
    os.setuid(user.pw_uid)

print('P5F_PROVIDER_START=TEST_ONLY_NO_PAYMENT_CONFIRMATION')
try:
    child=subprocess.run(
        ['/usr/bin/node',str(TEST_FILE)],
        cwd=str(WORKTREE),env=env,
        preexec_fn=drop_privileges,
        capture_output=True,text=True,timeout=115,
    )
    print(redact(child.stdout)[-12000:])
    if child.stderr.strip():
        print('NODE_TEST_STDERR_SANITIZED='+redact(child.stderr)[-4000:])
    if child.returncode!=0:
        fail(5,'STRIPE_TEST_INTEGRATION_FAILED_CHECK_PRIVATE_JOURNAL')
    assert 'P5F_GUEST_STRIPE_TEST_PROVIDER=PASS' in child.stdout
    assert 'P5F_STRIPE_CANCEL_AND_GET=PASS' in child.stdout
    assert 'P5F_OPS_RECONCILIATION_ALERT=PASS' in child.stdout
    assert 'P5F_FINANCE_OUTBOX_EMPTY=PASS' in child.stdout
    assert 'P5F_FUNDS_CAPTURED=0' in child.stdout
    print('P5F_REAL_STRIPE_GUEST_E2E_RESULT=PASS')
except subprocess.TimeoutExpired:
    fail(6,'TIMEOUT_UNKNOWN_REMOTE_STATE_MANUAL_REVIEW_REQUIRED')
finally:
    del sk, pk, configs, env

print('LIVE_PAYMENTS=ZERO')
print('KEY_VALUES_PRINTED=NO')
