import logging
import subprocess
import time

from pynput import mouse as pmouse, keyboard as pkeyboard
from pynput.mouse import Button

from .base import InputBackend

logger = logging.getLogger(__name__)

# X keysyms for everything the phone can send.
#
# Key presses go straight to XTEST rather than through pynput's keyboard
# Controller. pynput's key events are silently dropped by Chromium/Electron
# apps (Stremio, Plex desktop, browsers in some states) while GTK and Qt apps
# accept them fine — so nav and media keys "mostly worked" and looked like an
# app problem. The same keycode sent with a raw XTEST fake_input is accepted
# by everything. The mouse stays on pynput, which has no such issue.
_KEYSYMS: dict[str, int] = {
    # media — XF86 keysyms, routed by the desktop to the focused player
    "play_pause":  0x1008FF14,   # XF86AudioPlay
    "stop":        0x1008FF15,   # XF86AudioStop
    "next":        0x1008FF17,   # XF86AudioNext
    "prev":        0x1008FF16,   # XF86AudioPrev
    "volume_up":   0x1008FF13,   # XF86AudioRaiseVolume
    "volume_down": 0x1008FF11,   # XF86AudioLowerVolume
    "mute":        0x1008FF12,   # XF86AudioMute
    "seek_back":   0x1008FF3E,   # XF86AudioRewind
    "seek_fwd":    0x1008FF97,   # XF86AudioForward
    # system
    "sleep":       0x1008FF2F,   # XF86Sleep
    "fullscreen":  0xFFC8,       # F11
    # navigation
    "up":          0xFF52,
    "down":        0xFF54,
    "left":        0xFF51,
    "right":       0xFF53,
    "ok":          0xFF0D,       # Return
    "enter":       0xFF0D,
    "esc":         0xFF1B,
    "tab":         0xFF09,
    "backspace":   0xFF08,
    # modifiers / letters used by app profiles below
    "shift":       0xFFE1,       # Shift_L
    "n":           0x6E,
}

# Per-app overrides, matched case-insensitively against the active window
# title. Most players honour the XF86 media keysyms via MPRIS; the ones here
# don't, and want their own documented shortcuts instead. A value is either a
# key name or a tuple of key names pressed together.
#
# Stremio: Shift+arrows seek 10s (plain arrows seek 20s, which the d-pad
# already sends), Shift+N is next episode, Esc leaves the player. Its MPRIS
# reports state but ignores commands and doesn't support seeking, so the
# XF86 rewind/forward keys are dead there.
_APP_PROFILES: dict[str, dict[str, str | tuple[str, ...]]] = {
    "stremio": {
        "seek_back": ("shift", "left"),
        "seek_fwd":  ("shift", "right"),
        "next":      ("shift", "n"),
        "stop":      "esc",
    },
}
_PROFILED_ACTIONS = {a for p in _APP_PROFILES.values() for a in p}

# How long an active-window lookup stays fresh. Media keys aren't rapid-fire,
# so one xdotool call per half-second is plenty and never hits mouse moves.
_WINDOW_CACHE_S = 0.5

_BUTTONS: dict[str, Button] = {
    "left":   Button.left,
    "right":  Button.right,
    "middle": Button.middle,
}

_SCROLL_DIVISOR = 10.0

# Chromium wants a real gap between press and release.
_KEY_HOLD_S = 0.02


class X11Backend(InputBackend):
    def __init__(self) -> None:
        self._mouse = pmouse.Controller()
        self._kb = pkeyboard.Controller()   # still used for type_text

        from Xlib import display
        from Xlib.ext import xtest
        self._display = display.Display()
        self._xtest = xtest
        self._keycodes: dict[str, int] = {}
        for name, keysym in _KEYSYMS.items():
            kc = self._display.keysym_to_keycode(keysym)
            if kc:
                self._keycodes[name] = kc
            else:
                logger.warning("No keycode for %s (keysym 0x%X) — key disabled", name, keysym)

        self._win_name = ""
        self._win_at = 0.0

    def _active_window(self) -> str:
        """Lower-cased title of the focused window, cached briefly."""
        now = time.monotonic()
        if now - self._win_at < _WINDOW_CACHE_S:
            return self._win_name
        try:
            r = subprocess.run(
                ["xdotool", "getactivewindow", "getwindowname"],
                capture_output=True, text=True, timeout=0.5,
            )
            self._win_name = r.stdout.strip().lower() if r.returncode == 0 else ""
        except Exception:
            self._win_name = ""
        self._win_at = now
        return self._win_name

    def _resolve(self, key: str) -> tuple[str, ...]:
        """Which physical key(s) to press for an action, honouring app profiles."""
        if key in _PROFILED_ACTIONS:
            title = self._active_window()
            for needle, overrides in _APP_PROFILES.items():
                if needle in title and key in overrides:
                    v = overrides[key]
                    return v if isinstance(v, tuple) else (v,)
        return (key,)

    def move_mouse(self, dx: float, dy: float) -> None:
        self._mouse.move(int(dx), int(dy))

    def click(self, button: str) -> None:
        self._mouse.click(_BUTTONS.get(button, Button.left))

    def scroll(self, dy: float) -> None:
        # pynput: positive dy = up; our protocol: positive = down, so negate
        self._mouse.scroll(0, -dy / _SCROLL_DIVISOR)

    def type_text(self, text: str) -> None:
        # pynput handles shift state and unicode for free-form text; the
        # Chromium issue above only bites for discrete key presses.
        self._kb.type(text)

    def press_key(self, key: str) -> None:
        from Xlib import X
        keys = [self._keycodes.get(k) for k in self._resolve(key)]
        if not keys or None in keys:
            return
        # Press in order (modifiers first), hold, release in reverse.
        for kc in keys:
            self._xtest.fake_input(self._display, X.KeyPress, kc)
        self._display.sync()
        time.sleep(_KEY_HOLD_S)
        for kc in reversed(keys):
            self._xtest.fake_input(self._display, X.KeyRelease, kc)
        self._display.sync()

    def cleanup(self) -> None:
        try:
            self._display.close()
        except Exception:
            pass
