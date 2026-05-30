/* glide-ui.jsx — icon set + shared primitives (exports to window) */

function GIcon({ name, size = 24, sw = 2, style = {} }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0, ...style };
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const fill = { fill: 'currentColor' };
  const P = (d, o = {}) => <path d={d} {...stroke} {...o} />;
  switch (name) {
    case 'cursor':   return <svg viewBox="0 0 24 24" style={s}><path d="M5 3l14 7-6 1.5L9.5 18 5 3z" {...fill}/></svg>;
    case 'chevUp':   return <svg viewBox="0 0 24 24" style={s}>{P('M6 15l6-6 6 6')}</svg>;
    case 'chevDown': return <svg viewBox="0 0 24 24" style={s}>{P('M6 9l6 6 6-6')}</svg>;
    case 'chevLeft': return <svg viewBox="0 0 24 24" style={s}>{P('M15 6l-6 6 6 6')}</svg>;
    case 'chevRight':return <svg viewBox="0 0 24 24" style={s}>{P('M9 6l6 6-6 6')}</svg>;
    case 'play':     return <svg viewBox="0 0 24 24" style={s}><path d="M7 4.5l13 7.5-13 7.5z" {...fill}/></svg>;
    case 'pause':    return <svg viewBox="0 0 24 24" style={s}><rect x="6" y="5" width="4" height="14" rx="1.3" {...fill}/><rect x="14" y="5" width="4" height="14" rx="1.3" {...fill}/></svg>;
    case 'prev':     return <svg viewBox="0 0 24 24" style={s}><path d="M19 5L9 12l10 7z" {...fill}/><rect x="4" y="5" width="3" height="14" rx="1.2" {...fill}/></svg>;
    case 'next':     return <svg viewBox="0 0 24 24" style={s}><path d="M5 5l10 7L5 19z" {...fill}/><rect x="17" y="5" width="3" height="14" rx="1.2" {...fill}/></svg>;
    case 'back10':   return <svg viewBox="0 0 24 24" style={s}>{P('M11 7a6 6 0 1 1-5.7 4.1')}{P('M11 3.5L7.5 7 11 10.5')}<text x="12.3" y="15.6" fontSize="7.2" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="ui-monospace,monospace">10</text></svg>;
    case 'fwd10':    return <svg viewBox="0 0 24 24" style={s}>{P('M13 7a6 6 0 1 0 5.7 4.1')}{P('M13 3.5L16.5 7 13 10.5')}<text x="11.4" y="15.6" fontSize="7.2" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="ui-monospace,monospace">10</text></svg>;
    case 'volume':   return <svg viewBox="0 0 24 24" style={s}>{P('M4 9v6h3.5L13 19V5L7.5 9z', { fill: 'currentColor', stroke: 'none' })}{P('M16.5 8.5a5 5 0 0 1 0 7')}{P('M19 6a8.5 8.5 0 0 1 0 12')}</svg>;
    case 'volLow':   return <svg viewBox="0 0 24 24" style={s}>{P('M4 9v6h3.5L13 19V5L7.5 9z', { fill: 'currentColor', stroke: 'none' })}{P('M16.5 9.5a4 4 0 0 1 0 5')}</svg>;
    case 'mute':     return <svg viewBox="0 0 24 24" style={s}>{P('M4 9v6h3.5L13 19V5L7.5 9z', { fill: 'currentColor', stroke: 'none' })}{P('M17 9.5l4 5M21 9.5l-4 5')}</svg>;
    case 'power':    return <svg viewBox="0 0 24 24" style={s}>{P('M12 3v8')}{P('M6.8 6.8a8 8 0 1 0 10.4 0')}</svg>;
    case 'sun':      return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="4" {...stroke}/>{P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4')}</svg>;
    case 'keyboard': return <svg viewBox="0 0 24 24" style={s}><rect x="2.5" y="6" width="19" height="12" rx="2.4" {...stroke}/>{P('M6 9.5h0M9.5 9.5h0M13 9.5h0M16.5 9.5h0M6 13h0M18 9.5v3.5M8 16h8')}</svg>;
    case 'gear':     return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="3" {...stroke}/>{P('M12 2.5l1.3 2.4 2.7-.5.5 2.7 2.4 1.3-1.2 2.4 1.2 2.4-2.4 1.3-.5 2.7-2.7-.5L12 21.5l-1.3-2.4-2.7.5-.5-2.7-2.4-1.3 1.2-2.4-1.2-2.4 2.4-1.3.5-2.7 2.7.5z')}</svg>;
    case 'fullscreen': return <svg viewBox="0 0 24 24" style={s}>{P('M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4')}</svg>;
    case 'esc':      return <svg viewBox="0 0 24 24" style={s}>{P('M11 5l-7 7 7 7M4 12h15')}</svg>;
    case 'enter':    return <svg viewBox="0 0 24 24" style={s}>{P('M20 5v7H7M7 12l4-4M7 12l4 4')}</svg>;
    case 'backspace':return <svg viewBox="0 0 24 24" style={s}>{P('M8 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7 6-7z')}{P('M11 9.5l5 5M16 9.5l-5 5')}</svg>;
    case 'tab':      return <svg viewBox="0 0 24 24" style={s}>{P('M3 6v12M21 12H8M14 6l6 6-6 6')}</svg>;
    case 'link':     return <svg viewBox="0 0 24 24" style={s}>{P('M9 15l6-6')}{P('M13 7l1.5-1.5a3.5 3.5 0 0 1 5 5L18 12')}{P('M11 17l-1.5 1.5a3.5 3.5 0 0 1-5-5L6 12')}</svg>;
    case 'close':    return <svg viewBox="0 0 24 24" style={s}>{P('M6 6l12 12M18 6L6 18')}</svg>;
    case 'gauge':    return <svg viewBox="0 0 24 24" style={s}>{P('M5 17a7 7 0 1 1 14 0')}{P('M12 17l4-5')}<circle cx="12" cy="17" r="1.3" {...fill}/></svg>;
    case 'scroll':   return <svg viewBox="0 0 24 24" style={s}><rect x="8" y="3.5" width="8" height="17" rx="4" {...stroke}/>{P('M12 7v3')}</svg>;
    case 'mouse':    return <svg viewBox="0 0 24 24" style={s}><rect x="6" y="3" width="12" height="18" rx="6" {...stroke}/>{P('M12 3v6')}</svg>;
    case 'ok':       return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...stroke}/><circle cx="12" cy="12" r="3.2" {...fill}/></svg>;
    case 'apps':     return <svg viewBox="0 0 24 24" style={s}><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" {...stroke}/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" {...stroke}/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" {...stroke}/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" {...stroke}/></svg>;
    case 'sliders':  return <svg viewBox="0 0 24 24" style={s}>{P('M4 8h10M18 8h2M4 16h2M10 16h10')}<circle cx="16" cy="8" r="2.2" {...stroke}/><circle cx="8" cy="16" r="2.2" {...stroke}/></svg>;
    case 'film':     return <svg viewBox="0 0 24 24" style={s}><rect x="3.5" y="5" width="17" height="14" rx="2.5" {...stroke}/>{P('M3.5 9.5h17M3.5 14.5h17M8.5 5v14M15.5 5v14')}</svg>;
    default: return null;
  }
}

/* ── horizontal slider with pointer drag ───────────────────── */
function GSlider({ value, min = 0, max = 100, onChange, accent = 'var(--g-accent)', height = 46 }) {
  const ref = React.useRef(null);
  const set = (clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round(min + pct * (max - min)));
  };
  const start = (e) => {
    e.preventDefault(); set(e.clientX);
    const move = (ev) => set(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div ref={ref} onPointerDown={start} style={{
      position: 'relative', height, borderRadius: 'var(--g-r-md)', cursor: 'pointer',
      background: 'var(--g-glass)', border: '0.75px solid var(--g-line)', overflow: 'hidden',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', touchAction: 'none',
    }}>
      <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: accent, opacity: 0.9 }} />
      <div style={{
        position: 'absolute', top: '50%', left: `calc(${pct}% )`, transform: 'translate(-50%,-50%)',
        width: 5, height: '58%', borderRadius: 3, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }} />
    </div>
  );
}

Object.assign(window, { GIcon, GSlider });
