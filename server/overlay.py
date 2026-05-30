"""
GTK3 overlay that shows the QR code on the HTPC screen.
Hides when a phone connects; reappears when all phones disconnect.
Must run in the main thread (GTK requirement).
"""
import logging
import os
import io
from typing import Optional

from .state import AppState

logger = logging.getLogger(__name__)


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

    def _on_state_change(self, state: AppState) -> bool:
        if state.client_count > 0:
            self._win.hide()
        else:
            self._load_qr()
            self._status_label.set_text("Waiting for connection…")
            self._win.show_all()
        return False


def _run_terminal_fallback(state: AppState) -> None:
    """When GTK is unavailable, print the URL and block."""
    import time

    def _on_change(s: AppState) -> None:
        if s.client_count > 0:
            print(f"\n[htpc-remote] Phone connected ({s.client_count} client(s))")
        else:
            print(f"\n[htpc-remote] Scan to connect: {s.server_url}")

    state.subscribe(_on_change)
    print(f"[htpc-remote] Waiting — scan: {state.server_url}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
