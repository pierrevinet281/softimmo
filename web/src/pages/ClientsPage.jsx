import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Home, Trash2, Pencil, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, FormField, Select, Textarea, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const KINDS = ['seller', 'buyer', 'both'];
const KIND_TONE = { seller: 'info', buyer: 'success', both: 'accent' };

const EMPTY = { full_name: '', kind: 'seller', org_name: '', email: '', phone: '', notes: '', consent_given: 0, consent_scope: '', consent_at: null };

function ClientModal({ row, onClose, onSaved }) {
  const { t } = useI18n();
  const isEdit = !!row;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(row || {}) }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.patch(`/clients/${row.id}`, body) : api.post('/clients', body)),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const submit = () => {
    const given = form.consent_given ? 1 : 0;
    // Loi 25 : horodatage du consentement à l'octroi ; effacé si retiré.
    const consent_at = given ? (form.consent_at || new Date().toISOString()) : null;
    save.mutate({ ...form, consent_given: given, consent_at });
  };

  return (
    <Modal
      title={isEdit ? t('cli.edit') : t('cli.new')}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={save.isPending || !form.full_name} onClick={submit}>{isEdit ? t('common.save') : t('common.create')}</Button>
        </>
      )}
    >
      <div className="field-row">
        <FormField label={`${t('cli.fullName')} *`} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        <div className="field">
          <label>{t('cli.kind')}</label>
          <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`cli.kind.${k}`)}</option>)}
          </Select>
        </div>
        <FormField label={t('cli.org')} value={form.org_name} onChange={(e) => set('org_name', e.target.value)} />
        <FormField label="Courriel" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <FormField label={t('cli.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>

      <div className="section-label">{t('cli.consent')}</div>
      <div className="notice notice-muted" style={{ fontSize: 12 }}><ShieldCheck size={16} />{t('cli.consentNote')}</div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '6px 0 10px' }}>
        <input type="checkbox" className="checkbox" checked={!!Number(form.consent_given)} onChange={(e) => set('consent_given', e.target.checked ? 1 : 0)} />
        {t('cli.consentGiven')}
      </label>
      {!!Number(form.consent_given) && (
        <>
          <FormField label={t('cli.consentScope')} value={form.consent_scope} onChange={(e) => set('consent_scope', e.target.value)} placeholder={t('cli.consentScopePh')} />
          {form.consent_at && <div className="muted" style={{ fontSize: 12, marginTop: -6 }}>{t('cli.consentSince')} {new Date(form.consent_at).toLocaleString('fr-CA')}</div>}
        </>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label>{t('common.notes')}</label>
        <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}

export default function ClientsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [editing, setEditing] = useState(null); // row | 'new' | null

  const { data, isLoading } = useQuery({
    queryKey: ['clients', q, kind],
    queryFn: () => api.get(`/clients?q=${encodeURIComponent(q)}&kind=${kind}&sort=full_name&dir=asc`),
  });
  const remove = useMutation({ mutationFn: (id) => api.del(`/clients/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
  const refetch = () => qc.invalidateQueries({ queryKey: ['clients'] });
  const rows = data?.rows || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.clients')}</h1>
          <div className="page-subtitle">{t('cli.subtitle')}</div>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <Select value={kind} onChange={(e) => setKind(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">{t('cli.allKinds')}</option>
          {KINDS.map((k) => <option key={k} value={k}>{t(`cli.kind.${k}`)}</option>)}
        </Select>
        <input className="input" style={{ maxWidth: 220 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>{t('cli.new')}</Button>
      </div>

      <Card style={{ padding: 0 }}>
        {isLoading ? (
          <div className="muted" style={{ padding: 24 }}>…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Home} title={t('cli.empty')} action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>{t('cli.new')}</Button>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('cli.fullName')}</th>
                <th>{t('cli.kind')}</th>
                <th>Courriel</th>
                <th>{t('cli.phone')}</th>
                <th>{t('cli.consent')}</th>
                <th style={{ width: 76 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setEditing(c)}>
                  <td><strong>{c.full_name}</strong>{c.org_name && <div className="muted" style={{ fontSize: 12 }}>{c.org_name}</div>}</td>
                  <td><Badge tone={KIND_TONE[c.kind] || 'neutral'}>{t(`cli.kind.${c.kind}`)}</Badge></td>
                  <td>{c.email || <span className="muted">—</span>}</td>
                  <td className="mono">{c.phone || <span className="muted">—</span>}</td>
                  <td>
                    {Number(c.consent_given) === 1
                      ? <Badge tone="success"><ShieldCheck size={12} /> {t('cli.consentYes')}</Badge>
                      : <Badge tone="warning"><ShieldAlert size={12} /> {t('cli.consentNo')}</Badge>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(c)} title={t('common.edit')} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) remove.mutate(c.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && <ClientModal row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refetch} />}
    </div>
  );
}
