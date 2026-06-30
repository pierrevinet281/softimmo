import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Map as MapIcon, RefreshCw, Trash2, MapPin, Database, Clock } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Select, EmptyState, Badge } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Rendu d'un rapport d'analyse de marché (sections + indicateurs ; valeur saisie vs source à intégrer).
function MarketAnalysisReport({ report }) {
  const { t, lang } = useI18n();
  if (!report) return null;
  const lab = (o) => (lang === 'en' ? o.label_en : o.label_fr) || o.label_fr;
  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="label">{t('ma.municipality')}</div><div className="value" style={{ fontSize: 20 }}>{report.geo?.municipality || '—'}</div></div>
        <div className="kpi"><div className="label">MRC</div><div className="value" style={{ fontSize: 20 }}>{report.geo?.mrc || '—'}</div></div>
        <div className="kpi"><div className="label">{t('ma.region')}</div><div className="value" style={{ fontSize: 20 }}>{report.geo?.region || '—'}</div></div>
        <div className="kpi"><div className="label">{t('ma.coverage')}</div><div className="value">{report.summary?.data_points ?? 0}<span className="muted" style={{ fontSize: 14 }}> / {(report.summary?.data_points || 0) + (report.summary?.pending_points || 0)}</span></div><div className="sub">{t('ma.coverageSub')}</div></div>
      </div>

      <div className="notice notice-info" style={{ marginBottom: 16 }}>
        <MapIcon size={16} />{t('ma.mapNote')}
      </div>

      {(report.sections || []).map((sec) => (
        <Card key={sec.key} style={{ marginBottom: 14 }}>
          <div className="section-label" style={{ marginTop: 0 }}>{lab(sec)}</div>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <tbody>
                {sec.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ width: '38%' }}>{lab(it)}</td>
                    <td>
                      {it.status === 'data'
                        ? <span>{it.value}</span>
                        : <Badge tone="neutral">{t('ma.pending')}</Badge>}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{it.source || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Panneau réutilisable (page + onglet Market Analysis de la fiche propriété).
export function MarketAnalysisPanel({ propertyId }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selId, setSelId] = useState(null);
  const { data } = useQuery({ queryKey: ['market-analyses', propertyId], queryFn: () => api.get(`/market-analyses?property_id=${propertyId}`), enabled: !!propertyId });
  const rows = data?.rows || [];
  const current = rows.find((r) => r.id === selId) || rows[0] || null;

  const generate = useMutation({
    mutationFn: () => api.post(`/properties/${propertyId}/market-analysis`, {}),
    onSuccess: (r) => { setSelId(r?.analysis?.id || null); qc.invalidateQueries({ queryKey: ['market-analyses', propertyId] }); qc.invalidateQueries({ queryKey: ['bundle', propertyId] }); },
    onError: (e) => alert(String(e?.message || 'Erreur')),
  });
  const del = useMutation({
    mutationFn: (id) => api.del(`/market-analyses/${id}`),
    onSuccess: () => { setSelId(null); qc.invalidateQueries({ queryKey: ['market-analyses', propertyId] }); qc.invalidateQueries({ queryKey: ['bundle', propertyId] }); },
  });

  if (!propertyId) return <EmptyState icon={MapIcon} title={t('ma.pickFirst')} hint={t('ma.pickHint')} />;

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 14, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" icon={RefreshCw} onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? t('ma.generating') : t('ma.generate')}
        </Button>
        {rows.length > 0 && (
          <Select value={current?.id || ''} onChange={(e) => setSelId(e.target.value)} style={{ maxWidth: 320 }}>
            {rows.map((r) => <option key={r.id} value={r.id}>{(r.created_at || '').slice(0, 16).replace('T', ' ')} — {r.municipality || r.title}</option>)}
          </Select>
        )}
        {current && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (window.confirm(t('ma.delConfirm'))) del.mutate(current.id); }}>{t('common.delete')}</Button>}
      </div>

      {!current ? (
        <EmptyState icon={Database} title={t('ma.none')} hint={t('ma.noneHint')} />
      ) : (
        <MarketAnalysisReport report={current.report} />
      )}
    </div>
  );
}

// Page autonome : sélecteur de propriété + panneau.
export default function MarketAnalysis() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const [propertyId, setPropertyId] = useState(sp.get('property') || '');
  const { data: props } = useQuery({ queryKey: ['props'], queryFn: () => api.get('/properties') });
  const rows = props?.rows || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.marketAnalysis')}</h1>
          <div className="page-subtitle">{t('ma.subtitle')}</div>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <MapPin size={20} className="muted" />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: 480 }}>
          <label>{t('ma.selectProp')}</label>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">{t('ma.selectPropPh')}</option>
            {rows.map((p) => <option key={p.id} value={p.id}>{p.name || p.address || p.id}{p.city ? ` — ${p.city}` : ''}</option>)}
          </Select>
        </div>
      </Card>

      <MarketAnalysisPanel propertyId={propertyId} />
    </div>
  );
}
