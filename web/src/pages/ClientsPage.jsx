import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Home, Trash2, Pencil, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Select, Badge, EmptyState } from '../components/ui.jsx';
import ClientModal, { CLIENT_KINDS as KINDS, KIND_TONE } from '../components/ClientModal.jsx';
import { useI18n } from '../i18n/index.jsx';

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
