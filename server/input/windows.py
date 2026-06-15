import shutil
import subprocess
import sys

from pynput import mouse as pmouse, keyboard as pkeyboard
from pynput.mouse import Button
from pynput.keyboard import Key

from .base import InputBackend

# pynput.keyboard.Key.media_* are backed by Windows VK codes on win32:
#   media_play_pause → VK_MEDIA_PLAY_PAUSE (0xB3)
#   media_next       → VK_MEDIA_NEXT_TRACK (0xB0)
#   media_previous   → VK_MEDIA_PREV_TRACK (0xB1)
#   media_volume_up  → VK_VOLUME_UP        (0xAF)
#   media_volume_down→ VK_VOLUME_DOWN      (0xAE)
#   media_volume_mute→ VK_VOLUME_MUTE      (0xAD)
_MEDIA_KEYS: dict[str, Key] = {
    "play_pause":  Key.media_play_pause,
    "stop":        Key.media_play_pause,
    "next":        Key.media_next,
    "prev":        Key.media_previous,
    "volume_up":   Key.media_volume_up,
    "volume_down": Key.media_volume_down,
    "mute":        Key.media_volume_mute,
    # Arrow keys are the closest universal seek equivalent on Windows;
    # most media players (VLC, Kodi, MPV) use Left/Right for ±seek.
    "seek_back":   Key.left,
    "seek_fwd":    Key.right,
    "fullscreen":  Key.f11,
    # navigation
    "up":          Key.up,
    "down":        Key.down,
    "left":        Key.left,
    "right":       Key.right,
    "ok":          Key.enter,
    "esc":         Key.esc,
    "tab":         Key.tab,
    "backspace":   Key.backspace,
    "enter":       Key.enter,
}

_BUTTONS: dict[str, Button] = {
    "left":   Button.left,
    "right":  Button.right,
    "middle": Button.middle,
}

_SCROLL_DIVISOR = 10.0


class WindowsBackend(InputBackend):
    def __init__(self) -> None:
        self._mouse = pmouse.Controller()
        self._kb = pkeyboard.Controller()

    def move_mouse(self, dx: float, dy: float) -> None:
        self._mouse.move(int(dx), int(dy))

    def click(self, button: str) -> None:
        self._mouse.click(_BUTTONS.get(button, Button.left))

    def scroll(self, dy: float) -> None:
        # pynput: positive dy = up; our protocol: positive = down
        self._mouse.scroll(0, -dy / _SCROLL_DIVISOR)

    def type_text(self, text: str) -> None:
        self._kb.type(text)

    def press_key(self, key: str) -> None:
        if key == "sleep":
            # Suspend to RAM — rundll32 SetSuspendState(hibernate=0, force=1, disableWakeEvent=0)
            subprocess.Popen(
                ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
                start_new_session=True,
            )
            return

        k = _MEDIA_KEYS.get(key)
        if k:
            self._kb.press(k)
            self._kb.release(k)
