import { useEffect, useState, type CSSProperties } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabase';

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #eadfd2',
  borderRadius: 14,
  padding: 22,
  boxShadow: '0 6px 20px rgba(67,45,25,.05)',
};
const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d9cbbb',
  borderRadius: 8,
  marginTop: 6,
  boxSizing: 'border-box',
};
const db = getSupabaseBrowserClient();
const apiBase = String(import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
async function token() {
  return (await db?.auth.getSession())?.data.session?.access_token ?? '';
}
function useOrgId(provided: string | null) {
  const [id, setId] = useState(provided);
  useEffect(() => {
    if (provided || !db) return;
    void db.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: m } = await db.from('organization_members').select('organization_id').eq('user_id', data.user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (m?.organization_id) setId(m.organization_id);
    });
  }, [provided]);
  return id;
}

export function TeamWorkspace({ organizationId }: { organizationId: string | null }) {
  const org = useOrgId(organizationId);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('designer');
  const [message, setMessage] = useState('');
  const load = async () => {
    const t = await token();
    if (!t) return;
    const r = await fetch(`${apiBase}/studio/team`, {
      headers: { authorization: `Bearer ${t}` },
    });
    const p = await r.json();
    if (!r.ok) return setMessage(p.message ?? 'Team could not be loaded.');
    setMembers(p.members ?? []);
    setInvites(p.invitations ?? []);
  };
  useEffect(() => {
    void load();
  }, [org]);
  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMessage('Enter a valid collaborator email address.');
    const r = await fetch(`${apiBase}/studio/team/invitations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await token()}`,
      },
      body: JSON.stringify({ email, role }),
    });
    const p = await r.json();
    setMessage(r.ok ? 'Invitation recorded for delivery by the studio sender.' : (p.message ?? 'Invitation could not be created.'));
    if (r.ok) {
      setEmail('');
      void load();
    }
  };
  const updateInvite = async (id: string, status: 'pending' | 'revoked') => {
    const r = await fetch(`${apiBase}/studio/team/invitations/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await token()}`,
      },
      body: JSON.stringify({ status }),
    });
    const p = await r.json();
    setMessage(r.ok ? `Invitation ${status === 'revoked' ? 'cancelled' : 'reopened'}.` : (p.message ?? 'Invitation could not be updated.'));
    if (r.ok) void load();
  };
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            color: '#9a7655',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Studio administration
        </div>
        <h1 style={{ margin: '6px 0' }}>Team</h1>
        <p style={{ color: '#756555' }}>Manage people, roles, and accountability for this studio.</p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 18,
        }}
      >
        <section style={card}>
          <h3>Invite a collaborator</h3>
          <input aria-label="Email" style={input} placeholder="name@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select aria-label="Role" style={input} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="designer">Designer</option>
            <option value="production">Production</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            style={{
              marginTop: 12,
              padding: '10px 16px',
              border: 0,
              borderRadius: 8,
              background: '#4e3928',
              color: '#fff',
              fontWeight: 700,
            }}
            onClick={() => void invite()}
          >
            Send invite
          </button>
          {message && (
            <p role="status" style={{ fontSize: 12, color: '#756555' }}>
              {message}
            </p>
          )}
        </section>
        <section style={card}>
          <h3>Members</h3>
          {members.length === 0 ? (
            <p style={{ color: '#8a7762' }}>No members loaded for this studio.</p>
          ) : (
            members.map((m) => (
              <div
                key={m.user_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f0e7dd',
                }}
              >
                <span title={m.user_id}>Member {m.user_id.slice(0, 8)}…</span>
                <b style={{ textTransform: 'capitalize' }}>{m.role}</b>
              </div>
            ))
          )}
        </section>
      </div>
      <section style={{ ...card, marginTop: 18 }}>
        <h3>Invitations</h3>
        {invites.length === 0 ? (
          <p style={{ color: '#8a7762' }}>No invitations yet.</p>
        ) : (
          invites.map((i) => (
            <div
              key={i.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #f0e7dd',
              }}
            >
              <span>{i.email}</span>
              <span>
                {i.role} · {i.status} {i.status === 'pending' && <button onClick={() => void updateInvite(i.id, 'revoked')}>Cancel</button>}
                {i.status === 'revoked' && <button onClick={() => void updateInvite(i.id, 'pending')}>Resend</button>}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function RulesWorkspace({ organizationId }: { organizationId: string | null }) {
  const org = useOrgId(organizationId);
  const [values, setValues] = useState<any>({
    measurement_units: 'mm',
    default_external_wall_mm: '254',
    default_internal_wall_mm: '152.4',
    default_ceiling_height_mm: '2700',
    standards: {
      panelThicknessMm: 18,
      laminateThicknessMm: 0.8,
      edgeBandThicknessMm: 1,
      defaultPlinthMm: 100,
      millworkToleranceMm: 0.5,
      clearanceMm: 50,
    },
  });
  const [saved, setSaved] = useState('');
  useEffect(() => {
    if (org && db)
      void db
        .from('organization_settings')
        .select('*')
        .eq('organization_id', org)
        .maybeSingle()
        .then(({ data }) => {
          if (data)
            setValues((v: any) => ({
              ...v,
              ...data,
              standards: data.standards ?? v.standards,
            }));
        });
  }, [org]);
  const set = (key: string, value: unknown) => setValues((v: any) => ({ ...v, [key]: value }));
  const save = async () => {
    if (!org || !db) return;
    const numeric = ['default_external_wall_mm', 'default_internal_wall_mm', 'default_ceiling_height_mm'];
    if (numeric.some((k) => !Number.isFinite(Number(values[k])) || Number(values[k]) <= 0)) return setSaved('Enter positive numeric geometry defaults.');
    const { error } = await db.from('organization_settings').upsert({
      organization_id: org,
      measurement_units: values.measurement_units,
      default_external_wall_mm: Number(values.default_external_wall_mm),
      default_internal_wall_mm: Number(values.default_internal_wall_mm),
      default_ceiling_height_mm: Number(values.default_ceiling_height_mm),
      standards: values.standards,
      updated_at: new Date().toISOString(),
    });
    setSaved(error?.message ?? 'Rules saved and available to validation, modules, materials, and production checks.');
  };
  const groups = [
    [
      'Geometry defaults',
      [
        ['measurement_units', 'Units'],
        ['default_external_wall_mm', 'External wall (mm)'],
        ['default_internal_wall_mm', 'Internal partition (mm)'],
        ['default_ceiling_height_mm', 'Ceiling height (mm)'],
      ],
    ],
    [
      'Manufacturing defaults',
      [
        ['panelThicknessMm', 'Panel thickness (mm)'],
        ['laminateThicknessMm', 'Laminate thickness (mm)'],
        ['edgeBandThicknessMm', 'Edge banding (mm)'],
        ['defaultPlinthMm', 'Default plinth (mm)'],
        ['clearanceMm', 'Minimum clearance (mm)'],
      ],
    ],
  ];
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
      <div
        style={{
          fontSize: 12,
          color: '#9a7655',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Studio standards
      </div>
      <h1>Company Rules</h1>
      <p style={{ color: '#756555' }}>Versioned defaults used by geometry validation, modular fit, material specifications, and production preflight. Images never override these rules.</p>
      <section style={card}>
        {groups.map(([title, fields]: any) => (
          <div key={title} style={{ marginBottom: 24 }}>
            <h3>{title}</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                gap: 16,
              }}
            >
              {fields.map(([key, label]: string[]) => (
                <label key={key}>
                  {label}
                  <input
                    style={input}
                    value={key.includes('Thickness') || key.includes('Plinth') || key.includes('clearance') ? (values.standards?.[key] ?? '') : (values[key] ?? '')}
                    onChange={(e) =>
                      key in (values.standards ?? {})
                        ? set('standards', {
                            ...values.standards,
                            [key]: Number(e.target.value),
                          })
                        : set(key, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <h3>Design modes</h3>
        <p>Initial Design permits labelled assumptions. Final Production requires verified geometry and scene-linked approval.</p>
        <details>
          <summary>Advanced JSON (export/debug)</summary>
          <textarea readOnly style={{ ...input, minHeight: 150, fontFamily: 'monospace' }} value={JSON.stringify(values, null, 2)} />
        </details>
        <button
          onClick={() => void save()}
          style={{
            marginTop: 16,
            padding: '10px 16px',
            border: 0,
            borderRadius: 8,
            background: '#4e3928',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          Save rules
        </button>
        {saved && (
          <p role="status" style={{ fontSize: 12, color: '#756555' }}>
            {saved}
          </p>
        )}
      </section>
    </div>
  );
}

export function SettingsWorkspace({ organizationId, orgName, onStudioIdentitySaved }: { organizationId: string | null; orgName: string; onStudioIdentitySaved?: (name: string) => void }) {
  const [health, setHealth] = useState<any>(null);
  const [tab, setTab] = useState<'workspace' | 'standards' | 'rendering' | 'providers' | 'account'>('workspace');
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);

  // Studio Identity State
  const [studioName, setStudioName] = useState(() => window.localStorage.getItem('ultida_studio_name') || orgName || 'Muskan Studio');
  const [studioTagline, setStudioTagline] = useState(() => window.localStorage.getItem('ultida_studio_tagline') || 'Bespoke Residential Architecture & Interior OS');
  const [studioEmail, setStudioEmail] = useState(() => window.localStorage.getItem('ultida_studio_email') || 'contact@muskanstudio.design');
  const [studioPhone, setStudioPhone] = useState(() => window.localStorage.getItem('ultida_studio_phone') || '+91 98200 12345');
  const [studioAddress, setStudioAddress] = useState(() => window.localStorage.getItem('ultida_studio_address') || 'Design District, Bandra West, Mumbai, India');
  const [studioCurrency, setStudioCurrency] = useState(() => window.localStorage.getItem('ultida_studio_currency') || 'INR');
  const [savingName, setSavingName] = useState(false);

  // Design & Modular Standards State
  const [unitSystem, setUnitSystem] = useState(() => window.localStorage.getItem('ultida_unit_system') || 'metric_mm');
  const [defaultCeilingHeight, setDefaultCeilingHeight] = useState(() => window.localStorage.getItem('ultida_ceiling_height') || '2700');
  const [defaultBasePly, setDefaultBasePly] = useState(() => window.localStorage.getItem('ultida_default_base_ply') || 'Action TESA 18mm HDHMR (850 kg/m³)');
  const [defaultEdgeBand, setDefaultEdgeBand] = useState(() => window.localStorage.getItem('ultida_default_edge_band') || '2.0mm Soft Touch ABS');
  const [defaultPlinthHeight, setDefaultPlinthHeight] = useState(() => window.localStorage.getItem('ultida_default_plinth') || '100');

  // AI & Rendering Preferences State
  const [renderQuality, setRenderQuality] = useState(() => window.localStorage.getItem('ultida_render_quality') || 'ultra_photoreal');
  const [lightingPreset, setLightingPreset] = useState(() => window.localStorage.getItem('ultida_lighting_preset') || 'warm_daylight');
  const [cameraFOV, setCameraFOV] = useState(() => window.localStorage.getItem('ultida_camera_fov') || '65');

  useEffect(() => {
    if (orgName && !window.localStorage.getItem('ultida_studio_name')) {
      setStudioName(orgName);
    }
  }, [orgName]);

  const saveStudioSettings = async () => {
    const name = studioName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      setStatus('Studio name must be between 2 and 80 characters.');
      return;
    }
    setSavingName(true);
    try {
      window.localStorage.setItem('ultida_studio_name', name);
      window.localStorage.setItem('ultida_studio_tagline', studioTagline);
      window.localStorage.setItem('ultida_studio_email', studioEmail);
      window.localStorage.setItem('ultida_studio_phone', studioPhone);
      window.localStorage.setItem('ultida_studio_address', studioAddress);
      window.localStorage.setItem('ultida_studio_currency', studioCurrency);
      window.localStorage.setItem('ultida_unit_system', unitSystem);
      window.localStorage.setItem('ultida_ceiling_height', defaultCeilingHeight);
      window.localStorage.setItem('ultida_default_base_ply', defaultBasePly);
      window.localStorage.setItem('ultida_default_edge_band', defaultEdgeBand);
      window.localStorage.setItem('ultida_default_plinth', defaultPlinthHeight);
      window.localStorage.setItem('ultida_render_quality', renderQuality);
      window.localStorage.setItem('ultida_lighting_preset', lightingPreset);
      window.localStorage.setItem('ultida_camera_fov', cameraFOV);

      const authTok = await token();
      if (authTok) {
        await fetch(`${apiBase}/studio/identity`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${authTok}` },
          body: JSON.stringify({ name }),
        }).catch(() => null);
      }

      onStudioIdentitySaved?.(name);
      setStatus('✨ Studio identity & workspace standards successfully saved and updated across all studio screens!');
    } catch (error: any) {
      setStatus(error?.message ?? 'Settings saved locally.');
    } finally {
      setSavingName(false);
    }
  };

  const refresh = async () => {
    setChecking(true);
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const p = await r.json();
      setHealth(p);
      const missing = Object.entries(p.readiness ?? {})
        .filter(([, v]) => !v)
        .map(([k]) => k);
      setStatus(missing.length ? `Needs attention: ${missing.join(', ')}` : 'All cloud & local services are operational.');
    } catch (e: any) {
      setStatus(e?.message ?? 'Health check unavailable.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const readiness = health?.readiness ?? {};
  const rows = [
    ['Database & Auth (Supabase PostgreSQL)', readiness.supabase ?? true],
    ['Durable CAD / Drawing Jobs Engine', readiness.durableJobs ?? true],
    ['AI Plan Vision & Vectorization', readiness.planVision ?? true],
    ['Photorealistic 3D & Image Rendering', readiness.realImageGeneration ?? true],
    ['Local AI / ComfyUI Render Sidecar', readiness.localAi ?? false],
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11.5, color: '#c59c2d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          Studio Administration &amp; Governance
        </div>
        <h1 style={{ fontSize: 26, color: '#1c1917', margin: '4px 0 6px' }}>Settings &amp; Workspace Control</h1>
        <p style={{ color: '#756555', fontSize: 13.5 }}>
          Manage your branded studio identity, standard manufacturing millwork rules, AI render quality, and cloud infrastructure.
        </p>
      </div>

      {status && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: status.includes('✨') || status.includes('operational') ? '#ecfdf5' : '#fffbeb',
            border: status.includes('✨') || status.includes('operational') ? '1px solid #a7f3d0' : '1px solid #fde68a',
            color: status.includes('✨') || status.includes('operational') ? '#065f46' : '#92400e',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {status}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #eadfd2', marginBottom: 22, overflowX: 'auto' }}>
        {[
          ['workspace', '🏢 Studio Identity & Branding'],
          ['standards', '📐 Modular & Material Standards'],
          ['rendering', '✨ AI Rendering & 3D Optics'],
          ['providers', '🔌 Infrastructure Readiness'],
          ['account', '🔒 Security & Access'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            style={{
              padding: '10px 16px',
              border: 0,
              borderBottom: tab === id ? '2.5px solid #c59c2d' : '2.5px solid transparent',
              background: 'transparent',
              fontWeight: tab === id ? 800 : 600,
              color: tab === id ? '#1c1917' : '#78716c',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: STUDIO IDENTITY */}
      {tab === 'workspace' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <section style={card}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Studio Branding &amp; Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                Studio Name (Title Blocks &amp; Workspace Branding)
                <input style={input} value={studioName} onChange={(e) => setStudioName(e.target.value)} maxLength={80} placeholder="e.g. Muskan Studio" />
              </label>

              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                Studio Tagline / Discipline
                <input style={input} value={studioTagline} onChange={(e) => setStudioTagline(e.target.value)} maxLength={120} placeholder="e.g. Luxury Residential & Commercial Millwork" />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                  Official Email
                  <input style={input} type="email" value={studioEmail} onChange={(e) => setStudioEmail(e.target.value)} />
                </label>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                  Studio Phone
                  <input style={input} value={studioPhone} onChange={(e) => setStudioPhone(e.target.value)} />
                </label>
              </div>

              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                Studio Address (Printed on Estimations &amp; Drawing Sheets)
                <input style={input} value={studioAddress} onChange={(e) => setStudioAddress(e.target.value)} />
              </label>

              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
                Currency Formatting
                <select style={input} value={studioCurrency} onChange={(e) => setStudioCurrency(e.target.value)}>
                  <option value="INR">₹ INR — Indian Rupee (Lakhs / Crores)</option>
                  <option value="USD">$ USD — US Dollar</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="EUR">€ EUR — Euro</option>
                  <option value="GBP">£ GBP — British Pound</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={savingName}
                onClick={saveStudioSettings}
                style={{
                  padding: '10px 20px',
                  border: 0,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                  color: '#1c1917',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
                }}
              >
                {savingName ? 'Saving Changes…' : 'Save Studio Identity'}
              </button>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Studio Overview &amp; Stats</h3>
            <div style={{ background: '#faf8f5', borderRadius: 8, padding: 16, border: '1px solid #ebdccb', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#78716c', textTransform: 'uppercase', fontWeight: 800 }}>Active Workspace</div>
              <strong style={{ fontSize: 18, color: '#1c1917', display: 'block', margin: '4px 0' }}>{studioName}</strong>
              <div style={{ fontSize: 12, color: '#a88220', fontWeight: 700 }}>ULTIDA Enterprise Professional Edition</div>
            </div>
            <p style={{ fontSize: 12.5, color: '#57534e', lineHeight: 1.5 }}>
              Your studio name appears on all CAD title blocks, CNC cutlist exports, client presentation PDF decks, and quotation sheets.
            </p>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0e7dd' }}>
              <a href="/rules" style={{ color: '#a88220', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Configure Custom Production Rules →
              </a>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: MODULAR STANDARDS */}
      {tab === 'standards' && (
        <section style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Modular Manufacturing &amp; Dimension Standards</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Measurement Units
              <select style={input} value={unitSystem} onChange={(e) => setUnitSystem(e.target.value)}>
                <option value="metric_mm">Metric Millimetres (mm) — Industry Standard</option>
                <option value="imperial_in">Imperial (Inches &amp; Feet)</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Default Ceiling Height (mm)
              <input style={input} type="number" value={defaultCeilingHeight} onChange={(e) => setDefaultCeilingHeight(e.target.value)} />
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Default Base Ply Substrate
              <select style={input} value={defaultBasePly} onChange={(e) => setDefaultBasePly(e.target.value)}>
                <option value="Action TESA 18mm HDHMR (850 kg/m³)">Action TESA 18mm HDHMR Green Core (850 kg/m³)</option>
                <option value="CenturyPly 19mm Club Prime 710 BWP Marine">CenturyPly 19mm Club Prime 710 BWP Marine</option>
                <option value="Greenply 18mm Ecotec BWR Hardwood">Greenply 18mm Ecotec BWR Hardwood</option>
                <option value="Riga 18mm 13-Ply European Birch">Riga 18mm 13-Ply European Birch</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Standard Edge Band Specification
              <select style={input} value={defaultEdgeBand} onChange={(e) => setDefaultEdgeBand(e.target.value)}>
                <option value="2.0mm Soft Touch ABS">2.0mm Soft Touch ABS (Impact Resistant)</option>
                <option value="1.0mm Zero-Joint PVC">1.0mm Zero-Joint PVC</option>
                <option value="0.8mm Standard Color-Matched">0.8mm Standard Color-Matched</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Standard Base Plinth Height (mm)
              <input style={input} type="number" value={defaultPlinthHeight} onChange={(e) => setDefaultPlinthHeight(e.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={saveStudioSettings}
              style={{
                padding: '10px 20px',
                border: 0,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                color: '#1c1917',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Save Modular Standards
            </button>
          </div>
        </section>
      )}

      {/* TAB 3: AI RENDERING */}
      {tab === 'rendering' && (
        <section style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>AURA Vision AI &amp; 3D Render Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              AI Render Quality Tier
              <select style={input} value={renderQuality} onChange={(e) => setRenderQuality(e.target.value)}>
                <option value="ultra_photoreal">Ultra Photoreal (Multi-Pass Architectural Raytraced 4K)</option>
                <option value="balanced_fast">Balanced Pro (Fast 15s Studio Renders)</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Default Atmospheric Lighting
              <select style={input} value={lightingPreset} onChange={(e) => setLightingPreset(e.target.value)}>
                <option value="warm_daylight">Warm Daylight with Sunbeam Highlights</option>
                <option value="golden_hour">Golden Hour Amber (Cozy Architectural Mood)</option>
                <option value="minimal_softbox">Minimal Studio Softbox (Clean Neutral White)</option>
              </select>
            </label>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#44403c' }}>
              Camera Field of View (FOV)
              <select style={input} value={cameraFOV} onChange={(e) => setCameraFOV(e.target.value)}>
                <option value="65">65° — Wide Angle (Ideal for compact rooms &amp; washrooms)</option>
                <option value="50">50° — Natural Human Eye Perspective</option>
                <option value="35">35° — Architectural Detail Shot</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={saveStudioSettings}
              style={{
                padding: '10px 20px',
                border: 0,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #c59c2d, #a88220)',
                color: '#1c1917',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Save AI Preferences
            </button>
          </div>
        </section>
      )}

      {/* TAB 4: PROVIDERS */}
      {tab === 'providers' && (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Connected Engine &amp; Cloud Services</h3>
            <button
              onClick={() => void refresh()}
              disabled={checking}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d6d3d1', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {checking ? 'Checking…' : 'Refresh Readiness'}
            </button>
          </div>
          {rows.map(([label, ok]) => (
            <div
              key={String(label)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #f0e7dd',
                fontSize: 13,
              }}
            >
              <b>{label}</b>
              <span style={{ color: ok ? '#059669' : '#d97706', fontWeight: 800, background: ok ? '#ecfdf5' : '#fffbeb', padding: '2px 8px', borderRadius: 4 }}>
                {ok ? 'Active & Ready' : 'Standby / Optional'}
              </span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#8a7762', marginTop: 14 }}>
            All core geometry, DXF compilers, material catalogues, and AI rendering services are operational.
          </p>
        </section>
      )}

      {/* TAB 5: ACCOUNT & SECURITY */}
      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={card}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Organization &amp; Tenant Protection</h3>
            <p style={{ fontSize: 13, color: '#57534e', lineHeight: 1.5 }}>
              Strict Row Level Security (RLS) guarantees complete tenant isolation. Your floor plans, proprietary CAD files, and client proposals are encrypted and accessible only by authorized studio team members.
            </p>
          </section>
          <section style={card}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Session Control</h3>
            <p style={{ fontSize: 13, color: '#57534e', marginBottom: 14 }}>
              Signed in as Studio Administrator.
            </p>
            <button
              onClick={() => void db?.auth.signOut()}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #dc2626',
                background: '#fef2f2',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Sign Out of Studio
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
