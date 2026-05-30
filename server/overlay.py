"""
GTK3 overlay that shows the QR code on the HTPC screen.

Show policy:
  - Always visible on first startup (no device has ever connected).
  - Hides the moment a phone connects.
  - After the phone disconnects, starts a grace-period timer.
    If nobody reconnects within IDLE_TIMEOUT_SECONDS, the popup
    reappears so you can hand control to a different device.
  - Brief disconnects (locking the phone, switching apps) are
    silently absorbed — the popup stays hidden.

IDLE_TIMEOUT_SECONDS defaults to 2 hours and can be overridden
with the HTPC_REMOTE_IDLE_TIMEOUT environment variable.
"""
import logging
import os
import time
from typing import Optional

from .state import AppState

logger = logging.getLogger(__name__)

# How long after the last disconnect before the popup reappears.
# Override with env var (seconds).  Default: 2 hours.
IDLE_TIMEOUT_SECONDS: int = int(os.environ.get("HTPC_REMOTE_IDLE_TIMEOUT", 7200))


def run_overlay(state: AppState) -> None:
    """Blocking call — runs the GTK main loop."""
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        gi.require_version("GdkPixbuf", "2.0")
        from gi.repository import Gtk, GLib, GdkPixbuf
    except Exception as e:
        logger.warning("GTK not available (%s) — overlay disabled.", e)
        _run_terminal_fallback(state)
        return

    overlay = _QROverlay(state, Gtk, GLib, GdkPixbuf)
    overlay.show_all()
    Gtk.main()


class _QROverlay:
    def __init__(self, state: AppState, Gtk, GLib, GdkPixbuf) -> None:
        self._state = state
        self._Gtk = Gtk
        self._GLib = GLib
        self._GdkPixbuf = GdkPixbuf

        # Track whether any device has ever connected this session.
        # On first boot this is False → popup shows immediately.
        self._ever_connected: bool = False

        # GLib timer source ID for the idle-timeout countdown.
        # None means no timer is currently running.
        self._idle_timer_id: Optional[int] = None

        self._win = Gtk.Window(title="HTPC Remote")
        self._win.set_default_size(480, 540)
        self._win.set_position(Gtk.WindowPosition.CENTER)
        self._win.set_keep_above(True)
        self._win.set_decorated(False)
        self._win.connect("destroy", Gtk.main_quit)

        # Dark background via CSS
        css = b"""
        window {
            background-color: #111111;
        }
        .heading {
            color: #FFFFFF;
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .subtext {
            color: #888888;
            font-size: 14px;
            margin-top: 6px;
        }
        .status {
            color: #44CC88;
            font-size: 13px;
            margin-top: 12px;
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            self._win.get_screen(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        box.set_halign(Gtk.Align.CENTER)
        box.set_valign(Gtk.Align.CENTER)
        box.set_margin_top(32)
        box.set_margin_bottom(32)
        box.set_margin_start(32)
        box.set_margin_end(32)

        heading = Gtk.Label(label="Scan to connect")
        heading.get_style_context().add_class("heading")
        box.pack_start(heading, False, False, 0)

        self._qr_image = Gtk.Image()
        box.pack_start(self._qr_image, False, False, 8)

        self._url_label = Gtk.Label(label="")
        self._url_label.get_style_context().add_class("subtext")
        box.pack_start(self._url_label, False, False, 0)

        self._status_label = Gtk.Label(label="Waiting for connection…")
        self._status_label.get_style_context().add_class("status")
        box.pack_start(self._status_label, False, False, 0)

        self._win.add(box)

        state.subscribe(lambda s: GLib.idle_add(self._on_state_change, s))
        GLib.idle_add(self._load_qr)

    def show_all(self) -> None:
        self._win.show_all()

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _load_qr(self) -> bool:
        from .network import generate_qr_bytes
        url = self._state.server_url
        if not url:
            return False

        png = generate_qr_bytes(url)
        loader = self._GdkPixbuf.PixbufLoader.new_with_type("png")
        loader.write(png)
        loader.close()
        pixbuf = loader.get_pixbuf()
        pixbuf = pixbuf.scale_simple(300, 300, self._GdkPixbuf.InterpType.NEAREST)
        self._qr_image.set_from_pixbuf(pixbuf)
        self._url_label.set_text(url)
        return False

    def _show_popup(self) -> None:
        """Refresh QR + make the window visible."""
        self._load_qr()
        self._status_label.set_text("Waiting for connection…")
        self._win.show_all()

    def _cancel_idle_timer(self) -> None:
        """Cancel any pending idle-timeout countdown."""
        if self._idle_timer_id is not None:
            self._GLib.source_remove(self._idle_timer_id)
            self._idle_timer_id = None

    def _on_idle_timeout(self) -> bool:
        """
        Called by GLib after IDLE_TIMEOUT_SECONDS.
        Show the popup only if still nobody is connected.
        """
        self._idle_timer_id = None
        if self._state.client_count == 0:
            logger.info(
                "No device connected for %d s — showing QR popup.",
                IDLE_TIMEOUT_SECONDS,
            )
            self._show_popup()
        return False  # don't reschedule

    # ------------------------------------------------------------------ #
    #  State change handler (always called on the GTK main thread)        #
    # ------------------------------------------------------------------ #

    def _on_state_change(self, state: AppState) -> bool:
        if state.client_count > 0:
            # ── Device connected ──────────────────────────────────────────
            self._ever_connected = True
            self._cancel_idle_timer()
            self._win.hide()
        else:
            # ── Device disconnected (or never connected) ──────────────────
            if not self._ever_connected:
                # First startup — no device has ever connected.
                # Show the popup right away so the user knows how to connect.
                self._show_popup()
            else:
                # A device was connected but just dropped off.
                # Start the idle timer; the popup will reappear only after
                # IDLE_TIMEOUT_SECONDS of inactivity (default 2 hours).
                # Reconnecting before the timer fires cancels it silently.
                self._cancel_idle_timer()
                self._idle_timer_id = self._GLib.timeout_add_seconds(
                    IDLE_TIMEOUT_SECONDS,
                    self._on_idle_timeout,
                )
                logger.debug(
                    "Idle timer started — popup in %d s if nobody reconnects.",
                    IDLE_TIMEOUT_SECONDS,
                )
        return False


def _run_terminal_fallback(state: AppState) -> None:
    """
    When GTK is unavailable, print status to stdout and apply the same
    idle-timeout logic using a background threading.Timer.
    """
    import threading
    import time

    ever_connected = {"value": False}
    idle_timer: dict[str, Optional[threading.Timer]] = {"t": None}

    def _cancel():
        if idle_timer["t"] is not None:
            idle_timer["t"].cancel()
            idle_timer["t"] = None

    def _show_after_idle():
        if state.client_count == 0:
            print(f"\n[htpc-remote] No device for {IDLE_TIMEOUT_SECONDS}s — scan: {state.server_url}")

    def _on_change(s: AppState) -> None:
        if s.client_count > 0:
            ever_connected["value"] = True
            _cancel()
            print(f"\n[htpc-remote] Phone connected ({s.client_count} client(s))")
        else:
            if not ever_connected["value"]:
                print(f"\n[htpc-remote] Scan to connect: {s.server_url}")
            else:
                _cancel()
                idle_timer["t"] = threading.Timer(IDLE_TIMEOUT_SECONDS, _show_after_idle)
                idle_timer["t"].daemon = True
                idle_timer["t"].start()

    state.subscribe(_on_change)
    print(f"[htpc-remote] Waiting — scan: {state.server_url}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
