import shutil
import subprocess
import time

from evdev import UInput, ecodes as e

from .base import InputBackend

_KEY_MAP: dict[str, int] = {
    # media
    "play_pause":  e.KEY_PLAYPAUSE,
    "stop":        e.KEY_STOPCD,
    "next":        e.KEY_NEXTSONG,
    "prev":        e.KEY_PREVIOUSSONG,
    "volume_up":   e.KEY_VOLUMEUP,
    "volume_down": e.KEY_VOLUMEDOWN,
    "mute":        e.KEY_MUTE,
    "seek_back":   e.KEY_REWIND,
    "seek_fwd":    e.KEY_FASTFORWARD,
    # system
    "sleep":       e.KEY_SLEEP,
    "fullscreen":  e.KEY_F11,
    # navigation
    "up":          e.KEY_UP,
    "down":        e.KEY_DOWN,
    "left":        e.KEY_LEFT,
    "right":       e.KEY_RIGHT,
    "ok":          e.KEY_ENTER,
    "esc":         e.KEY_ESC,
    "tab":         e.KEY_TAB,
    "backspace":   e.KEY_BACKSPACE,
    "enter":       e.KEY_ENTER,
}

_BTN_MAP: dict[str, int] = {
    "left":   e.BTN_LEFT,
    "right":  e.BTN_RIGHT,
    "middle": e.BTN_MIDDLE,
}

_SCROLL_DIVISOR = 30.0
_CLICK_DELAY = 0.05


class WaylandBackend(InputBackend):
    def __init__(self) -> None:
        caps = {
            e.EV_REL: [e.REL_X, e.REL_Y, e.REL_WHEEL, e.REL_HWHEEL],
            e.EV_KEY: list(set(_KEY_MAP.values())) + list(_BTN_MAP.values()),
        }
        self._ui = UInput(caps, name="htpc-remote")

    def move_mouse(self, dx: float, dy: float) -> None:
        self._ui.write(e.EV_REL, e.REL_X, int(dx))
        self._ui.write(e.EV_REL, e.REL_Y, int(dy))
        self._ui.syn()

    def click(self, button: str) -> None:
        btn = _BTN_MAP.get(button, e.BTN_LEFT)
        self._ui.write(e.EV_KEY, btn, 1)
        self._ui.syn()
        time.sleep(_CLICK_DELAY)
        self._ui.write(e.EV_KEY, btn, 0)
        self._ui.syn()

    def scroll(self, dy: float) -> None:
        # REL_WHEEL: positive = up; our protocol: positive = down, so negate
        ticks = int(-dy / _SCROLL_DIVISOR)
        if ticks:
            self._ui.write(e.EV_REL, e.REL_WHEEL, ticks)
            self._ui.syn()

    def type_text(self, text: str) -> None:
        # wtype is the lightest Wayland typing tool (no daemon required)
        if shutil.which("wtype"):
            subprocess.run(["wtype", text], check=False)
        elif shutil.which("ydotool"):
            subprocess.run(["ydotool", "type", "--", text], check=False)
        else:
            self._type_via_clipboard(text)

    def _type_via_clipboard(self, text: str) -> None:
        proc = subprocess.Popen(["wl-copy"], stdin=subprocess.PIPE)
        proc.communicate(text.encode())
        # Paste: Ctrl+V via our virtual device
        for code in [e.KEY_LEFTCTRL, e.KEY_V]:
            self._ui.write(e.EV_KEY, code, 1)
        self._ui.syn()
        time.sleep(0.05)
        for code in [e.KEY_V, e.KEY_LEFTCTRL]:
            self._ui.write(e.EV_KEY, code, 0)
        self._ui.syn()

    def press_key(self, key: str) -> None:
        k = _KEY_MAP.get(key)
        if k:
            self._ui.write(e.EV_KEY, k, 1)
            self._ui.syn()
            time.sleep(_CLICK_DELAY)
            self._ui.write(e.EV_KEY, k, 0)
            self._ui.syn()

    def cleanup(self) -> None:
        self._ui.close()
