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

export function SettingsWorkspace({ organizationId, orgName }: { organizationId: string | null; orgName: string }) {
  const [health, setHealth] = useState<any>(null);
  const [tab, setTab] = useState('workspace');
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const [studioName, setStudioName] = useState(orgName || 'ULTIDA Studio');
  const [savingName, setSavingName] = useState(false);
  useEffect(() => setStudioName(orgName || 'ULTIDA Studio'), [orgName]);
  const saveStudioName = async () => {
    const name = studioName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      setStatus('Studio name must be between 2 and 80 characters.');
      return;
    }
    setSavingName(true);
    try {
      const response = await fetch(`${apiBase}/studio/identity`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Studio name could not be updated.');
      setStudioName(payload.organization.name);
      setStatus('Studio identity saved. Navigation will use the new name after refresh.');
    } catch (error: any) {
      setStatus(error?.message ?? 'Studio name could not be updated.');
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
      setStatus(missing.length ? `Needs attention: ${missing.join(', ')}` : 'All required services are ready.');
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
    ['Database', readiness.supabase],
    ['Durable jobs', readiness.durableJobs],
    ['Plan vision', readiness.planVision],
    ['Image generation', readiness.realImageGeneration],
  ];
  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 12,
            color: '#9a7655',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Studio control center
        </div>
        <h1>Settings</h1>
        <p style={{ color: '#756555' }}>Manage studio identity, defaults, notifications, account security, and live provider readiness.</p>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid #eadfd2',
          marginBottom: 18,
        }}
      >
        {[
          ['workspace', 'Workspace'],
          ['providers', 'Providers'],
          ['account', 'Account & security'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '10px 14px',
              border: 0,
              borderBottom: tab === id ? '2px solid #4e3928' : '2px solid transparent',
              background: 'transparent',
              fontWeight: 700,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'workspace' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap: 18,
          }}
        >
          <section style={card}>
            <h3>Studio identity</h3>
            <label>
              Studio name
              <input style={input} value={studioName} onChange={(event) => setStudioName(event.target.value)} maxLength={80} />
            </label>
            <p style={{ fontSize: 12, color: '#8a7762' }}>Studio owners and administrators can update this protected identity.</p>
            <button disabled={savingName || studioName.trim() === (orgName || 'ULTIDA Studio')} onClick={() => void saveStudioName()} style={{ padding: '9px 13px', border: 0, borderRadius: 8, background: '#8a5a32', color: '#fff', fontWeight: 700, marginRight: 8 }}>
              {savingName ? 'Saving…' : 'Save studio name'}
            </button>
            <button
              disabled={checking}
              onClick={() => void refresh()}
              style={{
                padding: '9px 13px',
                border: 0,
                borderRadius: 8,
                background: '#4e3928',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {checking ? 'Checking…' : 'Verify live connection'}
            </button>
          </section>
          <section style={card}>
            <h3>Design defaults</h3>
            <p>Millimetres (mm) · Initial Design assumptions visible · Final Production verification required</p>
            <a href="/rules" style={{ color: '#8a5a32', fontWeight: 700 }}>
              Manage Company Rules →
            </a>
          </section>
        </div>
      )}
      {tab === 'providers' && (
        <section style={card}>
          <button onClick={() => void refresh()} disabled={checking}>
            Refresh readiness
          </button>
          {rows.map(([label, ok]) => (
            <div
              key={String(label)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: '1px solid #f0e7dd',
              }}
            >
              <b>{label}</b>
              <span style={{ color: ok ? '#166534' : '#92400e', fontWeight: 800 }}>{ok ? 'Ready' : 'Needs setup'}</span>
            </div>
          ))}
          <p role="status">{status}</p>
          <p style={{ fontSize: 12, color: '#8a7762' }}>LocalAI and ComfyUI remain optional and are shown unavailable until their own health checks succeed.</p>
        </section>
      )}
      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <section style={card}>
            <h3>Data protection</h3>
            <p>Organization RLS protects project, reference, plan, scene, and delivery data.</p>
            <p>Leaked-password protection is an accepted deferred Pro feature and is not a launch blocker.</p>
          </section>
          <section style={card}>
            <h3>Session</h3>
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          </section>
        </div>
      )}
    </div>
  );
}
