"""
Tuya-based IR blaster (Vizia Smart IR, MOES, and the many other rebadges
that use the Smart Life app).

Two transports, tried in order:

  1. Local  — replays a raw base64 IR code straight to the hub over the LAN.
              Fast (~20 ms) and works with no internet, but the codes have to
              be learned from a physical remote first.
  2. Cloud  — asks Tuya to fire a key from the codeset the Smart Life app
              already configured.  No learning needed, but adds a round trip
              (~200-500 ms) and needs the IoT Core subscription to be live.

Library codesets (the ones you get by picking "LG" in the app) live on Tuya's
servers and are not downloadable, which is why the cloud transport exists at
all.  Learned codes land in the local file and silently take precedence.

local_control defaults to OFF, because a good number of these hubs are
cloud-only for infrared and there is no way to detect it from the protocol.
A Vizia Smart IR (category wnykq, protocol 3.5) was measured doing exactly
this: the session key negotiates, DP writes are accepted and acknowledged
with retcode=0 and an empty payload, and no infrared is ever emitted. Study
mode silently fails the same way, so capture never returns anything either,
while identical commands through the cloud drive the TV correctly.

Since a failed local write is indistinguishable from a successful one, the
only honest default is to trust the cloud and let anyone whose hub really
does support local control opt in with "local_control": true.  Teach is only
offered when local control is on, so the UI never shows a button that cannot
work.
"""
import json
import logging
import os
import tempfile
import threading
import time

from .base import (
    CAP_CHANNEL, CAP_INPUT, CAP_LEARN, CAP_MEDIA, CAP_NAV, CAP_POWER,
    CAP_VOLUME, DeviceBackend,
)

logger = logging.getLogger(__name__)

# tinytuya calls requests.get/request without a timeout, so a stalled network
# would hang a threadpool worker indefinitely. requests is only used by tinytuya
# in this process, so defaulting it globally is safe and contained.
HTTP_TIMEOUT = 15
_patched = False

# How long a button press waits for the hub before giving up.
SEND_WAIT = 3.0

# A real IR frame is a few hundred base64 chars decoding to dozens of pulses.
MIN_CODE_CHARS = 16
MIN_CODE_PULSES = 8


def valid_code(code) -> bool:
    """
    True if `code` is a usable base64 IR frame.

    receive_button() does not always return a string — on a bad capture it
    hands back tinytuya's error dict ({'Error': ..., 'Err': '904'}), which is
    truthy and has a len(). Storing one poisons the local transport, so
    everything gets checked before it is written.
    """
    if not isinstance(code, str) or len(code) < MIN_CODE_CHARS:
        return False
    try:
        from tinytuya.Contrib import IRRemoteControlDevice
        pulses = IRRemoteControlDevice.base64_to_pulses(code)
    except Exception:
        return False
    return bool(pulses) and len(pulses) >= MIN_CODE_PULSES


def ensure_http_timeout(seconds: int = HTTP_TIMEOUT) -> None:
    global _patched
    if _patched:
        return
    try:
        import requests
    except ImportError:
        return
    for name in ("get", "post", "request"):
        original = getattr(requests, name)

        def wrapper(*a, _orig=original, **kw):
            kw.setdefault("timeout", seconds)
            return _orig(*a, **kw)

        setattr(requests, name, wrapper)
    _patched = True
    logger.debug("Defaulted requests timeout to %ss", seconds)

# Normalised action -> (Tuya key name, Tuya key id).
# Key ids come from GET /v1.0/infrareds/{hub}/remotes/{remote}/keys.
TV_KEYS: dict[str, tuple[str, int]] = {
    # Power.  'power_on' is discrete (idempotent); 'power' is a toggle.
    "power":        ("Power", 1),
    "power_on":     ("power on", 5907),
    # Volume
    "volume_up":    ("Volume+", 50),
    "volume_down":  ("Volume-", 51),
    "mute":         ("mute", 106),
    # Navigation
    "up":           ("Up", 46),
    "down":         ("Down", 47),
    "left":         ("Left", 48),
    "right":        ("Right", 49),
    "ok":           ("OK", 42),
    "back":         ("Back", 116),
    "home":         ("Home", 136),
    "menu":         ("Menu", 45),
    "exit":         ("exit", 121),
    # Media
    "play":         ("play", 146),
    "pause":        ("pause", 166),
    "stop":         ("stop", 161),
    "rewind":       ("rewind", 141),
    "forward":      ("fast_forward", 151),
    "previous":     ("previous", 201),
    # Channels
    "channel_up":   ("Channel+", 43),
    "channel_down": ("Channel-", 44),
    # Source selection — all idempotent, unlike the input toggle
    "input":        ("input", 111),
    "hdmi1":        ("hdmi1", 2142),
    "hdmi2":        ("hdmi2", 2147),
    "hdmi3":        ("hdmi3", 2152),
    "hdmi4":        ("hdmi4", 6347),
    # Misc
    "info":         ("info", 211),
    "guide":        ("guide", 331),
    "settings":     ("settings", 10212),
    "netflix":      ("netflix", 3382),
}


class TuyaIRDevice(DeviceBackend):

    def __init__(
        self,
        id: str,
        name: str,
        hub_id: str,
        remote_id: str,
        category_id: int = 2,
        local_key: str | None = None,
        host: str | None = None,
        version: float = 3.5,
        cloud: dict | None = None,
        codes: dict[str, str] | None = None,
        codes_path: str | None = None,
        local_control: bool = False,
    ) -> None:
        self.id = id
        self.name = name
        self.capabilities = {
            CAP_POWER, CAP_VOLUME, CAP_NAV, CAP_MEDIA, CAP_INPUT, CAP_CHANNEL,
        }  # deliberately no CAP_POINTER — IR has no cursor

        self._hub_id = hub_id
        self._remote_id = remote_id
        self._category_id = category_id
        self._codes = codes or {}
        self._codes_path = codes_path
        self._lock = threading.Lock()  # one learn/send on the hub at a time

        self._cloud = self._init_cloud(cloud)
        self._local = (self._init_local(hub_id, host, local_key, version)
                       if local_control else None)

        # Learning needs a LAN connection; it never goes through the cloud.
        if self._local:
            self.capabilities.add(CAP_LEARN)

        if not self._cloud and not self._local:
            logger.warning("%s: no working transport — commands will no-op", name)

    # ── transport setup ────────────────────────────────────────────────── #

    def _init_cloud(self, cfg: dict | None):
        if not cfg:
            return None
        try:
            import tinytuya
            ensure_http_timeout()
            return tinytuya.Cloud(
                apiRegion=cfg["region"],
                apiKey=cfg["api_key"],
                apiSecret=cfg["api_secret"],
                apiDeviceID=self._hub_id,
            )
        except Exception as e:
            logger.warning("Tuya cloud transport unavailable: %s", e)
            return None

    def _init_local(self, hub_id, host, local_key, version):
        # Off by default — see the local_control note in the class docstring.
        # Needed to replay learned codes *and* to learn new ones, so connect
        # whenever we have credentials, even with no codes stored yet.
        if not (host and local_key):
            return None
        try:
            from tinytuya.Contrib import IRRemoteControlDevice
            dev = IRRemoteControlDevice(
                hub_id, host, local_key, version=version,
                control_type=2, persist=True,
            )
            dev.set_socketTimeout(5)
            return dev
        except Exception as e:
            logger.warning("Tuya local transport unavailable: %s", e)
            return None

    # ── sending ────────────────────────────────────────────────────────── #

    def actions(self) -> list[str]:
        return sorted(set(TV_KEYS) | set(self._codes))

    def learned(self) -> list[str]:
        return sorted(self._codes)

    def send(self, action: str, value: str | int | None = None) -> bool:
        # A capture holds the hub for up to a minute. Don't let button presses
        # from other phones pile up behind it — fail fast and say why.
        if not self._lock.acquire(timeout=SEND_WAIT):
            logger.info("%s: busy (learning?) — dropped %r", self.name, action)
            return False
        try:
            code = self._codes.get(action)
            if self._local and code:
                if self._send_local(code):
                    return True
                logger.debug("%s: local send failed for %r, trying cloud",
                             self.name, action)

            entry = TV_KEYS.get(action)
            if not entry:
                logger.warning("%s: unknown action %r", self.name, action)
                return False
            return self._send_cloud(*entry)
        finally:
            self._lock.release()

    # ── learning ───────────────────────────────────────────────────────── #

    def learn(self, action: str, timeout: int = 30) -> bool:
        """
        Capture one press from a physical remote and store it against
        `action`.  Purely local — the cloud is never involved, so a device
        learned this way keeps working if the Tuya subscription lapses.
        """
        if not self._local:
            logger.warning("%s: cannot learn without a LAN connection", self.name)
            return False

        # Two phones must not both drive the hub into study mode.
        if not self._lock.acquire(blocking=False):
            logger.info("%s: busy — refusing concurrent learn", self.name)
            return False
        try:
            try:
                code = self._capture(timeout)
            except Exception as e:
                logger.warning("%s: learn failed for %r: %s", self.name, action, e)
                return False

            if not valid_code(code):
                # Distinguish "nobody pressed anything" from "the hub answered
                # with something unusable" — they need different fixes.
                if isinstance(code, dict):
                    logger.warning(
                        "%s: hub returned an error instead of a code for %r: %s",
                        self.name, action,
                        code.get("Error") or code.get("Payload") or code)
                elif code:
                    logger.warning(
                        "%s: discarded malformed capture for %r (%r)",
                        self.name, action, str(code)[:60])
                else:
                    logger.info("%s: nothing captured for %r — was the remote "
                                "aimed at the hub, and does it have batteries?",
                                self.name, action)
                return False

            self._codes[action] = code
            self._persist()
            logger.info("%s: learned %r (%d chars)", self.name, action, len(code))
            return True
        finally:
            self._lock.release()

    # Data points the hub reports a freshly-learned code on.
    _DP_LEARNED_REPORT = "2"    # newer hardware (control_type 2)
    _DP_LEARNED_ID = "202"      # older hardware (control_type 1)

    def _capture(self, timeout: int) -> str | None:
        """
        Listen for one learned code.

        Not tinytuya's receive_button(): that breaks out of its listen loop on
        the first frame that isn't a dps message, and this hardware emits an
        error frame unprompted. Capture aborted instantly and returned the
        error dict, which then got stored as if it were a code. Ignore frames
        we don't recognise and keep listening until the clock runs out.
        """
        dev = self._local
        dev.study_end()      # clear any half-finished session

        # The hub buffers a learned code and replays it to the next listener.
        # Without draining, a press from a previous session gets attributed to
        # whichever button is being taught now — one captured 'up' was stored
        # as 'mute' this way. Discard anything already queued before listening.
        dev.set_socketTimeout(2)
        for _ in range(3):
            try:
                stale = dev._send_receive(None)
            except Exception:
                break
            if not isinstance(stale, dict) or "dps" not in stale:
                continue
            if any(stale["dps"].get(dp) for dp in
                   (self._DP_LEARNED_REPORT, self._DP_LEARNED_ID)):
                logger.debug("%s: discarded a buffered code before capture", self.name)

        dev.study_start()
        deadline = time.monotonic() + timeout
        try:
            while time.monotonic() < deadline:
                dev.set_socketTimeout(2)
                try:
                    frame = dev._send_receive(None)
                except Exception as e:
                    logger.debug("%s: listen frame raised %s", self.name, e)
                    continue
                if not isinstance(frame, dict) or "dps" not in frame:
                    continue          # timeout or an error frame — keep waiting
                dps = frame["dps"]
                for dp in (self._DP_LEARNED_REPORT, self._DP_LEARNED_ID):
                    if dps.get(dp):
                        return dps[dp]
        finally:
            try:
                dev.study_end()
            except Exception:
                pass
            dev.set_socketTimeout(5)
        return None

    def forget(self, action: str) -> bool:
        with self._lock:
            if self._codes.pop(action, None) is None:
                return False
            self._persist()
            logger.info("%s: forgot learned code for %r", self.name, action)
            return True

    def _persist(self) -> None:
        """Write codes atomically so a crash mid-write can't corrupt them."""
        if not self._codes_path:
            return
        try:
            d = os.path.dirname(self._codes_path) or "."
            os.makedirs(d, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
            with os.fdopen(fd, "w") as f:
                json.dump(self._codes, f, indent=2)
            os.replace(tmp, self._codes_path)
            os.chmod(self._codes_path, 0o600)
        except OSError as e:
            logger.error("%s: could not save codes to %s: %s",
                         self.name, self._codes_path, e)

    def _send_local(self, b64: str) -> bool:
        try:
            self._local.send_button(b64)
            return True
        except Exception as e:
            logger.debug("local IR send failed: %s", e)
            return False

    def _send_cloud(self, key: str, key_id: int) -> bool:
        if not self._cloud:
            return False
        base = f"/v2.0/infrareds/{self._hub_id}/remotes/{self._remote_id}"
        # v2.0 wants the codeset context; v1.0 infers it. Try the newer first.
        attempts = [
            (f"{base}/command",
             {"categoryId": self._category_id, "key": key, "keyId": key_id}),
            (f"/v1.0/infrareds/{self._hub_id}/remotes/{self._remote_id}/command",
             {"key": key}),
        ]
        for path, body in attempts:
            try:
                r = self._cloud.cloudrequest(path, post=body)
            except Exception as e:
                logger.debug("cloud send %s raised: %s", path, e)
                continue
            if isinstance(r, dict) and r.get("success"):
                return True
            logger.debug("cloud send %s -> %s", path,
                         r.get("msg") if isinstance(r, dict) else r)
        logger.warning("%s: all transports failed for key %r", self.name, key)
        return False
