import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Map as MapIcon, RefreshCw, Trash2, MapPin, Database, Footprints, Car, GraduationCap,
  Baby, ShoppingCart, Utensils, Dumbbell, Trees, HeartPulse, TrendingUp, Lightbulb,
} from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Select, EmptyState, Badge } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Icônes par catégorie de commodité / score.
const CAT_ICON = {
  access: Car, errands: ShoppingCart, dining: Utensils, parks: Trees, schools: GraduationCap,
  sports: Dumbbell, childcare: Baby, health: HeartPulse,
  hospitals: HeartPulse, groceries: ShoppingCart, restaurants: Utensils,
};
const POI_META = [
  ['hospitals', 'Hôpitaux / cliniques', 'Hospitals / clinics'],
  ['schools', 'Écoles & établissements', 'Schools'],
  ['childcare', 'Garderies / CPE', 'Childcare'],
  ['groceries', 'Épiceries', 'Grocery'],
  ['restaurants', 'Restaurants & cafés', 'Restaurants & cafés'],
  ['sports', 'Sports & loisirs', 'Sports & recreation'],
  ['parks', 'Parcs & espaces verts', 'Parks & green space'],
];

const gaugeColor = (s) => (s >= 70 ? 'var(--color-success)' : s >= 45 ? 'var(--color-accent)' : s >= 25 ? 'var(--color-warning)' : 'var(--color-danger)');

// Jauge circulaire SVG (score 0-100).
function ScoreGauge({ score = 0, size = 72 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp01(score) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gaugeColor(score)} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.30} fontWeight="700" fill="var(--color-text-primary)">{Math.round(score)}</text>
    </svg>
  );
}
const clamp01 = (v) => Math.max(0, Math.min(100, Number(v) || 0));

// Rendu d'un rapport d'analyse de marché — présentation professionnelle (hero + scores + synthèse
// + commodités + détails). Inspiré d'EVALO/Local Logic, données publiques gratuites (OSM, etc.).
function MarketAnalysisReport({ report }) {
  const { t, lang } = useI18n();
  if (!report) return null;
  const en = lang === 'en';
  const lab = (o) => (en ? o.label_en : o.label_fr) || o.label_fr;
  const ov = report.overview;
  const scores = report.scores || [];
  const poi = report.poi || null;

  return (
    <div className="ma-report">
      {/* HERO : localisation + indice global */}
      <Card className="ma-hero" style={{ marginBottom: 16 }}>
        <div>
          <div className="ma-hero-title">{report.geo?.municipality || '—'}</div>
          <div className="ma-chips">
            {report.geo?.mrc && <span className="ma-chip"><MapPin size={12} /> {report.geo.mrc}</span>}
            {report.geo?.region && <span className="ma-chip">{report.geo.region}</span>}
            {report.geo?.population != null && <span className="ma-chip">{report.geo.population.toLocaleString('fr-CA')} hab.</span>}
            {report.geo?.density != null && <span className="ma-chip">{report.geo.density.toLocaleString('fr-CA')} hab./km²</span>}
          </div>
          {report.geo?.display_name && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{report.geo.display_name}</div>}
        </div>
        {ov?.walkability != null && (
          <div className="ma-hero-score">
            <ScoreGauge score={ov.walkability} size={110} />
            <div>
              <div style={{ fontWeight: 700 }}>{t('ma.walkability')}</div>
              <Badge tone={ov.walkability >= 70 ? 'success' : ov.walkability >= 45 ? 'info' : 'warning'}>{en ? ov.rating_en : ov.rating_fr}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* CARTE */}
      {report.geo?.lat != null && report.geo?.lon != null && (
        <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <iframe
            title="map" loading="lazy" style={{ width: '100%', height: 340, border: 0, display: 'block' }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${report.geo.lon - 0.014}%2C${report.geo.lat - 0.009}%2C${report.geo.lon + 0.014}%2C${report.geo.lat + 0.009}&layer=mapnik&marker=${report.geo.lat}%2C${report.geo.lon}`}
          />
        </Card>
      )}

      {/* SYNTHÈSE + IMPACT VALEUR */}
      {ov && (
        <Card style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginTop: 0 }}><Lightbulb size={14} /> {t('ma.synthesis')}</div>
          <p style={{ margin: '4px 0 12px', lineHeight: 1.6 }}>{en ? ov.summary_en : ov.summary_fr}</p>
          <div className="ma-impact"><TrendingUp size={16} /><span>{en ? ov.value_impact_en : ov.value_impact_fr}</span></div>
        </Card>
      )}

      {/* SCORES DE SECTEUR */}
      {scores.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginTop: 0 }}>{t('ma.sectorScores')}</div>
          <div className="ma-scores">
            {scores.map((s) => {
              const Icon = CAT_ICON[s.key] || MapPin;
              return (
                <div className="ma-score-card" key={s.key}>
                  <ScoreGauge score={s.score} size={76} />
                  <div className="ma-score-label"><Icon size={13} /> {lab(s)}</div>
                  <div className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>{en ? s.detail_en : s.detail_fr}</div>
                </div>
              );
            })}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{t('ma.scoresNote')}</div>
        </Card>
      )}

      {/* COMMODITÉS DU SECTEUR */}
      {poi && (
        <Card style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginTop: 0 }}>{t('ma.amenities')}</div>
          <div className="ma-poi">
            {POI_META.map(([key, fr, enl]) => {
              const c = poi[key]; if (!c) return null;
              const Icon = CAT_ICON[key] || MapPin;
              return (
                <div className="ma-poi-card" key={key}>
                  <span className="ma-poi-icon"><Icon size={18} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{en ? enl : fr}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{c.count}</div>
                    {c.nearest && <div className="muted" style={{ fontSize: 11 }}>{c.nearest.name} · ~{c.nearest.dist_m} m</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* DONNÉES DÉTAILLÉES (région / MRC / municipalité / accès) */}
      <details className="card" style={{ marginBottom: 16 }} open={!ov}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('ma.detailed')}
          <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
            {report.summary?.data_points ?? 0} / {(report.summary?.data_points || 0) + (report.summary?.pending_points || 0)} {t('ma.coverageSub')}
          </span>
        </summary>
        {(report.sections || []).map((sec) => (
          <div key={sec.key} style={{ marginTop: 12 }}>
            <div className="section-label">{lab(sec)}</div>
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table className="table">
                <tbody>
                  {sec.items.map((it, i) => (
                    <tr key={i}>
                      <td style={{ width: '38%' }}>{lab(it)}</td>
                      <td>{it.status === 'data' ? <span>{it.value}</span> : <Badge tone="neutral">{t('ma.pending')}</Badge>}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{it.source || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </details>

      <div className="notice notice-info" style={{ marginBottom: 8 }}><MapIcon size={16} />{t('ma.mapNote')}</div>
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

  // Enrichissement secteur (OSM) — déclenché en arrière-plan après la création de base.
  const enrich = useMutation({
    mutationFn: (id) => api.post(`/market-analysis/${id}/enrich`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['market-analyses', propertyId] }); qc.invalidateQueries({ queryKey: ['bundle', propertyId] }); },
    onError: () => { /* silencieux : le rapport de base reste affiché */ },
  });
  const generate = useMutation({
    mutationFn: () => api.post(`/properties/${propertyId}/market-analysis`, {}),
    onSuccess: (r) => {
      const id = r?.analysis?.id || null;
      setSelId(id);
      qc.invalidateQueries({ queryKey: ['market-analyses', propertyId] });
      qc.invalidateQueries({ queryKey: ['bundle', propertyId] });
      if (id) enrich.mutate(id); // enrichissement OSM en arrière-plan (best-effort)
    },
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
        <Button variant="primary" icon={RefreshCw} onClick={() => generate.mutate()} disabled={generate.isPending || enrich.isPending}>
          {generate.isPending ? t('ma.generating') : (enrich.isPending ? t('ma.enriching') : t('ma.generate'))}
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
