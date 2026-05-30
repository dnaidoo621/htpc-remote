/* glide-controller.jsx — Glide remote controller, wired to window.WS */
const { useState, useRef, useEffect, useCallback } = React;

const glass = {
  background: 'var(--g-glass)', backdropFilter: 'blur(var(--g-blur)) saturate(160%)',
  WebkitBackdropFilter: 'blur(var(--g-blur)) saturate(160%)', border: '0.75px solid var(--g-line)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), var(--g-shadow-1)',
};

/* ── tactile glass button ── */
function GBtn({ children, onPress, flex, style = {}, active, accent, danger, ...rest }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress && onPress(); }}
      className="g-press"
      style={{
        flex, appearance: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--g-text)', borderRadius: 'var(--g-r-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        ...glass,
        ...(active  ? { background: 'var(--g-accent-dim)', borderColor: 'var(--g-accent)', color: 'var(--g-accent)' } : {}),
        ...(accent  ? { background: 'var(--g-accent)', borderColor: 'transparent', color: '#04211f', boxShadow: '0 4px 18px var(--g-glow)' } : {}),
        ...(danger  ? { background: 'oklch(0.70 0.16 25 / 0.12)', border: '0.75px solid oklch(0.70 0.16 25 / 0.5)', color: 'var(--g-danger)' } : {}),
        ...style,
      }}
      {...rest}
    >{children}</button>
  );
}

const seg = (on) => ({
  flex: 1, padding: '8px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
  fontFamily: 'var(--g-ui)', fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
  background: on ? 'var(--g-glass-hi)' : 'transparent',
  color: on ? 'var(--g-text)' : 'var(--g-text-3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s',
});

function send(obj) { window.WS.send(obj); }
function key(k)   { send({ type: 'key', key: k }); }

/* ── main controller ── */
function GlideController({ device = 'Living-Room PC' }) {
  const [vol,      setVol]      = useState(42);
  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [tab,      setTab]      = useState(null);   // null | media | nav | apps | tune
  const [kb,       setKb]       = useState(false);
  const [typed,    setTyped]    = useState('');
  const [toast,    setToast]    = useState(null);
  const [ripples,  setRipples]  = useState([]);
  const [cursor,   setCursor]   = useState(null);
  const [scrubY,   setScrubY]   = useState(null);
  const [wsOk,     setWsOk]     = useState(window.WS.isConnected());
  const [uiBright, setUiBright] = useState(100);  // UI self-dimming %
  const [sens,     setSens]     = useState(60);
  const [scrollSpd,setScrollSpd]= useState(50);

  const tRef      = useRef(0);
  const hiddenInput = useRef(null);

  /* ── WS connection state ── */
  useEffect(() => {
    const off1 = window.WS.onConnect(()    => setWsOk(true));
    const off2 = window.WS.onDisconnect(() => setWsOk(false));
    return () => { off1(); off2(); };
  }, []);

  /* ── sync sensitivity to window.HTPC ── */
  useEffect(() => { window.HTPC.sensitivity  = 0.5 + (sens / 100) * 3.5; }, [sens]);
  useEffect(() => { window.HTPC.scrollSpeed  = 0.3 + (scrollSpd / 100) * 2.7; }, [scrollSpd]);

  /* ── UI self-dim (night mode) ── */
  useEffect(() => {
    document.getElementById('app-root').style.filter = `brightness(${uiBright}%)`;
  }, [uiBright]);

  const flash = useCallback((t) => {
    tRef.current += 1; const id = tRef.current; setToast({ t, id });
    setTimeout(() => setToast((cur) => (cur && cur.id === id ? null : cur)), 1400);
  }, []);

  /* ── trackpad ── */
  const padRef = useRef(null);
  const down   = useRef(null);

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

    /* incremental delta → mouse move */
    const incX = (e.clientX - down.current.lastX) * (window.HTPC.sensitivity || 2.0);
    const incY = (e.clientY - down.current.lastY) * (window.HTPC.sensitivity || 2.0);
    down.current.lastX = e.clientX;
    down.current.lastY = e.clientY;
    if (down.current.moved) window.WS.queueMove(incX, incY);

    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onPadUp = (e) => {
    if (!down.current) return;
    const r = padRef.current.getBoundingClientRect();
    if (!down.current.moved && Date.now() - down.current.t < 280) {
      send({ type: 'mouse_click', button: 'left' });
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((rs) => rs.filter((p) => p.id !== id)), 480);
      flash('Left click');
    }
    down.current = null;
    setTimeout(() => setCursor(null), 600);
  };

  /* ── scroll strip ── */
  const stripRef = useRef(null);
  const sdown    = useRef(null);

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
    if (Math.abs(dy) > 1) window.WS.queueScroll(dy * (window.HTPC.scrollSpeed || 1.0));
    sdown.current.acc += dy;
    if (Math.abs(sdown.current.acc) > 26) {
      flash(sdown.current.acc > 0 ? 'Scroll ↓' : 'Scroll ↑');
      sdown.current.acc = 0;
    }
  };

  const onStripUp = () => { sdown.current = null; setTimeout(() => setScrubY(null), 500); };

  /* ── drawer ── */
  const openDrawer = (t = 'media') => setTab(t);
  const hRef = useRef(null);
  const onHandleDown = (e) => {
    const y0 = e.clientY;
    const move = (ev) => { if (y0 - ev.clientY > 28) { openDrawer('media'); cleanup(); } };
    const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cleanup); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', cleanup);
  };

  const volIcon = muted ? 'mute' : vol < 38 ? 'volLow' : 'volume';

  return (
    <div className="g-app" style={{
      position: 'absolute', inset: 0, background: 'var(--g-bg)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', padding: '54px 14px 26px',
    }}>
      {/* ambient glow */}
      <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 360, height: 300,
        background: 'radial-gradient(circle, var(--g-accent-dim), transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px 12px', position: 'relative', zIndex: 2 }}>
        <span className={wsOk ? 'g-live-dot' : ''} style={{
          width: 9, height: 9, borderRadius: 999, flexShrink: 0,
          background: wsOk ? 'var(--g-accent)' : 'var(--g-warn)',
          transition: 'background .4s',
        }} />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{device}</div>
          <div className="g-mono" style={{ fontSize: 10.5, color: 'var(--g-text-3)', letterSpacing: 0.3 }}>
            {wsOk ? `connected · ${location.host}` : 'reconnecting…'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="g-press" onPointerDown={() => { setTab(null); setKb(false); window.location.reload(); }}
          style={{ ...glass, width: 38, height: 38, borderRadius: 999, color: 'var(--g-text-2)', border: '0.75px solid var(--g-line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GIcon name="link" size={18} sw={2} />
        </button>
      </div>

      {/* trackpad + scroll strip */}
      <div style={{ flex: 1, display: 'flex', gap: 10, position: 'relative', zIndex: 1, minHeight: 0 }}>
        {/* trackpad */}
        <div ref={padRef}
          onPointerDown={onPadDown} onPointerMove={onPadMove} onPointerUp={onPadUp} onPointerCancel={onPadUp}
          style={{ flex: 1, borderRadius: 'var(--g-r-lg)', position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: 'none', ...glass }}>
          {/* dot texture */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.4px)', backgroundSize: '22px 22px' }} />
          {/* hint */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--g-text-3)', opacity: cursor ? 0 : 1, transition: 'opacity .25s', pointerEvents: 'none' }}>
            <GIcon name="cursor" size={30} style={{ color: 'var(--g-text-3)' }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--g-text-2)' }}>Drag to move</div>
            <div className="g-mono" style={{ fontSize: 10.5, letterSpacing: 0.4 }}>tap = click · hold = right-click</div>
          </div>
          {/* cursor indicator */}
          {cursor && <div style={{ position: 'absolute', left: cursor.x, top: cursor.y, transform: 'translate(-50%,-50%)',
            width: 30, height: 30, borderRadius: 999, border: '1.5px solid var(--g-accent)', background: 'var(--g-accent-dim)', pointerEvents: 'none' }} />}
          {/* tap ripple */}
          {ripples.map((p) => <div key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, width: 70, height: 70,
            borderRadius: 999, background: 'var(--g-accent)', animation: 'g-ripple .48s ease-out forwards', pointerEvents: 'none' }} />)}
        </div>

        {/* scroll strip */}
        <div ref={stripRef}
          onPointerDown={onStripDown} onPointerMove={onStripMove} onPointerUp={onStripUp} onPointerCancel={onStripUp}
          style={{ width: 52, borderRadius: 'var(--g-r-lg)', position: 'relative', overflow: 'hidden',
            touchAction: 'none', cursor: 'grab', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', ...glass }}>
          <GIcon name="chevUp"   size={20} style={{ color: 'var(--g-text-3)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, opacity: 0.4 }}>
            {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ width: 16, height: 2.5, borderRadius: 2, background: 'var(--g-text-2)' }} />)}
          </div>
          <GIcon name="chevDown" size={20} style={{ color: 'var(--g-text-3)' }} />
          {scrubY != null && <div style={{ position: 'absolute', left: 6, right: 6, top: scrubY, transform: 'translateY(-50%)',
            height: 34, borderRadius: 10, background: 'var(--g-accent-dim)', border: '1px solid var(--g-accent)', pointerEvents: 'none' }} />}
          <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(90deg)',
            transformOrigin: 'center', fontSize: 9, letterSpacing: 1.5, color: 'var(--g-text-3)', fontFamily: 'var(--g-mono)' }}>SCROLL</div>
        </div>
      </div>

      {/* click bar */}
      <div style={{ display: 'flex', gap: 8, height: 64, marginTop: 10, position: 'relative', zIndex: 1 }}>
        <GBtn flex={1.5} onPress={() => { send({ type: 'mouse_click', button: 'left'   }); flash('Left click');   }} style={{ flexDirection: 'column', gap: 3 }}>
          <GIcon name="cursor" size={17} /><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--g-text-2)' }}>Left</span>
        </GBtn>
        <GBtn flex={1}   onPress={() => { send({ type: 'mouse_click', button: 'middle' }); flash('Middle click'); }} style={{ flexDirection: 'column', gap: 3 }}>
          <GIcon name="mouse"  size={17} /><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--g-text-2)' }}>Mid</span>
        </GBtn>
        <GBtn flex={1.5} onPress={() => { send({ type: 'mouse_click', button: 'right'  }); flash('Right click');  }} style={{ flexDirection: 'column', gap: 3 }}>
          <GIcon name="cursor" size={17} style={{ transform: 'scaleX(-1)' }} /><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--g-text-2)' }}>Right</span>
        </GBtn>
      </div>

      {/* swipe-up handle */}
      <div ref={hRef} onPointerDown={onHandleDown} onClick={() => openDrawer('media')}
        style={{ display: 'flex', justifyContent: 'center', padding: '11px 0 5px', cursor: 'grab', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--g-glass-hi)' }} />
      </div>

      {/* quick action bar */}
      <div style={{ display: 'flex', gap: 8, height: 52, position: 'relative', zIndex: 1 }}>
        <GBtn flex={1} onPress={() => setKb(true)}>
          <GIcon name="keyboard" size={20} />
        </GBtn>
        <GBtn flex={1} onPress={() => { setPlaying((p) => !p); key('play_pause'); flash(playing ? 'Pause' : 'Play'); }}>
          <GIcon name={playing ? 'pause' : 'play'} size={20} />
        </GBtn>
        <GBtn flex={1} onPress={() => { setVol((v) => Math.max(0, v - 6)); setMuted(false); key('volume_down'); flash('Vol −'); }}>
          <GIcon name="volLow" size={20} />
        </GBtn>
        <GBtn flex={1} onPress={() => { setVol((v) => Math.min(100, v + 6)); setMuted(false); key('volume_up'); flash('Vol +'); }}>
          <GIcon name="volume" size={20} />
        </GBtn>
        <GBtn flex={1} onPress={() => openDrawer('media')} active={tab != null}>
          <GIcon name="apps" size={18} />
        </GBtn>
      </div>

      {/* toast */}
      {toast && (
        <div key={toast.id} className="g-mono" style={{
          position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)',
          padding: '9px 18px', borderRadius: 999, background: 'rgba(10,14,18,0.82)',
          backdropFilter: 'blur(14px)', border: '0.75px solid var(--g-line)',
          fontSize: 12.5, color: 'var(--g-accent)', letterSpacing: 0.3,
          animation: 'g-toast-in .22s ease-out', zIndex: 30, whiteSpace: 'nowrap',
        }}>{toast.t}</div>
      )}

      {/* ── DRAWER ── */}
      {tab != null && <>
        <div onClick={() => setTab(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40, animation: 'g-qr-fade .2s' }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41,
          padding: '10px 14px 30px', borderRadius: '28px 28px 48px 48px',
          background: 'rgba(16,21,28,0.86)', backdropFilter: 'blur(var(--g-blur-lg)) saturate(160%)',
          WebkitBackdropFilter: 'blur(var(--g-blur-lg)) saturate(160%)',
          border: '0.75px solid var(--g-line)', borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.5)', maxHeight: '72%',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--g-glass-hi)' }} />
          </div>
          {/* tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 16, background: 'rgba(0,0,0,0.3)', marginBottom: 16 }}>
            {[['media','Media'],['nav','Nav'],['apps','Apps'],['tune','Tune']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={seg(tab === k)}>{l}</button>
            ))}
          </div>

          {tab === 'media' && <DrawerMedia {...{ playing, setPlaying, vol, setVol, muted, setMuted, flash }} />}
          {tab === 'nav'   && <DrawerNav   flash={flash} />}
          {tab === 'apps'  && <DrawerApps  flash={flash} />}
          {tab === 'tune'  && <DrawerTune  {...{ uiBright, setUiBright, sens, setSens, scrollSpd, setScrollSpd, flash }} />}
        </div>
      </>}

      {/* ── KEYBOARD SHEET ── */}
      {kb && <KeyboardSheet {...{ typed, setTyped, setKb, flash, hiddenInput }} />}
    </div>
  );
}

/* ── drawer: media ── */
function DrawerMedia({ playing, setPlaying, vol, setVol, muted, setMuted, flash }) {
  const tBtn = (icon, label, onP, big) => (
    <GBtn onPress={onP} accent={big} style={{ width: big ? 72 : 56, height: big ? 72 : 56, borderRadius: 999 }}>
      <GIcon name={icon} size={big ? 30 : 22} />
    </GBtn>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {tBtn('prev',   'Prev', () => { key('prev');      flash('Previous'); })}
        {tBtn('back10', 'Back', () => { key('seek_back'); flash('Back 10s'); })}
        {tBtn(playing ? 'pause' : 'play', 'Play', () => { setPlaying((p) => !p); key('play_pause'); flash(playing ? 'Pause' : 'Play'); }, true)}
        {tBtn('fwd10',  'Fwd',  () => { key('seek_fwd'); flash('Fwd 10s'); })}
        {tBtn('next',   'Next', () => { key('next');      flash('Next'); })}
      </div>
      {/* volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="g-press" onClick={() => { setMuted((m) => !m); key('mute'); flash(muted ? 'Unmuted' : 'Muted'); }}
          style={{ ...glass, width: 46, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
            color: muted ? 'var(--g-danger)' : 'var(--g-text)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GIcon name={muted ? 'mute' : 'volume'} size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <GSlider value={muted ? 0 : vol} onChange={(v) => {
            const prev = vol;
            setVol(v); setMuted(false);
            const steps = Math.round((v - prev) / 5);
            const k = steps > 0 ? 'volume_up' : 'volume_down';
            for (let i = 0; i < Math.abs(steps); i++) key(k);
          }} />
        </div>
        <div className="g-mono" style={{ width: 38, textAlign: 'right', fontSize: 13, color: 'var(--g-text-2)' }}>
          {muted ? '—' : vol}
        </div>
      </div>
      {/* stop + fullscreen */}
      <div style={{ display: 'flex', gap: 8 }}>
        <GBtn flex={1} onPress={() => { key('stop');       flash('Stop'); }} style={{ height: 48 }}>
          <GIcon name="film" size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g-text-2)' }}>Stop</span>
        </GBtn>
        <GBtn flex={1} onPress={() => { key('fullscreen'); flash('Fullscreen'); }} style={{ height: 48 }}>
          <GIcon name="fullscreen" size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g-text-2)' }}>Fullscreen</span>
        </GBtn>
      </div>
    </div>
  );
}

/* ── drawer: d-pad navigation ── */
function DrawerNav({ flash }) {
  const cell = (icon, label, k, accent) => (
    <GBtn onPress={() => { key(k); flash(label); }} accent={accent} style={{ borderRadius: accent ? 999 : 16 }}>
      <GIcon name={icon} size={accent ? 22 : 24} />
    </GBtn>
  );
  const blank = <div />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 62, gap: 8, maxWidth: 250, margin: '0 auto', width: '100%' }}>
        {blank}{cell('chevUp',    'Up',    'up')}{blank}
        {cell('chevLeft', 'Left',  'left')}{cell('ok', 'OK', 'ok', true)}{cell('chevRight', 'Right', 'right')}
        {blank}{cell('chevDown',  'Down',  'down')}{blank}
      </div>
      <div style={{ display: 'flex', gap: 8, height: 54 }}>
        <GBtn flex={1} onPress={() => { key('esc');        flash('Back / Esc'); }} style={{ gap: 8 }}>
          <GIcon name="esc" size={20} /><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g-text-2)' }}>Back</span>
        </GBtn>
        <GBtn flex={1} onPress={() => { key('fullscreen'); flash('Fullscreen'); }} style={{ gap: 8 }}>
          <GIcon name="fullscreen" size={19} /><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g-text-2)' }}>Full</span>
        </GBtn>
      </div>
    </div>
  );
}

/* ── drawer: app launcher ── */
const APPS = [
  ['J', 'Jellyfin',  285],
  ['P', 'Plex',       60],
  ['K', 'Kodi',      210],
  ['N', 'Netflix',    24],
  ['Y', 'YouTube',    12],
  ['S', 'Spotify',   150],
  ['B', 'Browser',   192],
  ['+', 'Add…',        0],
];

function DrawerApps({ flash }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingBottom: 6 }}>
      {APPS.map(([m, name, hue]) => (
        <button key={name} className="g-press"
          onClick={() => {
            if (name !== 'Add…') { send({ type: 'launch', app: name.toLowerCase() }); flash('Launching ' + name); }
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: name === 'Add…' ? 'var(--g-glass)' : `oklch(0.42 0.10 ${hue})`,
            border: name === 'Add…' ? '1px dashed var(--g-line)' : '0.75px solid rgba(255,255,255,0.12)',
            color: name === 'Add…' ? 'var(--g-text-3)' : '#fff',
            fontSize: 24, fontWeight: 700, fontFamily: 'var(--g-ui)',
          }}>{m}</div>
          <span style={{ fontSize: 11, color: 'var(--g-text-2)', fontWeight: 500 }}>{name}</span>
        </button>
      ))}
    </div>
  );
}

/* ── drawer: tune / settings ── */
function DrawerTune({ uiBright, setUiBright, sens, setSens, scrollSpd, setScrollSpd, flash }) {
  const row = (icon, label, value, set, unit = '%') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <GIcon name={icon} size={20} style={{ color: 'var(--g-text-2)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g-text-2)' }}>{label}</span>
          <span className="g-mono" style={{ fontSize: 12, color: 'var(--g-text-3)' }}>{value}{unit}</span>
        </div>
        <GSlider value={value} onChange={set} height={36} />
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 6 }}>
      {row('sun',    'Remote brightness',  uiBright,  setUiBright)}
      {row('gauge',  'Pointer speed',      sens,       setSens)}
      {row('scroll', 'Scroll speed',       scrollSpd,  setScrollSpd)}
      <GBtn danger onPress={() => { send({ type: 'key', key: 'sleep' }); flash('Sleep sent'); }}
        style={{ height: 52, borderRadius: 'var(--g-r-md)', fontFamily: 'var(--g-ui)', fontSize: 14, fontWeight: 600, gap: 9 }}>
        <GIcon name="power" size={19} />Sleep / Power off
      </GBtn>
    </div>
  );
}

/* ── keyboard sheet ── */
function KeyboardSheet({ typed, setTyped, setKb, flash, hiddenInput }) {
  useEffect(() => { if (hiddenInput.current) hiddenInput.current.focus(); }, []);

  function doSend() {
    if (typed) { send({ type: 'text', text: typed }); flash('Sent ✓'); setTyped(''); }
  }

  const special = [
    ['esc',       'Esc',  () => key('esc')],
    ['tab',       'Tab',  () => key('tab')],
    ['chevUp',    '',     () => key('up')],
    ['chevDown',  '',     () => key('down')],
    ['chevLeft',  '',     () => key('left')],
    ['chevRight', '',     () => key('right')],
    ['backspace', '',     () => setTyped((t) => t.slice(0, -1))],
    ['enter',     'Send', doSend],
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setKb(false); }}>
      <div style={{ padding: '0 14px 24px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px' }}>
          <span className="g-mono" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--g-text-3)' }}>TEXT INPUT → PC</span>
          <button onClick={() => setKb(false)} style={{ background: 'none', border: 'none', color: 'var(--g-text-2)', cursor: 'pointer', display: 'flex' }}>
            <GIcon name="close" size={20} />
          </button>
        </div>
        {/* text field */}
        <div onClick={() => hiddenInput.current && hiddenInput.current.focus()}
          style={{ ...glass, minHeight: 52, borderRadius: 'var(--g-r-md)', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 16, color: typed ? 'var(--g-text)' : 'var(--g-text-3)' }}>
          {typed || 'Type here…'}
          <span style={{ width: 2, height: 22, background: 'var(--g-accent)', marginLeft: 2, animation: 'g-pulse 1s steps(1) infinite' }} />
        </div>
        {/* real hidden input */}
        <input ref={hiddenInput} value={typed} onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSend(); } }}
          style={{ position: 'fixed', top: -100, left: 0, opacity: 0, height: 1, width: 1 }}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        />
        {/* special key strip */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {special.map(([ic, lbl, fn], i) => (
            <button key={i} className="g-press" onPointerDown={(e) => { e.preventDefault(); fn(); }}
              style={{ ...glass, flex: lbl === 'Send' ? 1.4 : 1, height: 42, borderRadius: 11, border: 'none', cursor: 'pointer',
                color: lbl === 'Send' ? 'var(--g-accent)' : 'var(--g-text-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12.5, fontWeight: 600 }}>
              <GIcon name={ic} size={17} />
              {lbl && <span>{lbl}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GlideController });
