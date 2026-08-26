"""
Device registry — loads configured devices from disk.

Config lives at ~/.config/htpc-remote/devices.json (override with
HTPC_REMOTE_DEVICES).  Absent or malformed config just means no extra
devices; the HTPC controls itself exactly as before.
"""
import json
import logging
import os

from .base import DeviceBackend

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = os.path.expanduser("~/.config/htpc-remote/devices.json")


class DeviceRegistry:

    def __init__(self, devices: list[DeviceBackend] | None = None,
                 path: str | None = None) -> None:
        self._devices: dict[str, DeviceBackend] = {d.id: d for d in (devices or [])}
        self.path = path

    def __len__(self) -> int:
        return len(self._devices)

    def get(self, device_id: str) -> DeviceBackend | None:
        return self._devices.get(device_id)

    def describe_all(self) -> list[dict]:
        return [d.describe() for d in self._devices.values()]

    def reload(self) -> None:
        """Rebuild from disk in place, so existing references stay valid."""
        fresh = load_registry(self.path)
        self.cleanup()
        self._devices = fresh._devices
        logger.info("Device registry reloaded — %d device(s)", len(self._devices))

    def raw_entries(self) -> list[dict]:
        """The on-disk config, secrets included. Never send this to a client."""
        if not self.path or not os.path.exists(self.path):
            return []
        try:
            with open(self.path) as f:
                return json.load(f).get("devices", [])
        except (OSError, json.JSONDecodeError):
            return []

    def cleanup(self) -> None:
        for d in self._devices.values():
            try:
                d.cleanup()
            except Exception as e:
                logger.debug("cleanup failed for %s: %s", d.id, e)


def load_registry(path: str | None = None) -> DeviceRegistry:
    path = path or os.environ.get("HTPC_REMOTE_DEVICES", DEFAULT_CONFIG)
    if not os.path.exists(path):
        logger.info("No device config at %s — add one from the app's Setup screen.", path)
        return DeviceRegistry(path=path)

    try:
        with open(path) as f:
            cfg = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.error("Could not read device config %s: %s", path, e)
        return DeviceRegistry(path=path)

    devices: list[DeviceBackend] = []
    for entry in cfg.get("devices", []):
        dev = _build(entry, os.path.dirname(path))
        if dev:
            devices.append(dev)
            logger.info("Device ready: %s (%s)", dev.name, dev.id)

    return DeviceRegistry(devices, path=path)


def _build(entry: dict, config_dir: str) -> DeviceBackend | None:
    kind = entry.get("type")
    try:
        if kind == "tuya_ir":
            from .tuya_ir import TuyaIRDevice
            codes_path = _codes_path(entry.get("codes_file"), config_dir)
            return TuyaIRDevice(
                id=entry["id"],
                name=entry.get("name", entry["id"]),
                hub_id=entry["hub_id"],
                remote_id=entry["remote_id"],
                category_id=entry.get("category_id", 2),
                local_key=entry.get("local_key"),
                host=entry.get("host"),
                version=entry.get("version", 3.5),
                cloud=entry.get("cloud"),
                codes=_load_codes(codes_path),
                codes_path=codes_path,
                local_control=entry.get("local_control", True),
            )
    except KeyError as e:
        logger.error("Device %r missing required field %s", entry.get("id"), e)
        return None
    except Exception as e:
        logger.error("Could not build device %r: %s", entry.get("id"), e)
        return None

    logger.warning("Unknown device type %r", kind)
    return None


def _codes_path(filename: str | None, config_dir: str) -> str | None:
    """Where learned codes live — relative names sit beside the config."""
    if not filename:
        return None
    return filename if os.path.isabs(filename) else os.path.join(config_dir, filename)


def _load_codes(path: str | None) -> dict[str, str]:
    """Learned IR codes, if any have been captured yet."""
    if not path:
        return {}
    try:
        with open(path) as f:
            codes = json.load(f)
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Could not read IR codes %s: %s", path, e)
        return {}

    if not isinstance(codes, dict):
        logger.warning("Ignoring %s — expected an object of action -> code", path)
        return {}

    # Drop anything unusable. Earlier versions could persist tinytuya's error
    # dict as if it were a code; leaving those in would keep the local
    # transport broken for that button after an upgrade.
    from .tuya_ir import valid_code
    good = {k: v for k, v in codes.items() if valid_code(v)}
    if len(good) != len(codes):
        bad = sorted(set(codes) - set(good))
        logger.warning("Discarded %d unusable IR code(s) from %s: %s",
                       len(bad), path, ", ".join(bad))
    if good:
        logger.info("Loaded %d learned IR code(s) from %s", len(good), path)
    return good
