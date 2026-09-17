const { useState: useCS, useEffect: useCE } = React;
const cGlass = {
  background: "var(--g-glass)",
  backdropFilter: "blur(var(--g-blur)) saturate(160%)",
  WebkitBackdropFilter: "blur(var(--g-blur)) saturate(160%)",
  border: "0.75px solid var(--g-line)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)"
};
function GlideMark({ size = 30 }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    width: size,
    height: size,
    borderRadius: size * 0.28,
    background: "var(--g-accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px var(--g-glow)",
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement(GIcon, { name: "cursor", size: size * 0.56, style: { color: "#04211f" } }));
}
function Shell({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "g-app", style: {
    position: "absolute",
    inset: 0,
    background: "var(--g-bg)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "92px 26px 40px"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: -120,
    left: "50%",
    transform: "translateX(-50%)",
    width: 340,
    height: 300,
    background: "radial-gradient(circle, var(--g-accent-dim), transparent 70%)",
    filter: "blur(20px)",
    pointerEvents: "none"
  } }), children);
}
function GlideConnect({ device = "Living-Room PC" }) {
  const [step, setStep] = useCS(() => window.WS.isConnected() ? "connected" : "connecting");
  useCE(() => {
    if (step === "connected") {
      const t = setTimeout(() => setStep("control"), 1300);
      return () => clearTimeout(t);
    }
  }, []);
  useCE(() => {
    const offConnect = window.WS.onConnect(() => {
      setStep("connected");
      setTimeout(() => setStep("control"), 1300);
    });
    const offDisconnect = window.WS.onDisconnect(() => {
      setStep((cur) => cur === "control" ? cur : "connecting");
    });
    return () => {
      offConnect();
      offDisconnect();
    };
  }, []);
  if (step === "control") return /* @__PURE__ */ React.createElement(GlideController, { device });
  return /* @__PURE__ */ React.createElement(Shell, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 11, marginBottom: 6, position: "relative" } }, /* @__PURE__ */ React.createElement(GlideMark, { size: 30 }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 22, fontWeight: 700, letterSpacing: -0.4 } }, "Glide")), step === "connecting" && /* @__PURE__ */ React.createElement("div", { key: "conn", style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, animation: "g-rise .3s ease-out" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 64, height: 64, borderRadius: 999, border: "3px solid var(--g-line)", borderTopColor: "var(--g-accent)", animation: "g-spin 0.8s linear infinite" } }), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 600, marginBottom: 6 } }, "Connecting\u2026"), /* @__PURE__ */ React.createElement("div", { className: "g-mono", style: { fontSize: 12, color: "var(--g-text-3)", letterSpacing: 0.3 } }, "reaching ", location.host))), step === "connected" && /* @__PURE__ */ React.createElement("div", { key: "ok", style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 96,
    height: 96,
    borderRadius: 999,
    background: "var(--g-accent-dim)",
    border: "1.5px solid var(--g-accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "g-pop .35s cubic-bezier(.2,.9,.3,1.4)"
  } }, /* @__PURE__ */ React.createElement("svg", { width: "46", height: "46", viewBox: "0 0 24 24", fill: "none", stroke: "var(--g-accent)", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M5 12.5l4.5 4.5L19 7" }))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 21, fontWeight: 700, marginBottom: 6 } }, "Connected"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "var(--g-text-2)" } }, "You're controlling ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--g-text)" } }, device)))));
}
Object.assign(window, { GlideConnect, GlideMark });
