import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, FormField, Select, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const GENRES = ['unifamilial', 'condo', 'plex', 'multi', 'commercial', 'industriel', 'terrain', 'rpa', 'autre'];
const GENRE_LABEL = {
  unifamilial: 'Unifamilial', condo: 'Condo', plex: 'Plex (2-5)', multi: 'Multi-logements (6+)',
  commercial: 'Commercial', industriel: 'Industriel', terrain: 'Terrain', rpa: 'RPA', autre: 'Autre',
};

export default function Properties() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', genre: 'unifamilial', city: '', address: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['properties', q],
    queryFn: () => api.get(`/properties?q=${encodeURIComponent(q)}&sort=updated_at&dir=desc`),
  });

  const create = useMutation({
    mutationFn: (body) => api.post('/properties', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setOpen(false); setForm({ name: '', genre: 'unifamilial', city: '', address: '' }); },
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const rows = data?.rows || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('prop.title')}</h1>
          <div className="page-subtitle">{t('prop.subtitle')}</div>
        </div>
        <div className="spacer" />
        <input className="input" style={{ maxWidth: 220 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>{t('prop.new')}</Button>
      </div>

      <Card style={{ padding: 0 }}>
        {isLoading ? (
          <div className="muted" style={{ padding: 24 }}>…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Building2} title={t('prop.empty')} action={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>{t('prop.new')}</Button>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('prop.genre')}</th>
                <th>{t('common.city')}</th>
                <th>{t('common.status')}</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name || <span className="muted">—</span>}</strong>{p.address && <div className="muted" style={{ fontSize: 12 }}>{p.address}</div>}</td>
                  <td><Badge tone="info">{GENRE_LABEL[p.genre] || p.genre}</Badge></td>
                  <td>{p.city || <span className="muted">—</span>}</td>
                  <td><Badge tone="neutral">{p.status}</Badge></td>
                  <td>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove.mutate(p.id)} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && (
        <Modal
          title={t('prop.new')}
          onClose={() => setOpen(false)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate(form)}>{t('common.create')}</Button>
            </>
          )}
        >
          <FormField label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Plex 1234 rue Principale" />
          <div className="field">
            <label>{t('prop.genre')}</label>
            <Select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
              {GENRES.map((g) => <option key={g} value={g}>{GENRE_LABEL[g]}</option>)}
            </Select>
          </div>
          <FormField label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <FormField label={t('common.city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}
