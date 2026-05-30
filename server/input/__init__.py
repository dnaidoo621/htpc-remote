import os
import logging

from .base import InputBackend

logger = logging.getLogger(__name__)


def get_backend() -> InputBackend:
    session = os.environ.get("XDG_SESSION_TYPE", "x11").lower()
    logger.info("Detected session type: %s", session)

    if session == "wayland":
        return _init_wayland()
    return _init_x11()


def _init_x11() -> InputBackend:
    from .x11 import X11Backend
    logger.info("Using X11 input backend (pynput)")
    return X11Backend()


def _init_wayland() -> InputBackend:
    try:
        import evdev  # noqa: F401
        if _uinput_accessible():
            from .wayland import WaylandBackend
            logger.info("Using Wayland input backend (evdev/uinput)")
            return WaylandBackend()
    except ImportError:
        pass

    logger.warning(
        "evdev/uinput not available — falling back to X11 backend via XWayland. "
        "Run install.sh to configure uinput permissions for full Wayland support."
    )
    from .x11 import X11Backend
    return X11Backend()


def _uinput_accessible() -> bool:
    import stat
    try:
        s = os.stat("/dev/uinput")
        return bool(s.st_mode & (stat.S_IWGRP | stat.S_IWOTH | stat.S_IWUSR))
    except OSError:
        return False
