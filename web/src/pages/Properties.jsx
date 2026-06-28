import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const GENRE_LABEL = {
  unifamilial: 'Unifamilial', condo: 'Condo', plex: 'Plex (2-5)', multi: 'Multi-logements (6+)',
  commercial: 'Commercial', industriel: 'Industriel', terrain: 'Terrain', rpa: 'RPA', autre: 'Autre',
};

export default function Properties() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['properties', q],
    queryFn: () => api.get(`/properties?q=${encodeURIComponent(q)}&sort=updated_at&dir=desc`),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const rows = data?.rows || [];
  const addNew = () => navigate('/properties/edit');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('prop.title')}</h1>
          <div className="page-subtitle">{t('prop.subtitle')}</div>
        </div>
        <div className="spacer" />
        <input className="input" style={{ maxWidth: 220 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="primary" icon={Plus} onClick={addNew}>{t('prop.new')}</Button>
      </div>

      <Card style={{ padding: 0 }}>
        {isLoading ? (
          <div className="muted" style={{ padding: 24 }}>…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Building2} title={t('prop.empty')} action={<Button variant="primary" icon={Plus} onClick={addNew}>{t('prop.new')}</Button>} />
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
                <tr key={p.id} onClick={() => navigate(`/properties/${p.id}`)}>
                  <td><strong>{p.name || <span className="muted">—</span>}</strong>{p.address && <div className="muted" style={{ fontSize: 12 }}>{p.address}</div>}</td>
                  <td><Badge tone="info">{GENRE_LABEL[p.genre] || p.genre}</Badge></td>
                  <td>{p.city || <span className="muted">—</span>}</td>
                  <td><Badge tone="neutral">{p.status}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove.mutate(p.id)} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
