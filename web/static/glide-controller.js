const { useState, useRef, useEffect, useCallback } = React;
const glass = {
  background: "var(--g-glass)",
  backdropFilter: "blur(var(--g-blur)) saturate(160%)",
  WebkitBackdropFilter: "blur(var(--g-blur)) saturate(160%)",
  border: "0.75px solid var(--g-line)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), var(--g-shadow-1)"
};
function GBtn({ children, onPress, flex, style = {}, active, accent, danger, ...rest }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onPointerDown: (e) => {
        e.preventDefault();
        onPress && onPress();
      },
      className: "g-press",
      style: {
        flex,
        appearance: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--g-text)",
        borderRadius: "var(--g-r-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...glass,
        ...active ? { background: "var(--g-accent-dim)", borderColor: "var(--g-accent)", color: "var(--g-accent)" } : {},
        ...accent ? { background: "var(--g-accent)", borderColor: "transparent", color: "#04211f", boxShadow: "0 4px 18px var(--g-glow)" } : {},
        ...danger ? { background: "oklch(0.70 0.16 25 / 0.12)", border: "0.75px solid oklch(0.70 0.16 25 / 0.5)", color: "var(--g-danger)" } : {},
        ...style
      },
      ...rest
    },
    children
  );
}
const seg = (on) => ({
  flex: 1,
  padding: "8px 0",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--g-ui)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.2,
  background: on ? "var(--g-glass-hi)" : "transparent",
  color: on ? "var(--g-text)" : "var(--g-text-3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  transition: "all .15s"
});
function TabBar({ tabs, active, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 4,
    padding: 4,
    marginTop: 12,
    borderRadius: 16,
    background: "rgba(0,0,0,0.3)",
    position: "relative",
    zIndex: 2,
    flexShrink: 0
  } }, tabs.map(([k, label, icon]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: k,
      onClick: () => onChange(k),
      style: {
        ...seg(active === k),
        flexDirection: "column",
        gap: 3,
        padding: "8px 0 6px",
        fontSize: 10.5,
        letterSpacing: 0.3
      }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: 19 }),
    label
  )));
}
function Section({ centred, children }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    justifyContent: centred ? "center" : "flex-start",
    paddingTop: 4
  } }, children);
}
function send(obj) {
  window.WS.send(obj);
}
function key(k) {
  send({ type: "key", key: k });
}
const _qs = new URLSearchParams(location.search);
const initialTab = (want) => _qs.get("tab") && want.includes(_qs.get("tab")) ? _qs.get("tab") : null;
const initialDevice = () => _qs.get("device") || null;
function GlideController({ device = "Living-Room PC" }) {
  const [vol, setVol] = useState(42);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tab, setTab] = useState(initialTab(["pad", "media", "nav", "apps", "tune"]) || "pad");
  const [kb, setKb] = useState(false);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [scrubY, setScrubY] = useState(null);
  const [wsOk, setWsOk] = useState(window.WS.isConnected());
  const [uiBright, setUiBright] = useState(100);
  const [sens, setSens] = useState(60);
  const [scrollSpd, setScrollSpd] = useState(50);
  const [devices, setDevices] = useState(window.WS.getDevices());
  const [activeDev, setActiveDev] = useState(initialDevice());
  const [setup, setSetup] = useState(false);
  const tRef = useRef(0);
  const hiddenInput = useRef(null);
  useEffect(() => {
    const off1 = window.WS.onConnect(() => setWsOk(true));
    const off2 = window.WS.onDisconnect(() => setWsOk(false));
    const off3 = window.WS.onDevices(setDevices);
    return () => {
      off1();
      off2();
      off3();
    };
  }, []);
  useEffect(() => {
    if (devices.length && activeDev && !devices.some((d) => d.id === activeDev)) setActiveDev(null);
  }, [devices, activeDev]);
  const dev = devices.find((d) => d.id === activeDev) || null;
  useEffect(() => {
    window.HTPC.sensitivity = 0.5 + sens / 100 * 3.5;
  }, [sens]);
  useEffect(() => {
    window.HTPC.scrollSpeed = 0.3 + scrollSpd / 100 * 2.7;
  }, [scrollSpd]);
  useEffect(() => {
    document.getElementById("app-root").style.filter = `brightness(${uiBright}%)`;
  }, [uiBright]);
  const flash = useCallback((t) => {
    tRef.current += 1;
    const id = tRef.current;
    setToast({ t, id });
    setTimeout(() => setToast((cur) => cur && cur.id === id ? null : cur), 1400);
  }, []);
  const padRef = useRef(null);
  const down = useRef(null);
  const onPadDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = padRef.current.getBoundingClientRect();
    down.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, lastX: e.clientX, lastY: e.clientY };
    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onPadMove = (e) => {
    if (!down.current) return;
    const r = padRef.current.getBoundingClientRect();
    const dx = e.clientX - down.current.x;
    const dy = e.clientY - down.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) down.current.moved = true;
    const incX = (e.clientX - down.current.lastX) * (window.HTPC.sensitivity || 2);
    const incY = (e.clientY - down.current.lastY) * (window.HTPC.sensitivity || 2);
    down.current.lastX = e.clientX;
    down.current.lastY = e.clientY;
    if (down.current.moved) window.WS.queueMove(incX, incY);
    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onPadUp = (e) => {
    if (!down.current) return;
    const r = padRef.current.getBoundingClientRect();
    if (!down.current.moved && Date.now() - down.current.t < 280) {
      send({ type: "mouse_click", button: "left" });
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((rs) => rs.filter((p) => p.id !== id)), 480);
      flash("Left click");
    }
    down.current = null;
    setTimeout(() => setCursor(null), 600);
  };
  const stripRef = useRef(null);
  const sdown = useRef(null);
  const onStripDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = stripRef.current.getBoundingClientRect();
    sdown.current = { y: e.clientY, acc: 0 };
    setScrubY(e.clientY - r.top);
  };
  const onStripMove = (e) => {
    if (!sdown.current) return;
    const r = stripRef.current.getBoundingClientRect();
    setScrubY(e.clientY - r.top);
    const dy = e.clientY - sdown.current.y;
    sdown.current.y = e.clientY;
    if (Math.abs(dy) > 1) window.WS.queueScroll(dy * (window.HTPC.scrollSpeed || 1));
    sdown.current.acc += dy;
    if (Math.abs(sdown.current.acc) > 26) {
      flash(sdown.current.acc > 0 ? "Scroll \u2193" : "Scroll \u2191");
      sdown.current.acc = 0;
    }
  };
  const onStripUp = () => {
    sdown.current = null;
    setTimeout(() => setScrubY(null), 500);
  };
  const SECTIONS = [
    ["pad", "Pad", "cursor"],
    ["media", "Media", "play"],
    ["nav", "Nav", "ok"],
    ["apps", "Apps", "apps"],
    ["tune", "Tune", "sliders"]
  ];
  const volIcon = muted ? "mute" : vol < 38 ? "volLow" : "volume";
  return /* @__PURE__ */ React.createElement("div", { className: "g-app", style: {
    position: "absolute",
    inset: 0,
    background: "var(--g-bg)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    paddingLeft: "calc(env(safe-area-inset-left, 0px) + 14px)",
    paddingRight: "calc(env(safe-area-inset-right, 0px) + 14px)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: -140,
    left: "50%",
    transform: "translateX(-50%)",
    width: 360,
    height: 300,
    background: "radial-gradient(circle, var(--g-accent-dim), transparent 70%)",
    filter: "blur(20px)",
    pointerEvents: "none"
  } }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "0 4px 12px", position: "relative", zIndex: 2 } }, /* @__PURE__ */ React.createElement("span", { className: wsOk ? "g-live-dot" : "", style: {
    width: 9,
    height: 9,
    borderRadius: 999,
    flexShrink: 0,
    background: wsOk ? "var(--g-accent)" : "var(--g-warn)",
    transition: "background .4s"
  } }), /* @__PURE__ */ React.createElement("div", { style: { lineHeight: 1.15 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 600 } }, device), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { fontSize: 10.5, color: "var(--g-text-3)", letterSpacing: 0.3 } }, wsOk ? `connected \xB7 ${location.host}` : "reconnecting\u2026")), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "g-press",
      onPointerDown: () => {
        setKb(false);
        window.location.reload();
      },
      style: { ...glass, width: 38, height: 38, borderRadius: 999, color: "var(--g-text-2)", border: "0.75px solid var(--g-line)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: "link", size: 18, sw: 2 })
  )), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 4,
    padding: 4,
    marginBottom: 10,
    borderRadius: 14,
    background: "rgba(0,0,0,0.3)",
    position: "relative",
    zIndex: 2
  } }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setActiveDev(null);
    setTab("pad");
  }, style: seg(activeDev === null) }, /* @__PURE__ */ React.createElement(GIcon, { name: "mouse", size: 15 }), "PC"), devices.map((d) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: d.id,
      onClick: () => {
        setActiveDev(d.id);
        setTab("pad");
      },
      style: seg(activeDev === d.id)
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: "film", size: 15 }),
    d.name
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSetup(true),
      title: "Add a device",
      style: { ...seg(false), flex: "none", padding: "8px 12px" }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: "gear", size: 15 }),
    devices.length ? "" : "Add TV"
  )), dev ? /* @__PURE__ */ React.createElement(DevicePanel, { key: dev.id, dev, flash }) : /* @__PURE__ */ React.createElement(React.Fragment, null, tab === "pad" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", gap: 10, position: "relative", zIndex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: padRef,
      onPointerDown: onPadDown,
      onPointerMove: onPadMove,
      onPointerUp: onPadUp,
      onPointerCancel: onPadUp,
      style: { flex: 1, borderRadius: "var(--g-r-lg)", position: "relative", overflow: "hidden", touchAction: "none", cursor: "none", ...glass }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      inset: 0,
      opacity: 0.5,
      backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.4px)",
      backgroundSize: "22px 22px"
    } }),
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      color: "var(--g-text-3)",
      opacity: cursor ? 0 : 1,
      transition: "opacity .25s",
      pointerEvents: "none"
    } }, /* @__PURE__ */ React.createElement(GIcon, { name: "cursor", size: 30, style: { color: "var(--g-text-3)" } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500, color: "var(--g-text-2)" } }, "Drag to move"), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { fontSize: 10.5, letterSpacing: 0.4 } }, "tap = click \xB7 hold = right-click")),
    cursor && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      left: cursor.x,
      top: cursor.y,
      transform: "translate(-50%,-50%)",
      width: 30,
      height: 30,
      borderRadius: 999,
      border: "1.5px solid var(--g-accent)",
      background: "var(--g-accent-dim)",
      pointerEvents: "none"
    } }),
    ripples.map((p) => /* @__PURE__ */ React.createElement("div", { key: p.id, style: {
      position: "absolute",
      left: p.x,
      top: p.y,
      width: 70,
      height: 70,
      borderRadius: 999,
      background: "var(--g-accent)",
      animation: "g-ripple .48s ease-out forwards",
      pointerEvents: "none"
    } }))
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: stripRef,
      onPointerDown: onStripDown,
      onPointerMove: onStripMove,
      onPointerUp: onStripUp,
      onPointerCancel: onStripUp,
      style: {
        width: 52,
        borderRadius: "var(--g-r-lg)",
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        ...glass
      }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: "chevUp", size: 20, style: { color: "var(--g-text-3)" } }),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, opacity: 0.4 } }, Array.from({ length: 7 }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { width: 16, height: 2.5, borderRadius: 2, background: "var(--g-text-2)" } }))),
    /* @__PURE__ */ React.createElement(GIcon, { name: "chevDown", size: 20, style: { color: "var(--g-text-3)" } }),
    scrubY != null && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      left: 6,
      right: 6,
      top: scrubY,
      transform: "translateY(-50%)",
      height: 34,
      borderRadius: 10,
      background: "var(--g-accent-dim)",
      border: "1px solid var(--g-accent)",
      pointerEvents: "none"
    } }),
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      bottom: -4,
      left: "50%",
      transform: "translateX(-50%) rotate(90deg)",
      transformOrigin: "center",
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--g-text-3)",
      fontFamily: "var(--g-mono)"
    } }, "SCROLL")
  )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, height: 64, marginTop: 10, position: "relative", zIndex: 1 } }, /* @__PURE__ */ React.createElement(GBtn, { flex: 1.5, onPress: () => {
    send({ type: "mouse_click", button: "left" });
    flash("Left click");
  }, style: { flexDirection: "column", gap: 3 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "cursor", size: 17 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--g-text-2)" } }, "Left")), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    send({ type: "mouse_click", button: "middle" });
    flash("Middle click");
  }, style: { flexDirection: "column", gap: 3 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "mouse", size: 17 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--g-text-2)" } }, "Mid")), /* @__PURE__ */ React.createElement(GBtn, { flex: 1.5, onPress: () => {
    send({ type: "mouse_click", button: "right" });
    flash("Right click");
  }, style: { flexDirection: "column", gap: 3 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "cursor", size: 17, style: { transform: "scaleX(-1)" } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--g-text-2)" } }, "Right"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, height: 52, marginTop: 10, position: "relative", zIndex: 1 } }, /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => setKb(true) }, /* @__PURE__ */ React.createElement(GIcon, { name: "keyboard", size: 20 })), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    setPlaying((p) => !p);
    key("play_pause");
    flash(playing ? "Pause" : "Play");
  } }, /* @__PURE__ */ React.createElement(GIcon, { name: playing ? "pause" : "play", size: 20 })), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    setVol((v) => Math.max(0, v - 6));
    setMuted(false);
    key("volume_down");
    flash("Vol \u2212");
  } }, /* @__PURE__ */ React.createElement(GIcon, { name: "volLow", size: 20 })), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    setVol((v) => Math.min(100, v + 6));
    setMuted(false);
    key("volume_up");
    flash("Vol +");
  } }, /* @__PURE__ */ React.createElement(GIcon, { name: "volume", size: 20 })))), tab !== "pad" && /* @__PURE__ */ React.createElement(Section, { centred: tab === "media" || tab === "nav" }, tab === "media" && /* @__PURE__ */ React.createElement(DrawerMedia, { ...{ playing, setPlaying, vol, setVol, muted, setMuted, flash } }), tab === "nav" && /* @__PURE__ */ React.createElement(DrawerNav, { flash }), tab === "apps" && /* @__PURE__ */ React.createElement(DrawerApps, { flash }), tab === "tune" && /* @__PURE__ */ React.createElement(DrawerTune, { ...{ uiBright, setUiBright, sens, setSens, scrollSpd, setScrollSpd, flash } })), /* @__PURE__ */ React.createElement(TabBar, { tabs: SECTIONS, active: tab, onChange: setTab })), toast && /* @__PURE__ */ React.createElement("div", { key: toast.id, className: "g-mono", style: {
    position: "absolute",
    bottom: 150,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "9px 18px",
    borderRadius: 999,
    background: "rgba(10,14,18,0.82)",
    backdropFilter: "blur(14px)",
    border: "0.75px solid var(--g-line)",
    fontSize: 12.5,
    color: "var(--g-accent)",
    letterSpacing: 0.3,
    animation: "g-toast-in .22s ease-out",
    zIndex: 30,
    whiteSpace: "nowrap"
  } }, toast.t), kb && /* @__PURE__ */ React.createElement(KeyboardSheet, { ...{ typed, setTyped, setKb, flash, hiddenInput } }), setup && /* @__PURE__ */ React.createElement(GlideSetup, { onClose: () => setSetup(false) }));
}
function DevicePanel({ dev, flash }) {
  const [learnMode, setLearnMode] = useState(false);
  const [capturing, setCapturing] = useState(null);
  const can = (c) => dev.capabilities.includes(c);
  const has = (a) => dev.actions.includes(a);
  const isLearned = (a) => (dev.learned || []).includes(a);
  const TABS = [
    can("nav") && ["nav", "Nav", "ok"],
    (can("media") || can("volume")) && ["media", "Media", "play"],
    (can("power") || can("input_select")) && ["power", "Power", "power"],
    can("learn") && ["tune", "Tune", "sliders"]
  ].filter(Boolean);
  const [tab, setTab] = useState(initialTab(TABS.map((t) => t[0])) || (TABS[0] ? TABS[0][0] : "nav"));
  useEffect(() => {
    return window.WS.onLearn((m) => {
      if (m.device !== dev.id) return;
      if (m.state === "waiting") {
        setCapturing({ action: m.action, timeout: m.timeout });
      } else {
        setCapturing(null);
        if (m.state === "captured") flash(`Learned ${m.action}`);
        else if (m.state === "seeded") flash(`Loaded ${m.count} codes`);
        else if (m.state === "timeout") flash("Nothing captured");
        else if (m.state === "forgotten") flash(`Forgot ${m.action}`);
        else if (m.state === "error") flash(m.message || "Learn failed");
      }
    });
  }, [dev.id, flash]);
  useEffect(() => {
    if (!learnMode) setCapturing(null);
  }, [learnMode]);
  const fire = (action, label) => {
    if (learnMode) {
      if (isLearned(action)) window.WS.forgetDevice(dev.id, action);
      else window.WS.learnDevice(dev.id, action, 30);
      return;
    }
    window.WS.sendDevice(dev.id, action);
    flash(label);
  };
  const row = (children, h = 54) => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, height: h } }, children);
  const btn = (action, label, icon, opts = {}) => has(action) && /* @__PURE__ */ React.createElement(
    GBtn,
    {
      key: action,
      flex: opts.flex || 1,
      accent: opts.accent && !learnMode,
      danger: opts.danger,
      active: learnMode && isLearned(action),
      onPress: () => fire(action, label),
      style: { gap: 7, position: "relative", ...opts.style || {} }
    },
    icon && /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: opts.iconSize || 19 }),
    opts.showLabel !== false && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--g-text-2)" } }, label),
    isLearned(action) && /* @__PURE__ */ React.createElement("span", { title: "learned locally", style: {
      position: "absolute",
      top: 5,
      right: 6,
      width: 5,
      height: 5,
      borderRadius: 999,
      background: "var(--g-accent)"
    } })
  );
  const dpad = (action, icon) => /* @__PURE__ */ React.createElement(
    GBtn,
    {
      onPress: () => fire(action, action),
      active: learnMode && isLearned(action),
      style: { borderRadius: 15, position: "relative" }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: 22 }),
    isLearned(action) && /* @__PURE__ */ React.createElement("span", { style: {
      position: "absolute",
      top: 6,
      right: 7,
      width: 5,
      height: 5,
      borderRadius: 999,
      background: "var(--g-accent)"
    } })
  );
  const blank = /* @__PURE__ */ React.createElement("div", null);
  const hdmis = ["hdmi1", "hdmi2", "hdmi3", "hdmi4"].filter(has);
  const teachBanner = can("learn") && /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 14,
    ...glass,
    ...learnMode ? { borderColor: "var(--g-accent)", background: "var(--g-accent-dim)" } : {}
  } }, /* @__PURE__ */ React.createElement(
    GIcon,
    {
      name: "keyboard",
      size: 17,
      style: { color: learnMode ? "var(--g-accent)" : "var(--g-text-3)" }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, lineHeight: 1.25 } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12.5,
    fontWeight: 600,
    color: learnMode ? "var(--g-accent)" : "var(--g-text-2)"
  } }, learnMode ? "Teach mode" : "Teach from remote"), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { fontSize: 10, color: "var(--g-text-3)" } }, learnMode ? "tap a button, then press it on your remote" : `${(dev.learned || []).length} learned`)), !learnMode && (dev.learned || []).length === 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "g-press",
      onClick: () => {
        window.WS.seedDevice(dev.id, "lg");
        flash("Loading LG codes\u2026");
      },
      style: {
        ...seg(false),
        flex: "none",
        padding: "7px 12px",
        borderRadius: 10,
        background: "var(--g-glass-hi)",
        color: "var(--g-text-2)"
      }
    },
    "Load LG"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "g-press",
      onClick: () => setLearnMode((v) => !v),
      style: {
        ...seg(learnMode),
        flex: "none",
        padding: "7px 14px",
        borderRadius: 10,
        background: learnMode ? "var(--g-accent)" : "var(--g-glass-hi)",
        color: learnMode ? "#04211f" : "var(--g-text-2)"
      }
    },
    learnMode ? "Done" : "Teach"
  ));
  const capturePrompt = capturing && /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => setCapturing(null),
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      ...glass,
      borderRadius: 22,
      padding: "26px 22px",
      maxWidth: 300,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      gap: 12
    } }, /* @__PURE__ */ React.createElement("div", { className: "g-live-dot", style: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: "var(--g-accent)",
      margin: "0 auto"
    } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 600 } }, "Press \u201C", capturing.action, "\u201D"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--g-text-2)", lineHeight: 1.45 } }, "Point your remote at the IR hub and press the button you want to store."), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { fontSize: 10.5, color: "var(--g-text-3)" } }, "waiting up to ", capturing.timeout, "s \xB7 tap to cancel"))
  );
  return /* @__PURE__ */ React.createElement(React.Fragment, null, capturePrompt, learnMode && tab !== "tune" && /* @__PURE__ */ React.createElement("div", { onClick: () => setLearnMode(false), style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    marginBottom: 8,
    borderRadius: 12,
    cursor: "pointer",
    background: "var(--g-accent-dim)",
    border: "0.75px solid var(--g-accent)",
    position: "relative",
    zIndex: 2,
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement("span", { className: "g-live-dot", style: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "var(--g-accent)",
    flexShrink: 0
  } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--g-accent)", flex: 1 } }, "Teach mode \u2014 tap a button to capture it"), /* @__PURE__ */ React.createElement("span", { className: "g-mono", style: { fontSize: 10.5, color: "var(--g-accent)" } }, "done")), tab === "nav" && /* @__PURE__ */ React.createElement(Section, { centred: true }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridAutoRows: 64,
    gap: 8,
    maxWidth: 270,
    margin: "0 auto",
    width: "100%"
  } }, blank, dpad("up", "chevUp"), blank, dpad("left", "chevLeft"), /* @__PURE__ */ React.createElement(GBtn, { accent: true, onPress: () => fire("ok", "OK"), style: { borderRadius: 999 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "ok", size: 22 })), dpad("right", "chevRight"), blank, dpad("down", "chevDown"), blank), row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("back", "Back", "esc"), btn("home", "Home", "apps"), btn("menu", "Menu", "sliders")), 48), row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("power_on", "On", "power", { showLabel: false }), btn("volume_down", "Vol \u2212", "volLow", { showLabel: false }), btn("mute", "Mute", "mute", { showLabel: false }), btn("volume_up", "Vol +", "volume", { showLabel: false })), 52)), tab === "media" && /* @__PURE__ */ React.createElement(Section, { centred: true }, can("media") && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12 } }, btn("previous", "Prev", "prev", { showLabel: false, flex: "none", style: { width: 56, height: 56, borderRadius: 999 } }), btn("rewind", "Rew", "back10", { showLabel: false, flex: "none", style: { width: 56, height: 56, borderRadius: 999 } }), btn("play", "Play", "play", { showLabel: false, flex: "none", accent: true, iconSize: 28, style: { width: 72, height: 72, borderRadius: 999 } }), btn("pause", "Pause", "pause", { showLabel: false, flex: "none", style: { width: 56, height: 56, borderRadius: 999 } }), btn("forward", "Fwd", "fwd10", { showLabel: false, flex: "none", style: { width: 56, height: 56, borderRadius: 999 } })), can("volume") && row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("volume_down", "Vol \u2212", "volLow", { showLabel: false, flex: 1.3 }), btn("mute", "Mute", "mute", { showLabel: false }), btn("volume_up", "Vol +", "volume", { showLabel: false, flex: 1.3 }))), can("channel") && row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("channel_down", "Ch \u2212", "chevDown"), btn("channel_up", "Ch +", "chevUp")), 48), can("media") && row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("stop", "Stop", "film")), 48)), tab === "power" && /* @__PURE__ */ React.createElement(Section, { centred: true }, can("power") && row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("power_on", "On", "power", { accent: true }), btn("power", "Toggle", "power")), 64), can("input_select") && /* @__PURE__ */ React.createElement(React.Fragment, null, has("input") && row(/* @__PURE__ */ React.createElement(React.Fragment, null, btn("input", "Cycle source", "film")), 48), hdmis.length > 0 && row(
    hdmis.map((h) => btn(
      h,
      h.toUpperCase().replace("HDMI", "HDMI "),
      null,
      { showLabel: true }
    )),
    56
  ))), tab === "tune" && /* @__PURE__ */ React.createElement(Section, null, teachBanner, learnMode && /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: {
    fontSize: 11,
    color: "var(--g-text-3)",
    lineHeight: 1.5,
    padding: "0 4px"
  } }, "Switch to Nav, Media or Power and tap any button to capture it from your remote. Learned buttons show a teal dot. Tap one again to forget it.")), /* @__PURE__ */ React.createElement(TabBar, { tabs: TABS, active: tab, onChange: setTab }));
}
function DrawerMedia({ playing, setPlaying, vol, setVol, muted, setMuted, flash }) {
  const tBtn = (icon, label, onP, big) => /* @__PURE__ */ React.createElement(GBtn, { onPress: onP, accent: big, style: { width: big ? 72 : 56, height: big ? 72 : 56, borderRadius: 999 } }, /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: big ? 30 : 22 }));
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 18, paddingBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12 } }, tBtn("prev", "Prev", () => {
    key("prev");
    flash("Previous");
  }), tBtn("back10", "Back", () => {
    key("seek_back");
    flash("Back 10s");
  }), tBtn(playing ? "pause" : "play", "Play", () => {
    setPlaying((p) => !p);
    key("play_pause");
    flash(playing ? "Pause" : "Play");
  }, true), tBtn("fwd10", "Fwd", () => {
    key("seek_fwd");
    flash("Fwd 10s");
  }), tBtn("next", "Next", () => {
    key("next");
    flash("Next");
  })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "g-press",
      onClick: () => {
        setMuted((m) => !m);
        key("mute");
        flash(muted ? "Unmuted" : "Muted");
      },
      style: {
        ...glass,
        width: 46,
        height: 46,
        borderRadius: 14,
        border: "none",
        cursor: "pointer",
        color: muted ? "var(--g-danger)" : "var(--g-text)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: muted ? "mute" : "volume", size: 20 })
  ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(GSlider, { value: muted ? 0 : vol, onChange: (v) => {
    const prev = vol;
    setVol(v);
    setMuted(false);
    const steps = Math.round((v - prev) / 5);
    const k = steps > 0 ? "volume_up" : "volume_down";
    for (let i = 0; i < Math.abs(steps); i++) key(k);
  } })), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { width: 38, textAlign: "right", fontSize: 13, color: "var(--g-text-2)" } }, muted ? "\u2014" : vol)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    key("stop");
    flash("Stop");
  }, style: { height: 48 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "film", size: 18 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--g-text-2)" } }, "Stop")), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    key("fullscreen");
    flash("Fullscreen");
  }, style: { height: 48 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "fullscreen", size: 18 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--g-text-2)" } }, "Fullscreen"))));
}
function DrawerNav({ flash }) {
  const cell = (icon, label, k, accent) => /* @__PURE__ */ React.createElement(GBtn, { onPress: () => {
    key(k);
    flash(label);
  }, accent, style: { borderRadius: accent ? 999 : 16 } }, /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: accent ? 22 : 24 }));
  const blank = /* @__PURE__ */ React.createElement("div", null);
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14, paddingBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: 62, gap: 8, maxWidth: 250, margin: "0 auto", width: "100%" } }, blank, cell("chevUp", "Up", "up"), blank, cell("chevLeft", "Left", "left"), cell("ok", "OK", "ok", true), cell("chevRight", "Right", "right"), blank, cell("chevDown", "Down", "down"), blank), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, height: 54 } }, /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    key("esc");
    flash("Back / Esc");
  }, style: { gap: 8 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "esc", size: 20 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--g-text-2)" } }, "Back")), /* @__PURE__ */ React.createElement(GBtn, { flex: 1, onPress: () => {
    key("fullscreen");
    flash("Fullscreen");
  }, style: { gap: 8 } }, /* @__PURE__ */ React.createElement(GIcon, { name: "fullscreen", size: 19 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--g-text-2)" } }, "Full"))));
}
const APPS = [
  ["J", "Jellyfin", 285],
  ["P", "Plex", 60],
  ["K", "Kodi", 210],
  ["N", "Netflix", 24],
  ["Y", "YouTube", 12],
  ["S", "Spotify", 150],
  ["B", "Browser", 192],
  ["+", "Add\u2026", 0]
];
function DrawerApps({ flash }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, paddingBottom: 6 } }, APPS.map(([m, name, hue]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: name,
      className: "g-press",
      onClick: () => {
        if (name !== "Add\u2026") {
          send({ type: "launch", app: name.toLowerCase() });
          flash("Launching " + name);
        }
      },
      style: { background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: 0 }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      width: 56,
      height: 56,
      borderRadius: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: name === "Add\u2026" ? "var(--g-glass)" : `oklch(0.42 0.10 ${hue})`,
      border: name === "Add\u2026" ? "1px dashed var(--g-line)" : "0.75px solid rgba(255,255,255,0.12)",
      color: name === "Add\u2026" ? "var(--g-text-3)" : "#fff",
      fontSize: 24,
      fontWeight: 700,
      fontFamily: "var(--g-ui)"
    } }, m),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "var(--g-text-2)", fontWeight: 500 } }, name)
  )));
}
function DrawerTune({ uiBright, setUiBright, sens, setSens, scrollSpd, setScrollSpd, flash }) {
  const row = (icon, label, value, set, unit = "%") => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement(GIcon, { name: icon, size: 20, style: { color: "var(--g-text-2)", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12.5, fontWeight: 500, color: "var(--g-text-2)" } }, label), /* @__PURE__ */ React.createElement("span", { className: "g-mono", style: { fontSize: 12, color: "var(--g-text-3)" } }, value, unit)), /* @__PURE__ */ React.createElement(GSlider, { value, onChange: set, height: 36 })));
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16, paddingBottom: 6 } }, row("sun", "Remote brightness", uiBright, setUiBright), row("gauge", "Pointer speed", sens, setSens), row("scroll", "Scroll speed", scrollSpd, setScrollSpd), /* @__PURE__ */ React.createElement(
    GBtn,
    {
      danger: true,
      onPress: () => {
        send({ type: "key", key: "sleep" });
        flash("Sleep sent");
      },
      style: { height: 52, borderRadius: "var(--g-r-md)", fontFamily: "var(--g-ui)", fontSize: 14, fontWeight: 600, gap: 9 }
    },
    /* @__PURE__ */ React.createElement(GIcon, { name: "power", size: 19 }),
    "Sleep / Power off"
  ));
}
function KeyboardSheet({ typed, setTyped, setKb, flash, hiddenInput }) {
  useEffect(() => {
    if (hiddenInput.current) hiddenInput.current.focus();
  }, []);
  function doSend() {
    if (typed) {
      send({ type: "text", text: typed });
      flash("Sent \u2713");
      setTyped("");
    }
  }
  const special = [
    ["esc", "Esc", () => key("esc")],
    ["tab", "Tab", () => key("tab")],
    ["chevUp", "", () => key("up")],
    ["chevDown", "", () => key("down")],
    ["chevLeft", "", () => key("left")],
    ["chevRight", "", () => key("right")],
    ["backspace", "", () => setTyped((t) => t.slice(0, -1))],
    ["enter", "Send", doSend]
  ];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.35)" },
      onClick: (e) => {
        if (e.target === e.currentTarget) setKb(false);
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { padding: "0 14px 24px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" } }, /* @__PURE__ */ React.createElement("span", { className: "g-mono", style: { fontSize: 11, letterSpacing: 1, color: "var(--g-text-3)" } }, "TEXT INPUT \u2192 PC"), /* @__PURE__ */ React.createElement("button", { onClick: () => setKb(false), style: { background: "none", border: "none", color: "var(--g-text-2)", cursor: "pointer", display: "flex" } }, /* @__PURE__ */ React.createElement(GIcon, { name: "close", size: 20 }))), /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => hiddenInput.current && hiddenInput.current.focus(),
        style: { ...glass, minHeight: 52, borderRadius: "var(--g-r-md)", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 16, color: typed ? "var(--g-text)" : "var(--g-text-3)" }
      },
      typed || "Type here\u2026",
      /* @__PURE__ */ React.createElement("span", { style: { width: 2, height: 22, background: "var(--g-accent)", marginLeft: 2, animation: "g-pulse 1s steps(1) infinite" } })
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: hiddenInput,
        value: typed,
        onChange: (e) => setTyped(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            doSend();
          }
        },
        style: { position: "fixed", top: -100, left: 0, opacity: 0, height: 1, width: 1 },
        autoComplete: "off",
        autoCorrect: "off",
        autoCapitalize: "off",
        spellCheck: "false"
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 10 } }, special.map(([ic, lbl, fn], i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: i,
        className: "g-press",
        onPointerDown: (e) => {
          e.preventDefault();
          fn();
        },
        style: {
          ...glass,
          flex: lbl === "Send" ? 1.4 : 1,
          height: 42,
          borderRadius: 11,
          border: "none",
          cursor: "pointer",
          color: lbl === "Send" ? "var(--g-accent)" : "var(--g-text-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          fontSize: 12.5,
          fontWeight: 600
        }
      },
      /* @__PURE__ */ React.createElement(GIcon, { name: ic, size: 17 }),
      lbl && /* @__PURE__ */ React.createElement("span", null, lbl)
    ))))
  );
}
Object.assign(window, { GlideController });
