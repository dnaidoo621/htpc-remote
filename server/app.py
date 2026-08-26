import json
import logging
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from . import setup as setup_mod
from .devices import DeviceRegistry
from .input.base import InputBackend
from .network import generate_qr_bytes
from .state import AppState

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent.parent / "web"


def create_app(
    backend: InputBackend,
    state: AppState,
    devices: DeviceRegistry | None = None,
) -> FastAPI:
    app = FastAPI(title="HTPC Remote")
    devices = devices or DeviceRegistry()

    @app.get("/qr.png")
    async def qr_image() -> Response:
        data = generate_qr_bytes(state.server_url)
        return Response(content=data, media_type="image/png")

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "clients": state.client_count}

    @app.get("/devices")
    async def device_list() -> dict:
        return {"devices": devices.describe_all()}

    # ── setup ──────────────────────────────────────────────────────────── #
    # Gated by a pairing code shown on the TV: anyone who scans the QR can
    # drive the HTPC, but only someone who can see the screen may configure
    # devices or enter cloud credentials.

    session = setup_mod.SetupSession(state)

    def _auth(request: Request) -> None:
        if not session.valid(request.headers.get("x-setup-token")):
            raise HTTPException(status_code=401, detail="setup session expired")

    @app.post("/setup/begin")
    async def setup_begin() -> dict:
        session.begin()
        return {"status": "code_displayed"}

    @app.post("/setup/unlock")
    async def setup_unlock(body: dict = Body(...)) -> dict:
        token = session.unlock(str(body.get("code", "")))
        if not token:
            raise HTTPException(status_code=403, detail="wrong or expired code")
        return {"token": token}

    @app.post("/setup/end")
    async def setup_end() -> dict:
        session.end()
        return {"status": "ended"}

    @app.get("/setup/config")
    async def setup_config(request: Request) -> dict:
        _auth(request)
        return {"devices": setup_mod.redact(devices.raw_entries())}

    @app.post("/setup/scan")
    async def setup_scan(request: Request) -> dict:
        _auth(request)
        return {"found": await run_in_threadpool(setup_mod.scan_lan, 12)}

    @app.post("/setup/cloud")
    async def setup_cloud(request: Request, body: dict = Body(...)) -> dict:
        _auth(request)
        found, err = await run_in_threadpool(
            setup_mod.cloud_devices,
            body.get("region", "eu"), body.get("api_key", ""),
            body.get("api_secret", ""), body.get("device_id", ""),
        )
        if err:
            raise HTTPException(status_code=400, detail=err)
        return {"devices": found}

    @app.post("/setup/save")
    async def setup_save(request: Request, body: dict = Body(...)) -> dict:
        _auth(request)
        entries = body.get("devices")
        if not isinstance(entries, list):
            raise HTTPException(status_code=400, detail="'devices' must be a list")
        for e in entries:
            err = setup_mod.validate(e)
            if err:
                raise HTTPException(
                    status_code=400,
                    detail=f"device '{e.get('id', '?')}': {err}")
        if not devices.path:
            raise HTTPException(status_code=500, detail="no config path configured")
        try:
            await run_in_threadpool(setup_mod.save_config, entries, devices.path)
            await run_in_threadpool(devices.reload)
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"could not save: {e}")
        return {"status": "saved", "devices": devices.describe_all()}

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket) -> None:
        await ws.accept()
        state.client_connected()
        logger.info("Client connected — total: %d", state.client_count)

        try:
            # Tell the client which devices exist so it can build its tabs.
            await ws.send_text(json.dumps({
                "type": "connected",
                "devices": devices.describe_all(),
            }))
            async for raw in ws.iter_text():
                await _handle_message(raw, backend, devices, ws)
        except WebSocketDisconnect:
            pass
        finally:
            state.client_disconnected()
            logger.info("Client disconnected — total: %d", state.client_count)

    # Serve the mobile web UI — must come after API routes
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

    return app


async def _handle_message(
    raw: str,
    backend: InputBackend,
    devices: DeviceRegistry,
    ws: WebSocket | None = None,
) -> None:
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

    elif t == "device":
        device = devices.get(msg.get("device", ""))
        action = msg.get("action", "")
        if not device:
            logger.warning("No such device: %s", msg.get("device"))
        elif action:
            # IR/cloud sends block for up to a few hundred ms — keep them
            # off the event loop so mouse movement stays smooth.
            await run_in_threadpool(device.send, action, msg.get("value"))

    elif t == "device_learn":
        await _handle_learn(msg, devices, ws)

    elif t == "device_seed":
        device = devices.get(msg.get("device", ""))
        brand = msg.get("brand", "")
        if device and brand and hasattr(device, "seed_known_codes"):
            n = await run_in_threadpool(device.seed_known_codes, brand)
            await _send(ws, {"type": "learn",
                             "state": "seeded" if n else "error",
                             "device": device.id, "action": brand, "count": n,
                             "message": None if n else f"no known codes for {brand}",
                             "learned": device.learned()})

    elif t == "device_forget":
        device = devices.get(msg.get("device", ""))
        action = msg.get("action", "")
        if device and action:
            await run_in_threadpool(device.forget, action)
            await _send(ws, {"type": "learn", "state": "forgotten",
                             "device": device.id, "action": action,
                             "learned": device.learned()})

    else:
        logger.debug("Unknown message type: %s", t)


async def _send(ws: WebSocket | None, payload: dict) -> None:
    if ws is None:
        return
    try:
        await ws.send_text(json.dumps(payload))
    except (WebSocketDisconnect, RuntimeError):
        pass


async def _handle_learn(
    msg: dict,
    devices: DeviceRegistry,
    ws: WebSocket | None,
) -> None:
    """Capture one press from a physical remote, reporting progress."""
    device = devices.get(msg.get("device", ""))
    action = msg.get("action", "")
    if not device or not action:
        await _send(ws, {"type": "learn", "state": "error",
                         "action": action, "message": "unknown device or action"})
        return

    timeout = max(5, min(int(msg.get("timeout", 30)), 60))
    # Tell the phone to prompt the user *before* we block on the capture.
    await _send(ws, {"type": "learn", "state": "waiting",
                     "device": device.id, "action": action, "timeout": timeout})

    ok = await run_in_threadpool(device.learn, action, timeout)

    await _send(ws, {
        "type": "learn",
        "state": "captured" if ok else "timeout",
        "device": device.id,
        "action": action,
        "learned": device.learned(),
    })
