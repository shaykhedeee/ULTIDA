import { CheckCircle2, CircleAlert, ClipboardCheck, LockKeyhole } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';

type Props = { briefSaved: boolean; planApproved: boolean; sceneVersionId: string | null; moduleCount: number; providerReady: boolean };
type Gate = { label: string; detail: string; ready: boolean; status: 'Ready' | 'Needs review' | 'Blocked' };

export function DeliveryWorkspace({ briefSaved, planApproved, sceneVersionId, moduleCount, providerReady }: Props) {
  const gates: Gate[] = [
    { label: 'Client brief', detail: 'Scope, budget and approval notes are saved.', ready: briefSaved, status: briefSaved ? 'Ready' : 'Blocked' },
    { label: 'Approved plan', detail: 'Measured geometry is approved for downstream work.', ready: planApproved, status: planApproved ? 'Ready' : 'Blocked' },
    { label: 'Scene version', detail: moduleCount ? `${moduleCount} modules are linked to the current scene.` : 'A scene with approved modules is required.', ready: Boolean(sceneVersionId && moduleCount), status: sceneVersionId && moduleCount ? 'Ready' : 'Blocked' },
    { label: 'Visual provenance', detail: providerReady ? 'At least one visual provider is configured.' : 'No configured provider; visual output remains unavailable.', ready: providerReady, status: providerReady ? 'Needs review' : 'Blocked' },
    { label: 'Production release', detail: 'Drawings, cutlist and quote require designer confirmation.', ready: false, status: 'Needs review' },
    { label: 'Client handover', detail: 'Installation, snagging and warranty records are not started.', ready: false, status: 'Blocked' }
  ];
  const blockers = gates.filter((gate) => !gate.ready);
  return <section className="delivery-workspace"><div className="workspace-heading"><div><small>DELIVERY / RELEASE CONTROL</small><h2>Move from design approval to handover.</h2><p>Every release gate stays visible so unfinished work is never presented as delivered.</p></div><Badge tone={blockers.length ? 'accent' : 'success'}>{blockers.length ? `${blockers.length} blockers` : 'Ready to release'}</Badge></div><div className="delivery-layout"><Card><CardHeader><div><small>RELEASE CHECKLIST</small><h3>Project readiness</h3></div><ClipboardCheck size={20} /></CardHeader><CardContent><div className="delivery-gates">{gates.map((gate) => <article key={gate.label}><div className={`delivery-icon delivery-${gate.status.toLowerCase().replace(' ', '-')}`}>{gate.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}</div><div><strong>{gate.label}</strong><p>{gate.detail}</p></div><Badge tone={gate.ready ? 'success' : 'accent'}>{gate.status}</Badge></article>)}</div></CardContent></Card><Card className="delivery-side"><CardHeader><div><small>NEXT ACTION</small><h3>{blockers[0]?.label ?? 'Release project'}</h3></div><LockKeyhole size={20} /></CardHeader><CardContent><p>{blockers[0]?.detail ?? 'All known gates are ready for release review.'}</p><div className="delivery-summary"><span>Open blockers</span><strong>{blockers.length}</strong></div><div className="delivery-summary"><span>Scene modules</span><strong>{moduleCount}</strong></div><div className="delivery-summary"><span>Release state</span><strong>{blockers.length ? 'Blocked' : 'Ready'}</strong></div></CardContent></Card></div></section>;
}
