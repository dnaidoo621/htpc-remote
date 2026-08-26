/* glide-setup.jsx — in-app device setup.
   Gated by a pairing code shown on the TV, so only someone who can see the
   screen may enter cloud credentials or change device config. */

function GlideSetup({ onClose }) {
  const { useState, useEffect, useRef } = React;

  const [step,   setStep]   = useState('locked');  // locked|code|form|picking|saving|done
  const [token,  setToken]  = useState(null);
  const [code,   setCode]   = useState('');
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState(null);
  const [found,  setFound]  = useState([]);        // LAN scan hits
  const [cloud,  setCloud]  = useState([]);        // account devices
  const [creds,  setCreds]  = useState({ region: 'eu', api_key: '', api_secret: '' });
  const [hub,    setHub]    = useState(null);
  const [remote, setRemote] = useState(null);
  const [name,   setName]   = useState('TV');

  const api = async (path, opts = {}) => {
    const r = await fetch(path, {
      method: opts.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Setup-Token': token } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
    return data;
  };

  const guard = (fn) => async (...a) => {
    setBusy(true); setErr(null);
    try { await fn(...a); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  /* Always release setup mode on unmount, so the TV doesn't sit on the code. */
  useEffect(() => () => { fetch('/setup/end', { method: 'POST' }).catch(() => {}); }, []);

  const begin = guard(async () => {
    await api('/setup/begin');
    setStep('code');
  });

  const unlock = guard(async () => {
    const { token: t } = await api('/setup/unlock', { body: { code } });
    setToken(t);
    setStep('form');
  });

  const discover = guard(async () => {
    // Scan first: gives us the hub IP, protocol version and a device id to
    // identify the account with, so the user types less.
    const { found: hits } = await api('/setup/scan');
    setFound(hits);
    if (!hits.length) throw new Error('No Tuya devices found on the LAN. Is the hub powered and on this network?');
    const { devices } = await api('/setup/cloud', {
      body: { ...creds, device_id: hits[0].device_id },
    });
    setCloud(devices);
    const parent = devices.find((d) => !d.is_remote) || null;
    setHub(parent);
    setStep('picking');
  });

  const save = guard(async () => {
    const scan = found.find((f) => f.device_id === hub.device_id) || {};
    const entry = {
      id: 'tv',
      name: name || remote.name,
      type: 'tuya_ir',
      hub_id: hub.device_id,
      remote_id: remote.device_id,
      host: scan.ip,
      local_key: hub.local_key,
      version: scan.version || 3.5,
      cloud: { ...creds },
      codes_file: 'ir_codes.json',
    };
    await api('/setup/save', { body: { devices: [entry] } });
    setStep('done');
  });

  const field = (label, key, opts = {}) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--g-text-2)',
        display: 'block', marginBottom: 5 }}>{label}</span>
      <input
        type={opts.secret ? 'password' : 'text'}
        value={creds[key]}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        onChange={(e) => setCreds((c) => ({ ...c, [key]: e.target.value }))}
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px',
          borderRadius: 12, border: '0.75px solid var(--g-line)',
          background: 'rgba(0,0,0,0.35)', color: 'var(--g-text)',
          fontSize: 16, fontFamily: 'var(--g-mono)' }} />
    </label>
  );

  const card = (children) => (
    <div style={{ ...glass, borderRadius: 20, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
  );
  const h = (t) => <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{t}</div>;
  const p = (t) => <div style={{ fontSize: 12.5, color: 'var(--g-text-2)',
    lineHeight: 1.5, marginBottom: 12 }}>{t}</div>;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'var(--g-bg)',
      overflowY: 'auto',
      paddingTop:    'calc(env(safe-area-inset-top, 0px) + 14px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      paddingLeft:   'calc(env(safe-area-inset-left, 0px) + 16px)',
      paddingRight:  'calc(env(safe-area-inset-right, 0px) + 16px)' }}>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Add a device</div>
        <button onClick={onClose} className="g-press"
          style={{ ...glass, width: 36, height: 36, borderRadius: 999, border: 'none',
            color: 'var(--g-text-2)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
          <GIcon name="close" size={19} />
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 12,
          background: 'oklch(0.70 0.16 25 / 0.12)',
          border: '0.75px solid oklch(0.70 0.16 25 / 0.45)',
          color: 'var(--g-danger)', fontSize: 12.5, lineHeight: 1.45 }}>{err}</div>
      )}

      {step === 'locked' && card(<>
        {h('Confirm you\'re in the room')}
        {p('Anyone who scans the QR code can drive the HTPC. Changing device settings needs more than that, so a code will appear on the TV.')}
        <GBtn accent onPress={begin} style={{ height: 50 }}>
          <span style={{ fontWeight: 700 }}>{busy ? 'Working…' : 'Show code on TV'}</span>
        </GBtn>
      </>)}

      {step === 'code' && card(<>
        {h('Enter the code from your TV')}
        {p('A six-digit code is now on the TV screen. It expires in five minutes.')}
        <input value={code} inputMode="numeric" maxLength={6} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px',
            borderRadius: 12, border: '0.75px solid var(--g-line)',
            background: 'rgba(0,0,0,0.35)', color: 'var(--g-text)',
            fontSize: 26, letterSpacing: 8, textAlign: 'center',
            fontFamily: 'var(--g-mono)', marginBottom: 12 }} />
        <GBtn accent onPress={unlock} style={{ height: 50 }}>
          <span style={{ fontWeight: 700 }}>{busy ? 'Checking…' : 'Unlock'}</span>
        </GBtn>
      </>)}

      {step === 'form' && card(<>
        {h('Tuya account')}
        {p('From iot.tuya.com → your Cloud Project → Overview. Used once to read your device list and keys; after that Glide talks to the hub directly.')}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--g-text-2)',
            display: 'block', marginBottom: 5 }}>Data centre</span>
          <select value={creds.region}
            onChange={(e) => setCreds((c) => ({ ...c, region: e.target.value }))}
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px',
              borderRadius: 12, border: '0.75px solid var(--g-line)',
              background: 'rgba(0,0,0,0.35)', color: 'var(--g-text)', fontSize: 16 }}>
            {['eu', 'eu-w', 'us', 'us-e', 'cn', 'in', 'sg'].map((r) =>
              <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {field('Access ID', 'api_key')}
        {field('Access Secret', 'api_secret', { secret: true })}
        <div className="g-mono" style={{ fontSize: 10.5, color: 'var(--g-text-3)',
          lineHeight: 1.5, marginBottom: 12 }}>
          Glide is served over plain HTTP on your LAN, so these are not encrypted
          in transit. They're stored on the HTPC readable only by you, and are
          never sent back to this page.
        </div>
        <GBtn accent onPress={discover} style={{ height: 50 }}>
          <span style={{ fontWeight: 700 }}>{busy ? 'Scanning…' : 'Find my devices'}</span>
        </GBtn>
      </>)}

      {step === 'picking' && card(<>
        {h('Pick your TV')}
        {p(`Found ${found.length} hub(s) on the LAN and ${cloud.length} device(s) on the account. Choose the remote that matches your TV.`)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {cloud.filter((d) => d.is_remote).map((d) => (
            <button key={d.device_id} className="g-press"
              onClick={() => { setRemote(d); setName(d.name); }}
              style={{ ...glass, textAlign: 'left', padding: '12px 14px', borderRadius: 13,
                cursor: 'pointer', border: remote?.device_id === d.device_id
                  ? '1px solid var(--g-accent)' : '0.75px solid var(--g-line)',
                background: remote?.device_id === d.device_id
                  ? 'var(--g-accent-dim)' : 'var(--g-glass)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--g-text)' }}>{d.name}</div>
              <div className="g-mono" style={{ fontSize: 10.5, color: 'var(--g-text-3)' }}>
                {d.category || 'remote'}
              </div>
            </button>
          ))}
          {!cloud.some((d) => d.is_remote) && (
            <div style={{ fontSize: 12.5, color: 'var(--g-text-2)', lineHeight: 1.5 }}>
              No remotes configured yet. Add your TV in the Smart Life app first,
              then come back — or set the hub up here and teach the buttons from
              your physical remote.
            </div>
          )}
        </div>
        {remote && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--g-text-2)',
              display: 'block', marginBottom: 5 }}>Name shown on the tab</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px',
                borderRadius: 12, border: '0.75px solid var(--g-line)',
                background: 'rgba(0,0,0,0.35)', color: 'var(--g-text)', fontSize: 16 }} />
          </label>
        )}
        <GBtn accent={!!remote} onPress={() => remote && save()} style={{ height: 50 }}>
          <span style={{ fontWeight: 700 }}>
            {busy ? 'Saving…' : remote ? 'Save device' : 'Select a remote'}
          </span>
        </GBtn>
      </>)}

      {step === 'done' && card(<>
        {h('Device added')}
        {p('It now has its own tab. If a button does nothing, use Teach mode to learn that button straight from your physical remote — those codes work without the cloud.')}
        <GBtn accent onPress={() => { onClose(); window.location.reload(); }} style={{ height: 50 }}>
          <span style={{ fontWeight: 700 }}>Done</span>
        </GBtn>
      </>)}
    </div>
  );
}

Object.assign(window, { GlideSetup });
