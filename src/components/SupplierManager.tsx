import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

export default function SupplierManager() {
  const empty = { name: '', email: '', phone: '', address: '', active: true };
  const [rows, setRows] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () => apiRequest<any[]>('/suppliers').then(setRows).catch(error => setError(error.message));
  useEffect(() => { void load(); }, []);
  return <div className="space-y-4">
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <form className="grid gap-3 md:grid-cols-2" onSubmit={async e => { e.preventDefault(); setSaving(true); setError(''); try { await apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(draft) }); setDraft(empty); await load(); } catch (error: any) { setError(error.message); } finally { setSaving(false); } }}>
      {['name', 'email', 'phone', 'address'].map(key => <label key={key} className="text-sm capitalize">{key}<input className="mt-1 block w-full rounded border p-2" required={key === 'name'} type={key === 'email' ? 'email' : 'text'} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      <label><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Active supplier</label>
      <button disabled={saving} className="rounded bg-blue-600 p-2 text-white">{saving ? 'Saving…' : draft.id ? 'Update supplier' : 'Add supplier'}</button>
    </form>
    {rows.map(row => <div key={row.id} className="flex justify-between rounded border p-3"><div><b>{row.name}</b><p>{row.email} · {row.phone} · {row.active ? 'Active' : 'Inactive'}</p></div><button onClick={() => setDraft(row)}>Edit</button></div>)}
    {!rows.length && <p>No suppliers have been added.</p>}
  </div>;
}
