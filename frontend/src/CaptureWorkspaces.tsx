import { useState, type FormEvent } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const TOKEN = 'expense_tracker_token';
const mapping = { date: 'date', description: 'description', amount: 'amount', category: 'category', paymentMethod: 'paymentMethod', merchant: 'merchant' };

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN) ?? ''}`, ...options.headers } });
  const data = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(data.message ?? 'Request failed.');
  return data;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`field ${props.className ?? ''}`} />; }
function Workspace({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">{eyebrow}</p><h1 className="mt-3 font-display text-5xl">{title}<span className="text-coral">.</span></h1>{children}</div>; }

export function AssistantWorkspace() {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; recommendations: string[]; categoryFocus: string } | null>(null);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); try { setError(''); setAnswer(await requestJson('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Assistant unavailable.'); } }
  return <Workspace eyebrow="Workspace / Assistant" title="Ask about your money"><form onSubmit={submit} className="mt-8 flex gap-3"><Input required aria-label="Financial question" placeholder="Why did I spend more this month?" value={message} onChange={(event) => setMessage(event.target.value)} /><button className="rounded-lg bg-mint px-5 py-3 font-bold text-ink">Ask</button></form>{error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}{answer && <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6"><p className="text-lg leading-8">{answer.answer}</p><p className="mt-4 text-sm text-muted">Focus: {answer.categoryFocus}</p><ul className="mt-5 space-y-2 text-sm text-muted">{answer.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></section>}</Workspace>;
}

type ImportResult = { rows: Array<{ valid: boolean; reason?: string; description: string; amount: number; category: string }>; summary: { imported: number; duplicates: number; invalid: number; skipped: number } };
export function ImportWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(path: string) { if (!file) throw new Error('Choose a CSV file first.'); const form = new FormData(); form.append('file', file); form.append('mapping', JSON.stringify(mapping)); return requestJson<ImportResult>(path, { method: 'POST', body: form }); }
  async function previewFile() { try { setBusy(true); setMessage(''); setPreview(await send('/api/imports/preview')); } catch (previewError) { setMessage(previewError instanceof Error ? previewError.message : 'Preview unavailable.'); } finally { setBusy(false); } }
  async function importFile() { try { setBusy(true); setMessage(''); const result = await send('/api/imports/import'); setPreview(result); setMessage(`Imported ${result.summary.imported} transactions.`); } catch (importError) { setMessage(importError instanceof Error ? importError.message : 'Import unavailable.'); } finally { setBusy(false); } }
  return <Workspace eyebrow="Workspace / Import" title="Bring in a transaction history"><div className="mt-8 rounded-xl border border-white/10 bg-panel p-6"><Input aria-label="CSV file" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setMessage(''); }} /><div className="mt-5 flex flex-wrap gap-3"><button disabled={!file || busy} onClick={() => void previewFile()} className="rounded-lg bg-mint px-4 py-3 font-bold text-ink">Preview CSV</button><button disabled={!preview || busy || preview.summary.invalid > 0} onClick={() => void importFile()} className="rounded-lg border border-mint px-4 py-3 text-mint">Confirm import</button></div>{message && <p role="status" className="mt-4 text-sm text-muted">{message}</p>}</div>{preview && <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6"><div className="grid gap-4 sm:grid-cols-4">{Object.entries(preview.summary).map(([name, count]) => <div key={name}><p className="text-sm text-muted">{name}</p><p className="mt-1 font-display text-2xl">{count}</p></div>)}</div><div className="mt-6 max-h-80 overflow-auto text-sm">{preview.rows.map((row, index) => <div key={`${row.description}-${index}`} className="flex justify-between gap-4 border-t border-white/5 py-3"><span>{row.description} / {row.category}</span><span className={row.valid ? 'text-mint' : 'text-coral'}>{row.valid ? `$${row.amount}` : row.reason ?? 'Invalid'}</span></div>)}</div></section>}</Workspace>;
}

export function ReceiptWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<{ merchant: string; amount: number; date: string; category: string; subcategory: string; confidence: number; source: string } | null>(null);
  const [message, setMessage] = useState('');
  async function analyze() { if (!file) return; try { setMessage(''); const form = new FormData(); form.append('file', file); const result = await requestJson<{ extracted: typeof extracted }>('/api/receipts/analyze', { method: 'POST', body: form }); setExtracted(result.extracted); } catch (analyzeError) { setMessage(analyzeError instanceof Error ? analyzeError.message : 'Receipt analysis unavailable.'); } }
  async function confirm() { if (!extracted) return; try { const result = await requestJson<{ confirmation: { id: string } }>('/api/receipts/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extracted) }); setMessage(`Receipt confirmed: ${result.confirmation.id}`); } catch (confirmError) { setMessage(confirmError instanceof Error ? confirmError.message : 'Receipt confirmation failed.'); } }
  return <Workspace eyebrow="Workspace / Receipts" title="Turn receipts into records"><div className="mt-8 rounded-xl border border-white/10 bg-panel p-6"><Input aria-label="Receipt image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setExtracted(null); setMessage(''); }} /><button disabled={!file} onClick={() => void analyze()} className="mt-5 rounded-lg bg-mint px-4 py-3 font-bold text-ink">Analyze receipt</button>{message && <p role="status" className="mt-4 text-sm text-muted">{message}</p>}</div>{extracted && <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6"><p className="text-sm text-muted">Review before confirming / {Math.round(extracted.confidence * 100)}% confidence</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Input aria-label="Extracted merchant" value={extracted.merchant} onChange={(event) => setExtracted({ ...extracted, merchant: event.target.value })} /><Input aria-label="Extracted amount" type="number" value={extracted.amount} onChange={(event) => setExtracted({ ...extracted, amount: Number(event.target.value) })} /><Input aria-label="Extracted date" type="date" value={extracted.date} onChange={(event) => setExtracted({ ...extracted, date: event.target.value })} /><Input aria-label="Extracted category" value={extracted.category} onChange={(event) => setExtracted({ ...extracted, category: event.target.value })} /></div><button onClick={() => void confirm()} className="mt-5 rounded-lg border border-mint px-4 py-3 text-mint">Confirm receipt</button></section>}</Workspace>;
}
