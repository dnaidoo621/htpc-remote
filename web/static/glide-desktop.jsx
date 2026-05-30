/* glide-desktop.jsx — HTPC popup window: waiting + connected (exports DesktopPopup) */

/* deterministic QR-like matrix (decorative, not a real encoder) */
function qrMatrix(n, seed) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const g = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.5));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const edge = i === 0 || i === 6 || j === 0 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      const border = i === -1 || i === 7 || j === -1 || j === 7;
      g[rr][cc] = border ? false : (edge || core);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  return g;
}

function QR({ size = 200, dark }) {
  const n = 25; const m = qrMatrix(n, 'http://glide.local:7000');
  const cell = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', borderRadius: 8 }}>
      <rect width={size} height={size} fill="#fff" rx="8" />
      <g fill="#0a0d11">
        {m.map((row, r) => row.map((on, c) => on ? <rect key={r + '-' + c} x={c * cell + 0.4} y={r * cell + 0.4} width={cell - 0.8} height={cell - 0.8} rx={cell * 0.18} /> : null))}
      </g>
    </svg>
  );
}

function GlideMark({ size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: 'var(--g-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px var(--g-glow)', flexShrink: 0 }}>
      <GIcon name="cursor" size={size * 0.56} style={{ color: '#04211f' }} />
    </div>
  );
}

function DesktopPopup({ connected = false, device = 'iPhone 15' }) {
  return (
    <div className="g-app" style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(120% 120% at 50% 0%, #12161d 0%, #07090c 60%)' }}>
      {/* faint wallpaper texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1.4px)', backgroundSize: '30px 30px' }} />
      <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 460, height: 320, background: 'radial-gradient(circle, var(--g-accent-dim), transparent 70%)', filter: 'blur(30px)' }} />

      {/* popup card */}
      <div style={{ position: 'relative', width: 460, borderRadius: 28, padding: '38px 40px 34px',
        background: 'rgba(16,21,28,0.7)', backdropFilter: 'blur(var(--g-blur-lg)) saturate(160%)', WebkitBackdropFilter: 'blur(var(--g-blur-lg)) saturate(160%)',
        border: '0.75px solid var(--g-line)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 90px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <GlideMark size={34} />
          <span style={{ fontSize: 25, fontWeight: 700, letterSpacing: -0.5 }}>Glide</span>
        </div>

        {!connected ? <>
          <div style={{ padding: 14, background: '#fff', borderRadius: 18, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', marginBottom: 22 }}>
            <QR size={190} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 7 }}>Scan to control this PC</div>
          <div style={{ fontSize: 14, color: 'var(--g-text-2)', lineHeight: 1.5, maxWidth: 300, marginBottom: 22 }}>
            Point your phone camera at the code, or open the address below in any browser on your network.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 'var(--g-r-pill)', background: 'var(--g-glass)', border: '0.75px solid var(--g-line)' }}>
            <GIcon name="link" size={16} style={{ color: 'var(--g-accent)' }} />
            <span className="g-mono" style={{ fontSize: 14.5, letterSpacing: 0.3 }}>glide.local:7000</span>
            <span style={{ width: 1, height: 16, background: 'var(--g-line)', margin: '0 2px' }} />
            <span className="g-mono" style={{ fontSize: 13, color: 'var(--g-text-3)' }}>192.168.1.42</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, color: 'var(--g-text-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--g-warn)' }} className="g-live-dot" />
            <span style={{ fontSize: 12.5 }}>Waiting for a device…</span>
          </div>
        </> : <>
          <div style={{ width: 120, height: 120, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, background: 'var(--g-accent-dim)', border: '1px solid var(--g-accent)' }}>
            <GIcon name="link" size={48} style={{ color: 'var(--g-accent)' }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Connected</div>
          <div style={{ fontSize: 14, color: 'var(--g-text-2)', lineHeight: 1.5, maxWidth: 290, marginBottom: 24 }}>
            <b style={{ color: 'var(--g-text)' }}>{device}</b> is now controlling this machine. This window will hide itself.
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button style={{ flex: 1, height: 46, borderRadius: 'var(--g-r-md)', cursor: 'pointer', background: 'var(--g-glass)', border: '0.75px solid var(--g-line)', color: 'var(--g-text)', fontFamily: 'var(--g-ui)', fontSize: 14, fontWeight: 600 }}>Hide window</button>
            <button style={{ flex: 1, height: 46, borderRadius: 'var(--g-r-md)', cursor: 'pointer', background: 'transparent', border: '0.75px solid oklch(0.70 0.16 25 / 0.5)', color: 'var(--g-danger)', fontFamily: 'var(--g-ui)', fontSize: 14, fontWeight: 600 }}>Disconnect</button>
          </div>
        </>}
      </div>
    </div>
  );
}

Object.assign(window, { DesktopPopup, GlideMark, QR });
