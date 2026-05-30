import json
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from .input.base import InputBackend
from .network import generate_qr_bytes
from .state import AppState

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent.parent / "web"


def create_app(backend: InputBackend, state: AppState) -> FastAPI:
    app = FastAPI(title="HTPC Remote")

    @app.get("/qr.png")
    async def qr_image() -> Response:
        data = generate_qr_bytes(state.server_url)
        return Response(content=data, media_type="image/png")

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "clients": state.client_count}

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket) -> None:
        await ws.accept()
        state.client_connected()
        logger.info("Client connected — total: %d", state.client_count)

        try:
            await ws.send_text(json.dumps({"type": "connected"}))
            async for raw in ws.iter_text():
                await _handle_message(raw, backend)
        except WebSocketDisconnect:
            pass
        finally:
            state.client_disconnected()
            logger.info("Client disconnected — total: %d", state.client_count)

    # Serve the mobile web UI — must come after API routes
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

    return app


async def _handle_message(raw: str, backend: InputBackend) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON from client: %s", raw[:120])
        return

    t = msg.get("type")

    if t == "mouse_move":
        backend.move_mouse(msg.get("dx", 0), msg.get("dy", 0))

    elif t == "mouse_click":
        backend.click(msg.get("button", "left"))

    elif t == "scroll":
        backend.scroll(msg.get("dy", 0))

    elif t == "key":
        backend.press_key(msg.get("key", ""))

    elif t == "text":
        text = msg.get("text", "")
        if text:
            backend.type_text(text)

    elif t == "launch":
        app = msg.get("app", "")
        if app:
            backend.launch_app(app)

    else:
        logger.debug("Unknown message type: %s", t)
