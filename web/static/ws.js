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
  const listeners = { connect: [], disconnect: [] };

  /* ── subscription helper ── */
  function on(event, fn) {
    listeners[event].push(fn);
    return () => { listeners[event] = listeners[event].filter((f) => f !== fn); };
  }
  function emit(event) { listeners[event].forEach((f) => f()); }

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
    ws.onmessage = () => {}; // reserved for future server→client events
  }
  connect();

  return {
    onConnect:    (fn) => on('connect', fn),
    onDisconnect: (fn) => on('disconnect', fn),
    isConnected:  ()  => connected,

    send(obj) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    },
    queueMove,
    queueScroll,
  };
})();
