import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Sparkles, Download, Trash2, Building2 } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Input, Select, Modal, Grade, StatusBadge, EmptyState, FormField } from '../components/ui.jsx';
import LeadDrawer from '../components/LeadDrawer.jsx';
import { useToast } from '../components/Toast.jsx';

const PAGE = 25;

export default function Companies() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const params = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const { data, isLoading } = useQuery({ queryKey: ['companies', q, status, page], queryFn: () => api.get(`/companies?${params}`) });
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / PAGE);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); allOnPage ? rows.forEach((r) => n.delete(r.id)) : rows.forEach((r) => n.add(r.id)); return n; });
  const ids = [...selected];

  const bulkEnrich = useMutation({ mutationFn: () => api.post('/enrich', { entity_type: 'company', ids }), onSuccess: () => { toast.info(`Enriching ${ids.length} companies`); setSelected(new Set()); }, onError: (e) => toast.error(e.message) });
  const bulkDelete = useMutation({ mutationFn: async () => { for (const id of ids) await api.del(`/companies/${id}`); }, onSuccess: () => { toast.success('Deleted'); setSelected(new Set()); qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['stats'] }); }, onError: (e) => toast.error(e.message) });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Company Leads</h1><div className="page-subtitle">{total} compan{total !== 1 ? 'ies' : 'y'} in your database</div></div>
        <div className="spacer" />
        <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add company</Button>
      </div>

      <div className="toolbar">
        <div className="input-search" style={{ width: 280 }}>
          <Search size={16} />
          <Input placeholder="Search name, domain, industry…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} style={{ width: 150 }}>
          <option value="">All statuses</option><option value="new">New</option><option value="enriched">Enriched</option><option value="verified">Verified</option>
        </Select>
        <div className="spacer" />
        {ids.length > 0 && (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{ids.length} selected</span>
            <Button variant="outline" size="sm" icon={Sparkles} onClick={() => bulkEnrich.mutate()}>Enrich</Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(`Delete ${ids.length} companies?`)) bulkDelete.mutate(); }} />
          </>
        )}
        <a href={api.url(`/export?entity=companies&format=csv${q ? `&q=${encodeURIComponent(q)}` : ''}`)}>
          <Button variant="outline" size="sm" icon={Download}>Export</Button>
        </a>
      </div>

      {isLoading ? (
        <Card><div className="muted">Loading…</div></Card>
      ) : !rows.length ? (
        <Card><EmptyState icon={Building2} title="No companies" hint="Add one, import, or discover companies from a search query." action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add company</Button>} /></Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" className="checkbox" checked={allOnPage} onChange={toggleAll} /></th>
                <th>Name</th><th>Domain</th><th>Industry</th><th>Location</th><th>Status</th><th style={{ width: 50 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setOpenId(c.id)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="cell-strong">{c.name}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.domain || <span className="muted">—</span>}</td>
                  <td className="muted">{c.industry || '—'}</td>
                  <td className="muted">{c.location || [c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><Grade grade={c.grade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 18 }}>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {openId && <LeadDrawer type="company" id={openId} onClose={() => setOpenId(null)} />}
      {showAdd && <AddCompanyModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddCompanyModal({ onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({});
  const create = useMutation({
    mutationFn: () => api.post('/companies', form),
    onSuccess: () => { toast.success('Company added'); qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const f = (k, label, ph) => <FormField label={label} value={form[k]} onChange={set(k)} placeholder={ph} />;

  return (
    <Modal title="Add company" size="lg" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending || !form.name}>Add</Button></>}>
      <FormField label="Company ID" value="" disabled placeholder="Assigned automatically on save" />
      {f('name', 'Company Name', 'Northwind Marine')}
      {f('website', 'Website', 'https://northwindmarine.com')}

      <div className="section-label">Address</div>
      {f('address', 'Address')}
      <div className="field-row">{f('city', 'City')}{f('state', 'State / Province')}</div>
      <div className="field-row">{f('postal_code', 'Postal code / ZIP')}{f('country', 'Country')}</div>

      <div className="section-label">Classification</div>
      <div className="field-row">{f('industry', 'Industry')}{f('phone', 'Telephone')}</div>
      <div className="field-row">{f('sic_code', 'SIC Code')}{f('naics_code', 'NAICS Code')}</div>

      <div className="section-label">Social profiles</div>
      <div className="field-row">{f('linkedin', 'LinkedIn')}{f('facebook', 'Facebook')}</div>
      <div className="field-row">{f('instagram', 'Instagram')}{f('youtube', 'YouTube')}</div>
      {f('twitter', 'X (Twitter)')}
    </Modal>
  );
}
