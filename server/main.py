import logging
import threading

import uvicorn

from .app import create_app
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


def start() -> None:
    state = AppState()
    backend = get_backend()

    local_ip = get_local_ip()
    state.server_url = f"http://{local_ip}:{PORT}"
    logger.info("Server URL: %s", state.server_url)

    app = create_app(backend, state)

    server_thread = threading.Thread(
        target=uvicorn.run,
        kwargs={"app": app, "host": HOST, "port": PORT, "log_level": "warning"},
        daemon=True,
        name="uvicorn",
    )
    server_thread.start()
    logger.info("Server started on port %d", PORT)

    try:
        run_overlay(state)  # blocks in main thread (GTK main loop)
    finally:
        backend.cleanup()
