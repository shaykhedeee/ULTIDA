import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import './research-sourcing.css';

type Reference = { path: string; sha: string; category: string; title: string };
type Index = { revision: string; images: Reference[] };
const storageKey = 'ultida.noncommercial-research-board.v1';
const styles = ['asian', 'boho', 'coastal', 'contemporary', 'country', 'eclectic', 'farmhouse', 'industrial', 'mediterranean', 'minimalist', 'modern', 'rustic', 'scandinavian', 'shabby-chic', 'southwestern', 'traditional', 'tropical'];

export default function ResearchSourcingPanel() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [limit, setLimit] = useState(24);
  const [saved, setSaved] = useState<Record<string, string>>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([key, tag]) => key.startsWith('images/') && typeof tag === 'string')) as Record<string, string> : {};
    } catch { return {}; }
  });
  const [product, setProduct] = useState('');
  const [store, setStore] = useState('');
  const [stockMessage, setStockMessage] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/research/ikea-index.json', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('The reference index could not be loaded. Reload to retry.');
      const data = await response.json();
      if (!/^[a-f0-9]{40}$/.test(data.revision) || !Array.isArray(data.images)) throw new Error('Invalid reference index.');
      setIndex(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => (index?.images ?? []).filter(item =>
    (!category || item.category === category) && (!savedOnly || Object.hasOwn(saved, item.path))
    && `${item.category} ${item.title}`.toLowerCase().includes(query.toLowerCase())), [index, category, savedOnly, saved, query]);
  function save(next: Record<string, string>) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); setError(''); }
    catch { setError('Browser storage is unavailable. Your research board could not be saved.'); }
  }
  async function checkStock() {
    if (checking) return;
    setChecking(true); setStockMessage('Checking supplier availability…');
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session) throw new Error('Sign in to check supplier stock.');
      const response = await fetch(`${getApiBase()}/research/ikea-stock?productId=${encodeURIComponent(product)}&storeId=${encodeURIComponent(store)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Supplier availability is currently unavailable.');
      setStockMessage(data.status === 'unknown' ? 'Supplier returned no stock information. This does not mean out of stock.'
        : `${data.stock} reported at ${data.storeName}. Supplier update: ${new Date(data.reportedAt).toLocaleString()}. Checked ${new Date(data.checkedAt).toLocaleString()}. Confirm with IKEA before travelling.`);
    } catch (reason) { setStockMessage(reason instanceof Error ? reason.message : 'Stock check failed.'); }
    finally { setChecking(false); }
  }
  return <section className="research-sourcing" aria-label="Non-commercial research library">
    <h2>Research moodboard & sourcing</h2>
    <p>IKEA photography for non-commercial reference use. Saved picks stay in this browser, separate from project modules, renders and production exports. Photos do not certify dimensions or current availability.</p>
    <p><a href="https://github.com/IvonaTau/ikea" target="_blank" rel="noreferrer">Dataset source & attribution</a> · Images © IKEA · {index?.images.length ?? 'Loading'} indexed references</p>
    <details><summary>Optional classification & sourcing tools</summary>
      <p><a href="https://adrianodennanni.github.io/furniture_classifier/" target="_blank" rel="noreferrer">Open furniture classifier</a> — external browser demo; review its suggested category before applying it. <a href="https://github.com/adrianodennanni/furniture_classifier" target="_blank" rel="noreferrer">Source</a></p>
      <p><a href="https://github.com/Omar-Elhakim/Indoor-Style-Image-Classification" target="_blank" rel="noreferrer">Indoor Style Classification</a> — 17 manual style tags are available on saved references below. Automatic inference is unavailable: upstream does not include trained weights.</p>
      <p><a href="https://github.com/Ephigenia/ikea-availability-checker" target="_blank" rel="noreferrer">IKEA availability checker</a> — enter the store code and product number. Older dataset products may be discontinued; store coverage varies.</p>
      <div className="research-controls">
        <label>Product number<input value={product} onChange={e => setProduct(e.target.value)} placeholder="002.638.50" /></label>
        <label>Store code<input value={store} onChange={e => setStore(e.target.value)} placeholder="117" /></label>
        <button type="button" onClick={() => void checkStock()} disabled={checking || !product || !store}>{checking ? 'Checking…' : 'Check stock'}</button>
      </div><p role="status">{stockMessage}</p>
    </details>
    <div className="research-controls">
      <label>Search references<input value={query} onChange={e => { setQuery(e.target.value); setLimit(24); }} placeholder="Category or product number" /></label>
      <label>Category<select value={category} onChange={e => { setCategory(e.target.value); setLimit(24); }}><option value="">All categories</option>{[...new Set(index?.images.map(item => item.category))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={savedOnly} onChange={e => { setSavedOnly(e.target.checked); setLimit(24); }} /> Saved references ({Object.keys(saved).length})</label>
    </div>
    {error && <p role="alert">{error}</p>}
    {index && !filtered.length && <p>No references match these filters.</p>}
    <div className="research-grid">{filtered.slice(0, limit).map(item => <article key={item.path}>
      <img loading="lazy" src={`https://raw.githubusercontent.com/IvonaTau/ikea/${index!.revision}/${item.path.split('/').map(encodeURIComponent).join('/')}`} alt={`${item.category} reference ${item.title}`} onError={event => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('research-image-missing'); }} />
      <h3>{item.category} · {item.title}</h3><small>Visual reference · dimensions unverified</small>
      <button type="button" onClick={() => { const next = { ...saved }; if (Object.hasOwn(next, item.path)) delete next[item.path]; else next[item.path] = ''; save(next); }}>{Object.hasOwn(saved, item.path) ? 'Remove from research board' : 'Save to research board'}</button>
      {Object.hasOwn(saved, item.path) && <label>Manual style tag<select value={saved[item.path]} onChange={e => save({ ...saved, [item.path]: e.target.value })}><option value="">Unclassified</option>{styles.map(style => <option key={style}>{style}</option>)}</select></label>}
    </article>)}</div>
    {filtered.length > limit && <button type="button" onClick={() => setLimit(value => value + 24)}>Show 24 more ({filtered.length - limit} remaining)</button>}
  </section>;
}
