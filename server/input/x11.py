from pynput import mouse as pmouse, keyboard as pkeyboard
from pynput.mouse import Button
from pynput.keyboard import KeyCode, Key

from .base import InputBackend

# XF86 keysyms — standard across all desktop environments on X11
_MEDIA_KEYS: dict[str, KeyCode | Key] = {
    # media
    "play_pause":  KeyCode.from_vk(0x1008FF14),
    "stop":        KeyCode.from_vk(0x1008FF15),
    "next":        KeyCode.from_vk(0x1008FF17),
    "prev":        KeyCode.from_vk(0x1008FF16),
    "volume_up":   KeyCode.from_vk(0x1008FF13),
    "volume_down": KeyCode.from_vk(0x1008FF11),
    "mute":        KeyCode.from_vk(0x1008FF12),
    "seek_back":   KeyCode.from_vk(0x1008FF3E),  # XF86AudioRewind
    "seek_fwd":    KeyCode.from_vk(0x1008FF97),  # XF86AudioForward
    # system
    "sleep":       KeyCode.from_vk(0x1008FF2F),  # XF86Sleep
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


class X11Backend(InputBackend):
    def __init__(self) -> None:
        self._mouse = pmouse.Controller()
        self._kb = pkeyboard.Controller()

    def move_mouse(self, dx: float, dy: float) -> None:
        self._mouse.move(int(dx), int(dy))

    def click(self, button: str) -> None:
        self._mouse.click(_BUTTONS.get(button, Button.left))

    def scroll(self, dy: float) -> None:
        # pynput: positive dy = up; our protocol: positive = down, so negate
        self._mouse.scroll(0, -dy / _SCROLL_DIVISOR)

    def type_text(self, text: str) -> None:
        self._kb.type(text)

    def press_key(self, key: str) -> None:
        k = _MEDIA_KEYS.get(key)
        if k:
            self._kb.press(k)
            self._kb.release(k)
