import { CheckCircle2, CircleAlert, ClipboardCheck, LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, CardContent, CardHeader, Button } from '../ui/primitives';
import { supabase } from '../../lib/supabase';

type Props = { 
  briefSaved: boolean; 
  planApproved: boolean; 
  sceneVersionId: string | null; 
  moduleCount: number; 
  providerReady: boolean;
  projectId: string | null;
};

type DeliveryData = {
  productionReleased: boolean;
  clientApproved: boolean;
  installationStatus: 'not_started' | 'ongoing' | 'completed';
  snaggingStatus: 'none' | 'active_snags' | 'resolved';
  warrantyActive: boolean;
  notes: string;
};

const defaultDelivery: DeliveryData = {
  productionReleased: false,
  clientApproved: false,
  installationStatus: 'not_started',
  snaggingStatus: 'none',
  warrantyActive: false,
  notes: ''
};

export function DeliveryWorkspace({ briefSaved, planApproved, sceneVersionId, moduleCount, providerReady, projectId }: Props) {
  const [delivery, setDelivery] = useState<DeliveryData>(defaultDelivery);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [hasApprovedQuote, setHasApprovedQuote] = useState(false);

  useEffect(() => {
    if (!supabase || !projectId) return;
    supabase
      .from('projects')
      .select('delivery_records')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data?.delivery_records) {
          setDelivery({ ...defaultDelivery, ...data.delivery_records });
        }
      });

    supabase
      .from('quotes')
      .select('status')
      .eq('project_id', projectId)
      .eq('status', 'approved')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setHasApprovedQuote(true);
        }
      });
  }, [projectId]);

  async function handleSave() {
    if (!supabase || !projectId) return;
    setSaving(true);
    setStatusMsg('');
    const { error } = await supabase
      .from('projects')
      .update({ delivery_records: delivery })
      .eq('id', projectId);
    setSaving(false);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg('Delivery records saved successfully.');
    }
  }

  const gates = [
    { label: 'Client brief', detail: 'Scope, budget and approval notes are saved.', ready: briefSaved, status: briefSaved ? 'Ready' : 'Blocked' },
    { label: 'Approved plan', detail: 'Measured geometry is approved for downstream work.', ready: planApproved, status: planApproved ? 'Ready' : 'Blocked' },
    { label: 'Scene version', detail: moduleCount ? `${moduleCount} modules are linked to the current scene.` : 'A scene with approved modules is required.', ready: Boolean(sceneVersionId && moduleCount), status: sceneVersionId && moduleCount ? 'Ready' : 'Blocked' },
    { label: 'Visual provenance', detail: providerReady ? 'At least one visual provider is configured.' : 'No configured provider; visual output remains unavailable.', ready: providerReady, status: providerReady ? 'Ready' : 'Blocked' },
    { label: 'Production release', detail: (delivery.productionReleased && hasApprovedQuote) ? 'Drawings, cutlist and quote approved for release.' : 'Drawings, cutlist and quote require designer and quote confirmation.', ready: delivery.productionReleased && hasApprovedQuote, status: (delivery.productionReleased && hasApprovedQuote) ? 'Ready' : 'Needs review' },
    { label: 'Client handover', detail: delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive ? 'Handover completed, warranty active.' : 'Installation, snagging and warranty records are pending.', ready: delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive, status: (delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive) ? 'Ready' : 'Blocked' }
  ];

  const blockers = gates.filter((gate) => !gate.ready);

  return (
    <section className="delivery-workspace">
      <div className="workspace-heading">
        <div>
          <small>DELIVERY / RELEASE CONTROL</small>
          <h2>Move from design approval to handover.</h2>
          <p>Every release gate stays visible so unfinished work is never presented as delivered.</p>
        </div>
        <Badge tone={blockers.length ? 'accent' : 'success'}>
          {blockers.length ? `${blockers.length} blockers` : 'Ready to release'}
        </Badge>
      </div>

      <div className="delivery-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card>
            <CardHeader>
              <div>
                <small>RELEASE CHECKLIST</small>
                <h3>Project readiness</h3>
              </div>
              <ClipboardCheck size={20} />
            </CardHeader>
            <CardContent>
              <div className="delivery-gates">
                {gates.map((gate) => (
                  <article key={gate.label}>
                    <div className={`delivery-icon delivery-${gate.status.toLowerCase().replace(' ', '-')}`}>
                      {gate.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
                    </div>
                    <div>
                      <strong>{gate.label}</strong>
                      <p>{gate.detail}</p>
                    </div>
                    <Badge tone={gate.ready ? 'success' : 'accent'}>{gate.status}</Badge>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          {projectId && (
            <Card>
              <CardHeader>
                <div>
                  <small>UPDATE RECORDS</small>
                  <h3>Delivery & Handover Records</h3>
                </div>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={delivery.productionReleased} 
                    onChange={(e) => setDelivery({ ...delivery, productionReleased: e.target.checked })} 
                  />
                  <strong>Production Released (Approve drawings, DXF, cutlist, quote)</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={delivery.clientApproved} 
                    onChange={(e) => setDelivery({ ...delivery, clientApproved: e.target.checked })} 
                  />
                  <strong>Client Approval Records Signed</strong>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <strong>Installation Status</strong>
                  <select 
                    value={delivery.installationStatus} 
                    onChange={(e: any) => setDelivery({ ...delivery, installationStatus: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc' }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <strong>Snagging Records</strong>
                  <select 
                    value={delivery.snaggingStatus} 
                    onChange={(e: any) => setDelivery({ ...delivery, snaggingStatus: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc' }}
                  >
                    <option value="none">No Snags Recorded</option>
                    <option value="active_snags">Active Snags (Pending Action)</option>
                    <option value="resolved">All Snags Resolved</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={delivery.warrantyActive} 
                    onChange={(e) => setDelivery({ ...delivery, warrantyActive: e.target.checked })} 
                  />
                  <strong>Warranty Active & Registered</strong>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <strong>Delivery Notes</strong>
                  <textarea 
                    value={delivery.notes} 
                    onChange={(e) => setDelivery({ ...delivery, notes: e.target.value })}
                    placeholder="Enter site installation details, warranty registration codes, or snagging lists..."
                    style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc', minHeight: '80px' }}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Records'}
                </Button>
                {statusMsg && <p style={{ fontSize: '0.85rem', color: statusMsg.startsWith('Error') ? 'red' : 'green' }}>{statusMsg}</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="delivery-side">
          <CardHeader>
            <div>
              <small>NEXT ACTION</small>
              <h3>{blockers[0]?.label ?? 'Release project'}</h3>
            </div>
            <LockKeyhole size={20} />
          </CardHeader>
          <CardContent>
            <p>{blockers[0]?.detail ?? 'All known gates are ready for release review.'}</p>
            <div className="delivery-summary">
              <span>Open blockers</span>
              <strong>{blockers.length}</strong>
            </div>
            <div className="delivery-summary">
              <span>Scene modules</span>
              <strong>{moduleCount}</strong>
            </div>
            <div className="delivery-summary">
              <span>Release state</span>
              <strong>{blockers.length ? 'Blocked' : 'Ready'}</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
