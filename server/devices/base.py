"""
Controllable devices other than the HTPC itself — TVs, receivers, soundbars.

A device declares its capabilities; the phone UI reads them and renders only
the controls that device actually supports.  Adding a new device type
therefore needs no UI changes.
"""
from abc import ABC, abstractmethod

# Capability flags.  The UI keys its layout off these.
CAP_POWER  = "power"          # power on/off/toggle
CAP_VOLUME = "volume"         # volume up/down/mute
CAP_NAV    = "nav"            # d-pad + ok/back/home/menu
CAP_MEDIA  = "media"          # play/pause/stop/seek
CAP_INPUT  = "input_select"   # switch source (hdmi1…)
CAP_CHANNEL = "channel"       # channel up/down + digits
CAP_POINTER = "pointer"       # cursor movement (trackpad stays live)
CAP_TEXT   = "text"           # send arbitrary text
CAP_APPS   = "apps"           # launch apps by name
CAP_LEARN  = "learn"          # can capture codes from a physical remote


class DeviceBackend(ABC):
    """One controllable device."""

    id: str
    name: str
    capabilities: set[str]

    @abstractmethod
    def send(self, action: str, value: str | int | None = None) -> bool:
        """
        Perform a normalised action ('power_on', 'volume_up', 'hdmi1', …).
        Returns True if the command was dispatched.  Blocking — callers on the
        event loop must run this in a threadpool.
        """
        ...

    def actions(self) -> list[str]:
        """Every action this device accepts, for the UI to enable/disable."""
        return []

    def learned(self) -> list[str]:
        """Actions with a locally-stored code, so the UI can mark them."""
        return []

    def learn(self, action: str, timeout: int = 30) -> bool:
        """
        Put the device into learning mode and capture one command from a
        physical remote, storing it against `action`.  Blocking for up to
        `timeout` seconds — always call from a threadpool.
        """
        return False

    def forget(self, action: str) -> bool:
        """Drop a learned code, falling back to whatever else can serve it."""
        return False

    def describe(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "capabilities": sorted(self.capabilities),
            "actions": self.actions(),
            "learned": self.learned(),
        }

    def cleanup(self) -> None:
        pass
