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
  const listeners = { connect: [], disconnect: [], devices: [], learn: [] };

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

  /* ── connection ──
     iOS kills the socket the moment the screen locks or the app goes to the
     background, and the close event can arrive seconds late. So: retry fast
     at first, and reconnect *immediately* when the page comes back rather
     than waiting out a timer. */
  let retryDelay = 500;
  let retryTimer = null;

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(retryTimer);
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen    = () => { connected = true; retryDelay = 500; emit('connect'); };
    ws.onclose   = () => {
      connected = false; emit('disconnect');
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 3000);   // 0.5s → 1s → 2s → 3s
    };
    ws.onerror   = () => ws.close();
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'connected' && Array.isArray(msg.devices)) {
        devices = msg.devices;
        emit('devices', devices);
      } else if (msg.type === 'learn') {
        // Keep the cached device list's 'learned' array in step so the UI
        // can mark buttons without a round trip.
        if (Array.isArray(msg.learned)) {
          devices = devices.map((d) =>
            d.id === msg.device ? { ...d, learned: msg.learned } : d);
          emit('devices', devices);
        }
        emit('learn', msg);
      }
    };
  }
  connect();

  /* Reconnect the instant the app is visible again — don't wait for the
     late close event plus a backoff timer. */
  function reconnectNow() {
    retryDelay = 500;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect();
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnectNow(); });
  window.addEventListener('pageshow', reconnectNow);
  window.addEventListener('focus',    reconnectNow);
  window.addEventListener('online',   reconnectNow);

  /* ── screen wake lock ──
     Keep the phone from auto-locking while Glide is open, so the socket
     never drops in the first place. Needs a user gesture on iOS, and is
     released whenever the page is hidden, so re-acquire on both. Silently
     unsupported on older iOS — the reconnect logic above still covers it. */
  let wakeLock = null;
  async function holdScreen() {
    if (!('wakeLock' in navigator) || document.hidden) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* not allowed right now — try again on the next gesture */ }
  }
  document.addEventListener('pointerdown', () => { if (!wakeLock) holdScreen(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) holdScreen(); });

  return {
    onConnect:    (fn) => on('connect', fn),
    onDisconnect: (fn) => on('disconnect', fn),
    onDevices:    (fn) => on('devices', fn),
    onLearn:      (fn) => on('learn', fn),
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
    /* Capture this action from a physical remote; watch onLearn for progress. */
    learnDevice(device, action, timeout) {
      this.send({ type: 'device_learn', device, action, timeout });
    },
    forgetDevice(device, action) {
      this.send({ type: 'device_forget', device, action });
    },
    /* Fill the local code table from published codes — no remote needed. */
    seedDevice(device, brand) {
      this.send({ type: 'device_seed', device, brand });
    },
    queueMove,
    queueScroll,
  };
})();
