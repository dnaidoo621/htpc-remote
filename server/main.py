import logging
import socket
import threading
import time

import uvicorn

from .app import create_app
from .devices import load_registry
from .input import get_backend
from .network import get_local_ip
from .overlay import run_overlay
from .state import AppState

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 8765


def _port_in_use(host: str, port: int) -> bool:
    """
    True if something is already listening. SO_REUSEADDR only forgives
    TIME_WAIT, so a live listener still makes this bind fail — which is
    exactly what we want to detect.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
        except OSError:
            return True
    return False


def start() -> None:
    # Check before doing any setup work. Without this, uvicorn fails to bind
    # inside its daemon thread, that thread dies, and the GTK main loop keeps
    # the process alive forever — systemd reports the unit "active" while no
    # server is listening, and Restart= respawns it in a loop.
    if _port_in_use(HOST, PORT):
        logger.error(
            "Port %d is already in use — another instance is probably running.",
            PORT,
        )
        logger.error("Find it with:  ss -tlnp | grep %d", PORT)
        logger.error(
            "If you have both a system and a per-user systemd unit enabled, "
            "disable one:  sudo systemctl --global disable htpc-remote"
        )
        return  # exit 0 — restarting cannot resolve a port conflict

    state = AppState()
    backend = get_backend()
    devices = load_registry()
    if len(devices):
        logger.info("Loaded %d controllable device(s)", len(devices))

    local_ip = get_local_ip()
    state.server_url = f"http://{local_ip}:{PORT}"
    logger.info("Server URL: %s", state.server_url)

    app = create_app(backend, state, devices)

    server_thread = threading.Thread(
        target=uvicorn.run,
        kwargs={"app": app, "host": HOST, "port": PORT, "log_level": "warning"},
        daemon=True,
        name="uvicorn",
    )
    server_thread.start()

    # Confirm it actually came up. uvicorn reports failures on its own thread,
    # so without this a dead server would leave the process running the overlay
    # loop and looking healthy to systemd.
    for _ in range(50):  # up to ~5s
        if _port_in_use(HOST, PORT):
            break
        if not server_thread.is_alive():
            logger.error("Server thread exited during startup — see errors above.")
            backend.cleanup()
            devices.cleanup()
            return
        time.sleep(0.1)
    else:
        logger.error("Server did not start listening on port %d — giving up.", PORT)
        backend.cleanup()
        devices.cleanup()
        return

    logger.info("Server started on port %d", PORT)

    try:
        run_overlay(state)  # blocks in main thread (GTK main loop)
    finally:
        backend.cleanup()
        devices.cleanup()
