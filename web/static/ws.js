/* ws.js — WebSocket manager + client-side HTPC config
   Exposed on window.WS and window.HTPC
   Loaded before JSX so React components can read both immediately. */

window.HTPC = {
  sensitivity: 2.0,   // pointer speed multiplier
  scrollSpeed: 1.0,   // scroll speed multiplier
};

window.WS = (() => {
  let ws        = null;
  let connected = false;
  let devices   = [];   // extra controllable devices (TV, receiver…)
  const listeners = { connect: [], disconnect: [], devices: [] };

  /* ── subscription helper ── */
  function on(event, fn) {
    listeners[event].push(fn);
    return () => { listeners[event] = listeners[event].filter((f) => f !== fn); };
  }
  function emit(event, arg) { listeners[event].forEach((f) => f(arg)); }

  /* ── batched mouse-move (one send per animation frame) ── */
  let pending   = null;
  let frameQueued = false;

  function queueMove(dx, dy) {
    if (!pending) pending = { dx: 0, dy: 0 };
    pending.dx += dx;
    pending.dy += dy;
    if (!frameQueued) {
      frameQueued = true;
      requestAnimationFrame(() => {
        if (pending && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'mouse_move', ...pending }));
        }
        pending = null;
        frameQueued = false;
      });
    }
  }

  /* ── batched scroll (same pattern) ── */
  let pendingScroll = null;
  let scrollFrameQueued = false;

  function queueScroll(dy) {
    if (!pendingScroll) pendingScroll = { dy: 0 };
    pendingScroll.dy += dy;
    if (!scrollFrameQueued) {
      scrollFrameQueued = true;
      requestAnimationFrame(() => {
        if (pendingScroll && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'scroll', dy: pendingScroll.dy }));
        }
        pendingScroll = null;
        scrollFrameQueued = false;
      });
    }
  }

  /* ── connection ── */
  function connect() {
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen    = () => { connected = true;  emit('connect'); };
    ws.onclose   = () => { connected = false; emit('disconnect'); setTimeout(connect, 3000); };
    ws.onerror   = () => ws.close();
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'connected' && Array.isArray(msg.devices)) {
        devices = msg.devices;
        emit('devices', devices);
      }
    };
  }
  connect();

  return {
    onConnect:    (fn) => on('connect', fn),
    onDisconnect: (fn) => on('disconnect', fn),
    onDevices:    (fn) => on('devices', fn),
    isConnected:  ()  => connected,
    getDevices:   ()  => devices,

    send(obj) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    },
    /* Fire an action at a non-HTPC device (TV, receiver…). */
    sendDevice(device, action, value) {
      this.send({ type: 'device', device, action, value });
    },
    queueMove,
    queueScroll,
  };
})();
