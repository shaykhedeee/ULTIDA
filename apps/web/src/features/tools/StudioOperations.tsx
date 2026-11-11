import { CalendarDays, FileText, Plus, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

const apiBase = getApiBase;
type Event = { id: string; title: string; event_type: string; starts_at: string; status: string; notes?: string };
type Invoice = { id: string; invoice_number: string; client_name: string; total: number; status: string; due_date?: string };
type DialogKind = 'event' | 'invoice' | null;

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--line, #e2d8c9)',
  borderRadius: '8px',
  background: '#ffffff',
  color: 'var(--text-primary, #1a1208)',
  fontSize: '13px',
  boxSizing: 'border-box',
} as const;

async function readApiJson(response: Response, action: string): Promise<Record<string, any>> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object') return payload as Record<string, any>;
  } catch {
    // Reverse proxies can return an empty body or HTML during an outage.
  }
  const unavailable = response.status === 502 || response.status === 503 || response.status === 504;
  throw new Error(unavailable
    ? `${action} Studio services are temporarily unavailable. Please retry in a moment.`
    : `${action} The studio returned an unreadable response (HTTP ${response.status}).`);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export function StudioOperations({ initialTab = 'calendar' }: { initialTab?: 'calendar' | 'invoices' }) {
  const [tab, setTab] = useState(initialTab);
  const [events, setEvents] = useState<Event[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState('Loading studio operations…');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    title: '',
    eventType: 'milestone',
    startsAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [invoiceDraft, setInvoiceDraft] = useState({
    invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
    clientName: '',
    description: '',
    quantity: '1',
    rate: '',
    taxRate: '18',
    dueDate: '',
  });

  async function load() {
    try {
      setStatus('Refreshing studio operations…');
      const headers = await authHeaders();
      const [calendar, finance] = await Promise.all([
        fetch(`${apiBase()}/studio/calendar`, { headers }),
        fetch(`${apiBase()}/studio/invoices`, { headers }),
      ]);
      const c = await readApiJson(calendar, 'Calendar could not be loaded.');
      const f = await readApiJson(finance, 'Invoices could not be loaded.');
      if (!calendar.ok) throw new Error(c.message ?? 'Calendar could not be loaded.');
      if (!finance.ok) throw new Error(f.message ?? 'Invoices could not be loaded.');
      setEvents(c.events ?? []);
      setInvoices(f.invoices ?? []);
      setStatus('Operations are connected to your studio workspace.');
    } catch (error: any) {
      setStatus(error?.message ?? 'Operations could not be loaded.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitEvent() {
    if (!eventDraft.title.trim() || !eventDraft.startsAt) {
      return setStatus('Enter an event title and start date first.');
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase()}/studio/calendar`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          title: eventDraft.title,
          eventType: eventDraft.eventType,
          startsAt: new Date(eventDraft.startsAt).toISOString(),
          notes: eventDraft.notes,
        }),
      });
      const result = await readApiJson(response, 'Event could not be saved.');
      if (!response.ok) throw new Error(result.message ?? 'Event could not be saved.');
      setDialog(null);
      setEventDraft({ title: '', eventType: 'milestone', startsAt: new Date().toISOString().slice(0, 16), notes: '' });
      setStatus('Event saved.');
      await load();
    } catch (error: any) {
      setStatus(error?.message ?? 'Event could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInvoice() {
    const quantity = Number(invoiceDraft.quantity);
    const rate = Number(invoiceDraft.rate);
    if (!invoiceDraft.invoiceNumber.trim() || !invoiceDraft.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) {
      return setStatus('Enter an invoice number, line description, quantity, and rate.');
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase()}/studio/invoices`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          invoiceNumber: invoiceDraft.invoiceNumber,
          clientName: invoiceDraft.clientName,
          dueDate: invoiceDraft.dueDate || null,
          taxRate: Number(invoiceDraft.taxRate) || 0,
          items: [{ description: invoiceDraft.description, quantity, rate }],
        }),
      });
      const result = await readApiJson(response, 'Invoice could not be saved.');
      if (!response.ok) throw new Error(result.message ?? 'Invoice could not be saved.');
      setDialog(null);
      setInvoiceDraft({
        invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
        clientName: '',
        description: '',
        quantity: '1',
        rate: '',
        taxRate: '18',
        dueDate: '',
      });
      setStatus('Invoice saved as a draft.');
      await load();
    } catch (error: any) {
      setStatus(error?.message ?? 'Invoice could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header className="workspace-heading">
        <div>
          <small>STUDIO OPERATIONS</small>
          <h1 style={{ fontSize: 26, margin: '4px 0' }}>Calendar &amp; Finance</h1>
          <p role="status">{status}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} icon={<RefreshCw size={15} />}>
          Refresh
        </Button>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <nav role="tablist" aria-label="Studio operations" className="ui-tabs-track">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'calendar'}
            onClick={() => setTab('calendar')}
            className={`ui-tab-btn ${tab === 'calendar' ? 'active' : ''}`}
          >
            <CalendarDays size={15} /> Calendar
            <span className="tab-count">{events.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'invoices'}
            onClick={() => setTab('invoices')}
            className={`ui-tab-btn ${tab === 'invoices' ? 'active' : ''}`}
          >
            <FileText size={15} /> Invoices
            <span className="tab-count">{invoices.length}</span>
          </button>
        </nav>

        {tab === 'calendar' ? (
          <Button variant="gold" onClick={() => setDialog('event')} icon={<Plus size={15} />}>
            Add event
          </Button>
        ) : (
          <Button variant="gold" onClick={() => setDialog('invoice')} icon={<Plus size={15} />}>
            New invoice
          </Button>
        )}
      </div>

      {tab === 'calendar' ? (
        <section role="tabpanel" aria-label="Calendar">
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <small>SCHEDULE &amp; MILESTONES</small>
                <h2 style={{ fontSize: 18, margin: '2px 0 0' }}>Upcoming studio dates</h2>
              </div>
              <Badge tone="gold">{events.length} scheduled</Badge>
            </CardHeader>
            <CardContent style={{ display: 'grid', gap: 10 }}>
              {events.length ? (
                events.map((event) => (
                  <article
                    key={event.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: '14px 16px',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{event.title}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 4 }}>
                        {new Date(event.starts_at).toLocaleString()} · <span style={{ textTransform: 'capitalize' }}>{event.event_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <Badge tone={event.status === 'completed' ? 'success' : 'neutral'}>{event.status}</Badge>
                  </article>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>
                  No calendar events yet. Add site visits, client reviews, milestones, and payment dates here.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : (
        <section role="tabpanel" aria-label="Invoices">
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <small>BILLING &amp; RECEIVABLES</small>
                <h2 style={{ fontSize: 18, margin: '2px 0 0' }}>Invoices</h2>
              </div>
              <Badge tone="gold">{invoices.length} records</Badge>
            </CardHeader>
            <CardContent style={{ display: 'grid', gap: 10 }}>
              {invoices.length ? (
                invoices.map((invoice) => (
                  <article
                    key={invoice.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                      padding: '14px 16px',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{invoice.invoice_number}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 4 }}>
                        {invoice.client_name || 'No client'} · <span style={{ textTransform: 'capitalize' }}>{invoice.status}</span>
                      </div>
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{Number(invoice.total).toLocaleString('en-IN')}
                    </strong>
                  </article>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>
                  No invoices yet. Create one from an approved quote.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dialog === 'event' ? 'Add studio event' : 'New draft invoice'}
          className="modal-backdrop"
        >
          <section className="modal" style={{ width: 'min(510px, 100%)', position: 'relative' }}>
            <button
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
              className="icon-button"
              style={{ position: 'absolute', right: 16, top: 16 }}
            >
              <X size={16} />
            </button>
            {dialog === 'event' ? (
              <>
                <h2 style={{ margin: 0 }}>Add studio event</h2>
                <label>
                  Title
                  <input autoFocus style={fieldStyle} value={eventDraft.title} onChange={(e) => setEventDraft((v) => ({ ...v, title: e.target.value }))} />
                </label>
                <label>
                  Type
                  <select style={fieldStyle} value={eventDraft.eventType} onChange={(e) => setEventDraft((v) => ({ ...v, eventType: e.target.value }))}>
                    <option value="milestone">Milestone</option>
                    <option value="site_visit">Site visit</option>
                    <option value="client_review">Client review</option>
                    <option value="delivery">Delivery</option>
                    <option value="payment">Payment</option>
                  </select>
                </label>
                <label>
                  Starts
                  <input type="datetime-local" style={fieldStyle} value={eventDraft.startsAt} onChange={(e) => setEventDraft((v) => ({ ...v, startsAt: e.target.value }))} />
                </label>
                <label>
                  Notes
                  <textarea style={{ ...fieldStyle, minHeight: 82 }} value={eventDraft.notes} onChange={(e) => setEventDraft((v) => ({ ...v, notes: e.target.value }))} />
                </label>
                <Button variant="gold" disabled={submitting} onClick={() => void submitEvent()}>
                  {submitting ? 'Saving…' : 'Save event'}
                </Button>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0 }}>New draft invoice</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                  Create invoices from approved quote values when available. This draft records one transparent line item.
                </p>
                <label>
                  Invoice number
                  <input autoFocus style={fieldStyle} value={invoiceDraft.invoiceNumber} onChange={(e) => setInvoiceDraft((v) => ({ ...v, invoiceNumber: e.target.value }))} />
                </label>
                <label>
                  Client name
                  <input style={fieldStyle} value={invoiceDraft.clientName} onChange={(e) => setInvoiceDraft((v) => ({ ...v, clientName: e.target.value }))} />
                </label>
                <label>
                  Line description
                  <input style={fieldStyle} value={invoiceDraft.description} onChange={(e) => setInvoiceDraft((v) => ({ ...v, description: e.target.value }))} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>
                    Quantity
                    <input type="number" min="0.01" step="0.01" style={fieldStyle} value={invoiceDraft.quantity} onChange={(e) => setInvoiceDraft((v) => ({ ...v, quantity: e.target.value }))} />
                  </label>
                  <label>
                    Rate (₹)
                    <input type="number" min="0" step="0.01" style={fieldStyle} value={invoiceDraft.rate} onChange={(e) => setInvoiceDraft((v) => ({ ...v, rate: e.target.value }))} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>
                    Tax %
                    <input type="number" min="0" max="100" style={fieldStyle} value={invoiceDraft.taxRate} onChange={(e) => setInvoiceDraft((v) => ({ ...v, taxRate: e.target.value }))} />
                  </label>
                  <label>
                    Due date
                    <input type="date" style={fieldStyle} value={invoiceDraft.dueDate} onChange={(e) => setInvoiceDraft((v) => ({ ...v, dueDate: e.target.value }))} />
                  </label>
                </div>
                <Button variant="gold" disabled={submitting} onClick={() => void submitInvoice()}>
                  {submitting ? 'Saving…' : 'Save draft invoice'}
                </Button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
