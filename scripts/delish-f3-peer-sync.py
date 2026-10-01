#!/usr/bin/env python3
import hashlib
import subprocess
from pathlib import Path

ENV_FILE = Path("/etc/orchidpay/delish-orchidpay-f3-relay.env")
RELAY_UNIT = "delish-orchidpay-f3-relay.service"

def output(args: list[str]) -> str:
    return subprocess.check_output(args, text=True).strip()

def running_delish_api_cgroup_hashes() -> list[str]:
    names = [
        name.strip()
        for name in output(["docker", "ps", "--format", "{{.Names}}"]).splitlines()
        if name.strip() == "delish-api" or name.strip().startswith("delish-api-")
    ]

    hashes: list[str] = []
    for name in names:
        try:
            pid = output(["docker", "inspect", "-f", "{{.State.Pid}}", name])
            if not pid or pid == "0":
                continue
            raw = Path(f"/proc/{pid}/cgroup").read_bytes()
            hashes.append(hashlib.sha256(raw).hexdigest())
        except Exception:
            continue
    return sorted(set(hashes))

def main() -> int:
    hashes = running_delish_api_cgroup_hashes()
    if not hashes:
        raise SystemExit("no_running_delish_api_peers")

    desired = "DELISH_ALLOWED_CGROUP_SHA256=" + ",".join(hashes) + "\n"
    current = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""

    if current == desired:
        print(f"peer_sync=unchanged peers={len(hashes)}")
        return 0

    temporary = ENV_FILE.with_name(ENV_FILE.name + ".tmp")
    temporary.write_text(desired, encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(ENV_FILE)

    subprocess.run(["systemctl", "try-restart", RELAY_UNIT], check=True)
    print(f"peer_sync=updated peers={len(hashes)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
