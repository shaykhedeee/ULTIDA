import { CalendarDays, FileText, Plus, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function apiBase() { return String(import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, ''); }
type Event = { id: string; title: string; event_type: string; starts_at: string; status: string; notes?: string };
type Invoice = { id: string; invoice_number: string; client_name: string; total: number; status: string; due_date?: string };
type DialogKind = 'event' | 'invoice' | null;

const actionButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 0, borderRadius: 8, background: '#493322', color: '#fff', fontWeight: 700, cursor: 'pointer' } as const;
const field = { width: '100%', padding: '9px 10px', border: '1px solid #d8cabb', borderRadius: 8, boxSizing: 'border-box' } as const;

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
  const [eventDraft, setEventDraft] = useState({ title: '', eventType: 'milestone', startsAt: new Date().toISOString().slice(0, 16), notes: '' });
  const [invoiceDraft, setInvoiceDraft] = useState({ invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`, clientName: '', description: '', quantity: '1', rate: '', taxRate: '18', dueDate: '' });

  async function load() {
    try {
      setStatus('Refreshing studio operations…');
      const headers = await authHeaders();
      const [calendar, finance] = await Promise.all([fetch(`${apiBase()}/studio/calendar`, { headers }), fetch(`${apiBase()}/studio/invoices`, { headers })]);
      const c = await calendar.json(); const f = await finance.json();
      if (!calendar.ok) throw new Error(c.message ?? 'Calendar could not be loaded.');
      if (!finance.ok) throw new Error(f.message ?? 'Invoices could not be loaded.');
      setEvents(c.events ?? []); setInvoices(f.invoices ?? []);
      setStatus('Operations are connected to your studio workspace.');
    } catch (error: any) { setStatus(error?.message ?? 'Operations could not be loaded.'); }
  }
  useEffect(() => { void load(); }, []);

  async function submitEvent() {
    if (!eventDraft.title.trim() || !eventDraft.startsAt) return setStatus('Enter an event title and start date first.');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase()}/studio/calendar`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ title: eventDraft.title, eventType: eventDraft.eventType, startsAt: new Date(eventDraft.startsAt).toISOString(), notes: eventDraft.notes }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Event could not be saved.');
      setDialog(null); setEventDraft({ title: '', eventType: 'milestone', startsAt: new Date().toISOString().slice(0, 16), notes: '' }); setStatus('Event saved.'); await load();
    } catch (error: any) { setStatus(error?.message ?? 'Event could not be saved.'); } finally { setSubmitting(false); }
  }

  async function submitInvoice() {
    const quantity = Number(invoiceDraft.quantity); const rate = Number(invoiceDraft.rate);
    if (!invoiceDraft.invoiceNumber.trim() || !invoiceDraft.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) return setStatus('Enter an invoice number, line description, quantity, and rate.');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase()}/studio/invoices`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ invoiceNumber: invoiceDraft.invoiceNumber, clientName: invoiceDraft.clientName, dueDate: invoiceDraft.dueDate || null, taxRate: Number(invoiceDraft.taxRate) || 0, items: [{ description: invoiceDraft.description, quantity, rate }] }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Invoice could not be saved.');
      setDialog(null); setInvoiceDraft({ invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`, clientName: '', description: '', quantity: '1', rate: '', taxRate: '18', dueDate: '' }); setStatus('Invoice saved as a draft.'); await load();
    } catch (error: any) { setStatus(error?.message ?? 'Invoice could not be saved.'); } finally { setSubmitting(false); }
  }

  const dialogContent = dialog === 'event' ? <><h2 style={{ marginTop: 0 }}>Add studio event</h2><label>Title<input autoFocus style={field} value={eventDraft.title} onChange={e => setEventDraft(v => ({ ...v, title: e.target.value }))} /></label><label style={{ display: 'block', marginTop: 12 }}>Type<select style={field} value={eventDraft.eventType} onChange={e => setEventDraft(v => ({ ...v, eventType: e.target.value }))}><option value="milestone">Milestone</option><option value="site_visit">Site visit</option><option value="client_review">Client review</option><option value="delivery">Delivery</option><option value="payment">Payment</option></select></label><label style={{ display: 'block', marginTop: 12 }}>Starts<input type="datetime-local" style={field} value={eventDraft.startsAt} onChange={e => setEventDraft(v => ({ ...v, startsAt: e.target.value }))} /></label><label style={{ display: 'block', marginTop: 12 }}>Notes<textarea style={{ ...field, minHeight: 82 }} value={eventDraft.notes} onChange={e => setEventDraft(v => ({ ...v, notes: e.target.value }))} /></label><button disabled={submitting} onClick={() => void submitEvent()} style={{ ...actionButton, marginTop: 16, opacity: submitting ? .6 : 1 }}>{submitting ? 'Saving…' : 'Save event'}</button></> : <><h2 style={{ marginTop: 0 }}>New draft invoice</h2><p style={{ color: '#756555', fontSize: 13 }}>Create invoices from approved quote values when available. This draft records one transparent line item.</p><label>Invoice number<input autoFocus style={field} value={invoiceDraft.invoiceNumber} onChange={e => setInvoiceDraft(v => ({ ...v, invoiceNumber: e.target.value }))} /></label><label style={{ display: 'block', marginTop: 12 }}>Client name<input style={field} value={invoiceDraft.clientName} onChange={e => setInvoiceDraft(v => ({ ...v, clientName: e.target.value }))} /></label><label style={{ display: 'block', marginTop: 12 }}>Line description<input style={field} value={invoiceDraft.description} onChange={e => setInvoiceDraft(v => ({ ...v, description: e.target.value }))} /></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}><label>Quantity<input type="number" min="0.01" step="0.01" style={field} value={invoiceDraft.quantity} onChange={e => setInvoiceDraft(v => ({ ...v, quantity: e.target.value }))} /></label><label>Rate (₹)<input type="number" min="0" step="0.01" style={field} value={invoiceDraft.rate} onChange={e => setInvoiceDraft(v => ({ ...v, rate: e.target.value }))} /></label></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}><label>Tax %<input type="number" min="0" max="100" style={field} value={invoiceDraft.taxRate} onChange={e => setInvoiceDraft(v => ({ ...v, taxRate: e.target.value }))} /></label><label>Due date<input type="date" style={field} value={invoiceDraft.dueDate} onChange={e => setInvoiceDraft(v => ({ ...v, dueDate: e.target.value }))} /></label></div><button disabled={submitting} onClick={() => void submitInvoice()} style={{ ...actionButton, marginTop: 16, opacity: submitting ? .6 : 1 }}>{submitting ? 'Saving…' : 'Save draft invoice'}</button></>;

  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: 28 }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}><div><p style={{ letterSpacing: '.12em', fontSize: 11, fontWeight: 800, color: '#a0782c' }}>STUDIO OPERATIONS</p><h1 style={{ margin: '5px 0' }}>Calendar & finance</h1><p style={{ color: '#756555' }}>{status}</p></div><button onClick={() => void load()} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '9px 13px', border: '1px solid #d8cabb', borderRadius: 8, background: '#fff', fontWeight: 700 }}><RefreshCw size={15} /> Refresh</button></header><nav style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eadfd2', margin: '20px 0' }}><button onClick={() => setTab('calendar')} style={{ padding: '11px 15px', border: 0, borderBottom: tab === 'calendar' ? '2px solid #a0782c' : '2px solid transparent', background: 'transparent', fontWeight: 800 }}><CalendarDays size={15} /> Calendar</button><button onClick={() => setTab('invoices')} style={{ padding: '11px 15px', border: 0, borderBottom: tab === 'invoices' ? '2px solid #a0782c' : '2px solid transparent', background: 'transparent', fontWeight: 800 }}><FileText size={15} /> Invoices</button></nav>{tab === 'calendar' ? <section><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Upcoming studio dates</h2><button onClick={() => setDialog('event')} style={actionButton}><Plus size={15} /> Add event</button></div><div style={{ display: 'grid', gap: 10 }}>{events.length ? events.map((event) => <article key={event.id} style={{ padding: 16, border: '1px solid #eadfd2', borderRadius: 10, background: '#fff' }}><strong>{event.title}</strong><div style={{ color: '#756555', fontSize: 13, marginTop: 5 }}>{new Date(event.starts_at).toLocaleString()} · {event.event_type} · {event.status}</div></article>) : <p style={{ color: '#756555' }}>No calendar events yet. Add site visits, client reviews, milestones, and payment dates here.</p>}</div></section> : <section><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Invoices</h2><button onClick={() => setDialog('invoice')} style={actionButton}><Plus size={15} /> New invoice</button></div><div style={{ display: 'grid', gap: 10 }}>{invoices.length ? invoices.map((invoice) => <article key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, border: '1px solid #eadfd2', borderRadius: 10, background: '#fff' }}><div><strong>{invoice.invoice_number}</strong><div style={{ color: '#756555', fontSize: 13, marginTop: 5 }}>{invoice.client_name || 'No client'} · {invoice.status}</div></div><strong>₹{Number(invoice.total).toLocaleString('en-IN')}</strong></article>) : <p style={{ color: '#756555' }}>No invoices yet. Create one from an approved quote.</p>}</div></section>}{dialog && <div role="dialog" aria-modal="true" aria-label={dialog === 'event' ? 'Add studio event' : 'New draft invoice'} style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(28,20,13,.42)' }}><section style={{ width: 'min(510px, 100%)', background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.25)', position: 'relative' }}><button aria-label="Close dialog" onClick={() => setDialog(null)} style={{ position: 'absolute', right: 14, top: 14, border: 0, background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>{dialogContent}</section></div>}</main>;
}
