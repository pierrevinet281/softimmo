import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListChecks, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Field, Input, Modal, EmptyState, Badge } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Lists() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState(null);

  const { data } = useQuery({ queryKey: ['lists'], queryFn: () => api.get('/lists') });
  const lists = data?.rows || [];
  const del = useMutation({ mutationFn: (id) => api.del(`/lists/${id}`), onSuccess: () => { toast.success('List deleted'); qc.invalidateQueries({ queryKey: ['lists'] }); }, onError: (e) => toast.error(e.message) });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Leads Lists</h1><div className="page-subtitle">Group leads into static lists for outreach and export.</div></div>
        <div className="spacer" />
        <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>New list</Button>
      </div>

      {!lists.length ? (
        <Card><EmptyState icon={ListChecks} title="No lists yet" hint="Create a list, then add leads to it from the Contacts or Companies tables." action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>New list</Button>} /></Card>
      ) : (
        <div className="grid grid-3">
          {lists.map((l) => (
            <Card key={l.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(l.id)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8 }}><ListChecks size={18} style={{ color: 'var(--color-accent)' }} /><strong>{l.name}</strong></div>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={(e) => { e.stopPropagation(); if (confirm('Delete list?')) del.mutate(l.id); }} />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <Badge tone="neutral">{l.entity_type}</Badge>
                <Badge tone="accent">{l.member_count} member{l.member_count !== 1 ? 's' : ''}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {openId && <ListDetail id={openId} onClose={() => setOpenId(null)} />}
      {showAdd && <AddListModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function ListDetail({ id, onClose }) {
  const { data } = useQuery({ queryKey: ['list-members', id], queryFn: () => api.get(`/lists/${id}/members`) });
  const rows = data?.rows || [];
  return (
    <Modal title="List members" onClose={onClose} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      {!rows.length ? <div className="muted">No members yet. Add leads from the Contacts or Companies tables (bulk action “Add to list”).</div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email / Domain</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td className="cell-strong">{r.full_name || r.name}</td><td className="mono" style={{ fontSize: 12 }}>{r.email || r.domain || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function AddListModal({ onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('contact');
  const create = useMutation({
    mutationFn: () => api.post('/lists', { name, entity_type: entityType }),
    onSuccess: () => { toast.success('List created'); qc.invalidateQueries({ queryKey: ['lists'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal title="New list" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name || create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 outreach" /></Field>
      <Field label="Type">
        <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="contact">Contacts</option><option value="company">Companies</option>
        </select>
      </Field>
    </Modal>
  );
}
