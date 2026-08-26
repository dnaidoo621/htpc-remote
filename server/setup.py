"""
In-app device setup, so nobody has to touch a terminal or hand-edit JSON.

Guarded by a pairing code shown on the TV. Glide's whole access model is
"anyone who can scan the QR can drive the HTPC", which is fine for a remote
but not for a screen that shows cloud credentials — so configuring devices
additionally requires being able to read the TV.

The code gates who may *start* setup. It does not encrypt the LAN, so the
credentials still cross the network in the clear; that is documented in the
UI. Secrets are never sent back to the client once stored.
"""
import json
import logging
import os
import secrets
import tempfile
import time

logger = logging.getLogger(__name__)

CODE_TTL = 300      # how long a displayed pairing code stays valid (s)
TOKEN_TTL = 900     # how long an unlocked setup session lasts (s)
CLOUD_TIMEOUT = 20  # cap on any Tuya cloud call, so setup can't hang


class SetupSession:
    """Tracks the pairing code and the token it unlocks."""

    def __init__(self, state) -> None:
        self._state = state
        self._code: str | None = None
        self._code_at: float = 0.0
        self._token: str | None = None
        self._token_at: float = 0.0

    # ── pairing ────────────────────────────────────────────────────────── #

    def begin(self) -> None:
        """Generate a code and put it on the TV."""
        self._code = f"{secrets.randbelow(1_000_000):06d}"
        self._code_at = time.monotonic()
        self._state.start_setup(self._code)
        logger.info("Setup pairing code displayed on the overlay")

    def unlock(self, code: str) -> str | None:
        """Exchange a correct code for a session token."""
        if not self._code or time.monotonic() - self._code_at > CODE_TTL:
            return None
        # compare_digest so a wrong guess can't be timed character by character
        if not secrets.compare_digest(code.strip(), self._code):
            return None
        self._code = None
        self._state.end_setup()
        self._token = secrets.token_urlsafe(24)
        self._token_at = time.monotonic()
        return self._token

    def valid(self, token: str | None) -> bool:
        if not self._token or not token:
            return False
        if time.monotonic() - self._token_at > TOKEN_TTL:
            self._token = None
            return False
        return secrets.compare_digest(token, self._token)

    def end(self) -> None:
        self._code = None
        self._token = None
        self._state.end_setup()


# ── discovery ──────────────────────────────────────────────────────────── #

def scan_lan(seconds: int = 12) -> list[dict]:
    """Find Tuya devices broadcasting on the LAN. Blocking."""
    try:
        import tinytuya
    except ImportError:
        logger.warning("tinytuya not installed — LAN scan unavailable")
        return []
    try:
        found = tinytuya.deviceScan(verbose=False, maxretry=seconds)
    except Exception as e:
        logger.warning("LAN scan failed: %s", e)
        return []
    return [
        {
            "ip": info.get("ip"),
            "device_id": info.get("gwId") or info.get("id"),
            "version": float(info.get("version", 3.3) or 3.3),
            "product_key": info.get("productKey"),
        }
        for info in found.values()
        if info.get("gwId") or info.get("id")
    ]


def cloud_devices(region: str, api_key: str, api_secret: str,
                  any_device_id: str) -> tuple[list[dict], str | None]:
    """
    List the devices on a Tuya account. Returns (devices, error).
    `any_device_id` just identifies the account — use one found by scan_lan.
    """
    try:
        import tinytuya
    except ImportError:
        return [], "tinytuya is not installed on the server"

    try:
        cloud = tinytuya.Cloud(apiRegion=region, apiKey=api_key,
                               apiSecret=api_secret, apiDeviceID=any_device_id)
        result = cloud.getdevices(False)
    except Exception as e:
        logger.warning("Tuya cloud lookup failed: %s", e)
        return [], str(e)

    if isinstance(result, dict) and not result.get("success", True):
        return [], result.get("msg") or "Tuya rejected those credentials"
    if not isinstance(result, list):
        return [], "Unexpected response from Tuya"

    devices = [
        {
            "device_id": d.get("id"),
            "name": d.get("name") or d.get("id"),
            "category": d.get("category"),
            "product_name": d.get("product_name"),
            "local_key": d.get("key"),
            "ip": d.get("ip") or None,
            # IR blasters expose each configured remote as a sub-device
            "is_remote": bool(d.get("sub")),
            "parent": d.get("parent"),
        }
        for d in result
        if d.get("id")
    ]
    return devices, None


def remote_category_id(region: str, api_key: str, api_secret: str,
                       hub_id: str, remote_id: str) -> int:
    """The codeset's category, needed by the v2.0 send endpoint."""
    try:
        import tinytuya
        cloud = tinytuya.Cloud(apiRegion=region, apiKey=api_key,
                               apiSecret=api_secret, apiDeviceID=hub_id)
        r = cloud.cloudrequest(
            f"/v1.0/infrareds/{hub_id}/remotes/{remote_id}/keys", action="GET")
        if isinstance(r, dict) and r.get("success"):
            return int(r["result"].get("category_id", 2))
    except Exception as e:
        logger.debug("Could not read category_id: %s", e)
    return 2


# ── config writing ─────────────────────────────────────────────────────── #

REQUIRED = ("id", "type")


def validate(entry: dict) -> str | None:
    """Return an error string, or None if the entry is usable."""
    for f in REQUIRED:
        if not entry.get(f):
            return f"missing '{f}'"
    if entry["type"] != "tuya_ir":
        return f"unsupported type '{entry['type']}'"
    for f in ("hub_id", "remote_id"):
        if not entry.get(f):
            return f"missing '{f}'"
    if not entry.get("cloud") and not (entry.get("host") and entry.get("local_key")):
        return "needs either cloud credentials or host + local_key"
    if entry.get("cloud"):
        for f in ("region", "api_key", "api_secret"):
            if not entry["cloud"].get(f):
                return f"cloud config missing '{f}'"
    return None


def save_config(entries: list[dict], path: str) -> None:
    """Write devices.json atomically at 0600 — it holds credentials."""
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    os.chmod(d, 0o700)
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump({"devices": entries}, f, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    logger.info("Wrote %d device(s) to %s", len(entries), path)


def redact(entries: list[dict]) -> list[dict]:
    """Config safe to hand back to a browser — no secrets."""
    out = []
    for e in entries:
        c = {k: v for k, v in e.items() if k not in ("local_key", "cloud")}
        c["has_local_key"] = bool(e.get("local_key"))
        c["has_cloud"] = bool(e.get("cloud"))
        if e.get("cloud"):
            c["cloud_region"] = e["cloud"].get("region")
        out.append(c)
    return out
