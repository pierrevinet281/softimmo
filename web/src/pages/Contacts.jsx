import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Sparkles, ShieldCheck, Download, Trash2, Users } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Input, Select, Modal, Grade, EmailStatusBadge, StatusBadge, EmptyState, FormField } from '../components/ui.jsx';
import LeadDrawer from '../components/LeadDrawer.jsx';
import { useToast } from '../components/Toast.jsx';

const PAGE = 25;

export default function Contacts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const params = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (emailStatus) params.set('email_status', emailStatus);

  const { data, isLoading } = useQuery({ queryKey: ['contacts', q, status, emailStatus, page], queryFn: () => api.get(`/contacts?${params}`) });
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / PAGE);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); allOnPage ? rows.forEach((r) => n.delete(r.id)) : rows.forEach((r) => n.add(r.id)); return n; });
  const ids = [...selected];

  const bulkEnrich = useMutation({ mutationFn: () => api.post('/enrich', { entity_type: 'contact', ids }), onSuccess: () => { toast.info(`Enriching ${ids.length} contacts`); setSelected(new Set()); }, onError: (e) => toast.error(e.message) });
  const bulkVerify = useMutation({ mutationFn: () => api.post('/verify', { ids }), onSuccess: () => { toast.info(`Verifying ${ids.length} contacts`); setSelected(new Set()); }, onError: (e) => toast.error(e.message) });
  const bulkDelete = useMutation({ mutationFn: async () => { for (const id of ids) await api.del(`/contacts/${id}`); }, onSuccess: () => { toast.success('Deleted'); setSelected(new Set()); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['stats'] }); }, onError: (e) => toast.error(e.message) });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Contact Leads</h1><div className="page-subtitle">{total} contact{total !== 1 ? 's' : ''} in your database</div></div>
        <div className="spacer" />
        <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add contact</Button>
      </div>

      <div className="toolbar">
        <div className="input-search" style={{ width: 280 }}>
          <Search size={16} />
          <Input placeholder="Search name, email, company…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} style={{ width: 150 }}>
          <option value="">All statuses</option><option value="new">New</option><option value="enriched">Enriched</option><option value="verified">Verified</option>
        </Select>
        <Select value={emailStatus} onChange={(e) => { setEmailStatus(e.target.value); setPage(0); }} style={{ width: 150 }}>
          <option value="">Any email</option><option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option><option value="unknown">Unknown</option>
        </Select>
        <div className="spacer" />
        {ids.length > 0 && (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{ids.length} selected</span>
            <Button variant="outline" size="sm" icon={Sparkles} onClick={() => bulkEnrich.mutate()}>Enrich</Button>
            <Button variant="outline" size="sm" icon={ShieldCheck} onClick={() => bulkVerify.mutate()}>Verify</Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(`Delete ${ids.length} contacts?`)) bulkDelete.mutate(); }} />
          </>
        )}
        <a href={api.url(`/export?entity=contacts&format=csv${q ? `&q=${encodeURIComponent(q)}` : ''}`)}>
          <Button variant="outline" size="sm" icon={Download}>Export</Button>
        </a>
      </div>

      {isLoading ? (
        <Card><div className="muted">Loading…</div></Card>
      ) : !rows.length ? (
        <Card><EmptyState icon={Users} title="No contacts" hint="Add one, import a list, or generate leads." action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add contact</Button>} /></Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" className="checkbox" checked={allOnPage} onChange={toggleAll} /></th>
                <th>Name</th><th>Title</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th style={{ width: 50 }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setOpenId(c.id)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="cell-strong">{c.full_name || <span className="muted">—</span>}</td>
                  <td className="muted">{c.title || '—'}</td>
                  <td>{c.company_name || <span className="muted">—</span>}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.email || <span className="muted">—</span>}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.phone || <span className="muted">—</span>}</td>
                  <td><div className="row" style={{ gap: 6 }}><StatusBadge status={c.status} /><EmailStatusBadge status={c.email_status} /></div></td>
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

      {openId && <LeadDrawer type="contact" id={openId} onClose={() => setOpenId(null)} />}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddContactModal({ onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({});
  const create = useMutation({
    mutationFn: () => api.post('/contacts', form),
    onSuccess: () => { toast.success('Contact added'); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const f = (k, label, ph) => <FormField label={label} value={form[k]} onChange={set(k)} placeholder={ph} />;
  const valid = form.first_name || form.last_name || form.email || form.company_name;

  return (
    <Modal title="Add contact" size="lg" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending || !valid}>Add</Button></>}>
      <div className="field-row">{f('first_name', 'First Name', 'Jane')}{f('last_name', 'Last Name', 'Harbor')}</div>
      {f('title', 'Title', 'VP of Sales')}
      <div className="field-row">{f('company_name', 'Company Name', 'Northwind Marine')}{f('company_id', 'Company ID', 'auto or manual')}</div>

      <div className="section-label">Contact</div>
      <div className="field-row">{f('email', 'Email', 'jane@…')}{f('mobile', 'Mobile')}</div>
      <div className="field-row">{f('phone', 'Telephone')}{f('extension', 'Extension')}</div>

      <div className="section-label">Social & messaging</div>
      <div className="field-row">{f('linkedin', 'LinkedIn')}{f('facebook', 'Facebook')}</div>
      <div className="field-row">{f('instagram', 'Instagram')}{f('youtube', 'YouTube')}</div>
      <div className="field-row">{f('twitter', 'X (Twitter)')}{f('tiktok', 'TikTok')}</div>
      <div className="field-row">{f('whatsapp', 'WhatsApp')}{f('reddit', 'Reddit')}</div>
      <div className="field-row">{f('wechat', 'WeChat')}{f('telegram', 'Telegram')}</div>
      {f('threads', 'Threads')}
    </Modal>
  );
}
