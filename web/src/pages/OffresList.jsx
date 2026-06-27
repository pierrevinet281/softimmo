import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, FileText } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function OffresList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data } = useQuery({
    queryKey: ['offres', q],
    queryFn: () => api.get(`/offres?templates=0${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const rows = data?.rows || [];
  const del = useMutation({
    mutationFn: (id) => api.del(`/offres/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offres'] }),
  });

  const typeLabel = (o) => [o.client_type && t(`off2.ct.${o.client_type}`), o.variant && t(`off2.op.${o.variant}`)]
    .filter(Boolean).join(' · ');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.offers')}</h1>
          <p className="page-subtitle">{t('off.intro')}</p>
        </div>
        <span className="spacer" />
        <Button variant="primary" icon={Plus} onClick={() => navigate('/offres/edit')}>{t('off2.add')}</Button>
      </div>

      <div className="toolbar">
        <div className="input-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={16} />
          <Input placeholder={t('off2.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={FileText} title={t('off2.empty')} hint={t('off2.emptyHint')} /></Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{t('off2.col.name')}</th><th>{t('off2.col.type')}</th>
              <th>{t('off2.col.lang')}</th><th>{t('off2.col.updated')}</th><th style={{ width: 44 }} />
            </tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/offres/edit/${o.id}`)}>
                  <td className="cell-strong">{o.name}{o.is_template && <Badge tone="info" style={{ marginLeft: 8 }}>{t('off2.template')}</Badge>}</td>
                  <td>{typeLabel(o) || <span className="muted">—</span>}</td>
                  <td>{(o.lang || 'fr').toUpperCase()}</td>
                  <td className="muted">{(o.updated_at || '').slice(0, 10)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Trash2}
                      onClick={() => { if (window.confirm(t('off2.confirmDelete'))) del.mutate(o.id); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
