import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Copy, Pencil } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function OffreTemplates() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['offres', 'templates'], queryFn: () => api.get('/offres?templates=1') });
  const rows = data?.rows || [];

  const use = useMutation({
    mutationFn: (o) => api.post('/offres', {
      name: `${o.name} (copie)`, client_type: o.client_type, variant: o.variant, opportunity: o.opportunity,
      lang: o.lang, client_id: '', property_id: '', date_iso: new Date().toISOString().slice(0, 10),
      is_template: false, overrides: o.overrides, customization: o.customization,
    }),
    onSuccess: (created) => { qc.invalidateQueries({ queryKey: ['offres'] }); navigate(`/offres/edit/${created.id}`); },
  });

  const typeLabel = (o) => [o.client_type && t(`off2.ct.${o.client_type}`), o.variant && t(`off2.op.${o.variant}`)].filter(Boolean).join(' · ');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.offers')} · {t('nav.off.templates')}</h1>
          <p className="page-subtitle">{t('off2.tplEmptyHint')}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={FileText} title={t('off2.tplEmpty')} hint={t('off2.tplEmptyHint')} /></Card>
      ) : (
        <div className="tpl-grid">
          {rows.map((o) => (
            <Card key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
                <strong>{o.name}</strong>
                <Badge tone="info">{t('off2.template')}</Badge>
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>{typeLabel(o) || '—'} · {(o.lang || 'fr').toUpperCase()}</p>
              <div className="toolbar" style={{ marginBottom: 0, gap: 8 }}>
                <Button variant="primary" size="sm" icon={Copy} onClick={() => use.mutate(o)} disabled={use.isPending}>{t('off2.useTemplate')}</Button>
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => navigate(`/offres/edit/${o.id}`)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
