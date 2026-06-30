import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Map as MapIcon, RefreshCw, Trash2, MapPin, Database, Car, GraduationCap,
  Baby, ShoppingCart, Utensils, Dumbbell, Trees, HeartPulse, TrendingUp, Lightbulb,
  Users, Hash, BarChart3, Factory, Banknote, Shovel, Building2, Binoculars, Cake,
  Wallet, Ruler, Tag, Landmark, Briefcase, Wrench, LineChart, Activity, Satellite, Fuel, Pill, Languages,
} from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Select, EmptyState, Badge } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Icône par section.
const SECTION_ICON = { secteur: Trees, access: Car, municipality: Landmark, mrc: MapIcon, region: MapPin };

// Icône d'un indicateur d'après son libellé (FR+EN).
function labelIcon(it) {
  if (it.label_fr === 'Nom' || it.label_en === 'Name') return Landmark;
  const s = `${it.label_fr || ''} ${it.label_en || ''}`.toLowerCase();
  if (s.includes('nombre') || s.includes('number')) return Hash;
  if (s.includes('emplacement') || s.includes('geographic')) return MapPin;
  if (s.includes('population growth') || s.includes('croissance de pop')) return TrendingUp;
  if (s.includes('economic growth') || s.includes('croissance économ')) return Binoculars;
  if (s.includes('population')) return Users;
  if (s.includes('démographie') || s.includes('demographic')) return BarChart3;
  if (s.includes('industr')) return Factory;
  if (s.includes('economic activity') || s.includes('indice')) return Banknote;
  if (s.includes('labour') || s.includes('emploi')) return Shovel;
  if (s.includes('vacancy') || s.includes('inoccupation')) return Building2;
  if (s.includes('median age') || s.includes('âge méd')) return Cake;
  if (s.includes('income') || s.includes('revenu')) return Wallet;
  if (s.includes('land area') || s.includes('superficie')) return Ruler;
  if (s.includes('density') || s.includes('densité')) return Activity;
  if (s.includes('demonym') || s.includes('gentilé')) return Tag;
  if (s.includes('business') || s.includes('entreprise')) return Briefcase;
  if (s.includes('zoning') || s.includes('zonage')) return MapIcon;
  if (s.includes('municipal services') || s.includes('services municip')) return Wrench;
  if (s.includes('road access') || s.includes('accès rout')) return Car;
  if (s.includes('market stats') || s.includes('statistiques de marché')) return LineChart;
  if (s.includes('municipalit')) return Building2;
  return MapPin;
}

// Vue aérienne satellite VRAIMENT LIBRE : Sentinel-2 cloudless (EOX), CC-BY-4.0 — données Copernicus
// gratuites, usage commercial autorisé avec attribution. Aucune clé, aucun frais.
function aerialUrl(lat, lon, w = 600, h = 320, span = 0.02) {
  const bbox = `${lon - span},${lat - span / 1.7},${lon + span},${lat + span / 1.7}`;
  return `https://tiles.maps.eox.at/wms?service=WMS&version=1.1.1&request=GetMap&layers=s2cloudless-2021&srs=EPSG:4326&bbox=${bbox}&width=${w}&height=${h}&format=image/jpeg`;
}

// Icônes par catégorie de commodité / score.
const CAT_ICON = {
  access: Car, errands: ShoppingCart, pharmacy: Pill, gas: Fuel, dining: Utensils, parks: Trees,
  schools: GraduationCap, sports: Dumbbell, childcare: Baby, health: HeartPulse,
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

// Histogramme/courbe compact (barres verticales) — déterministe, sans dépendance.
function MiniBars({ data, color = 'var(--color-accent)' }) {
  const max = Math.max(1, ...data.map((d) => d.count || 0));
  return (
    <div className="ma-bars">
      {data.map((d, i) => (
        <div className="ma-bar" key={i} title={`${d.label} : ${(d.count || 0).toLocaleString('fr-CA')}`}>
          <div className="ma-bar-track"><div className="ma-bar-fill" style={{ height: `${Math.round((d.count || 0) / max * 100)}%`, background: color }} /></div>
          <div className="ma-bar-lbl">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Rendu d'un rapport d'analyse de marché — présentation professionnelle (hero + scores + synthèse
// + commodités + détails). Inspiré d'EVALO/Local Logic, données publiques gratuites (OSM, etc.).
function MarketAnalysisReport({ report }) {
  const { t, lang } = useI18n();
  if (!report) return null;
  const en = lang === 'en';
  const lab = (o) => (en ? o.label_en : o.label_fr) || o.label_fr;
  const ov = report.overview;
  const scores = report.scores || [];
  const scoreByKey = Object.fromEntries(scores.map((s) => [s.key, s]));
  // Tuiles du voisinage (score + commodité combinés) — ordre voulu : garderies avant sports.
  const POI_ORDER = ['errands', 'pharmacy', 'gas', 'dining', 'schools', 'childcare', 'health', 'parks', 'sports'];
  const poiGauges = POI_ORDER.map((k) => scoreByKey[k]).filter(Boolean);
  const accessScore = scoreByKey.access || null;
  // Ordre des blocs : secteur → accès → municipalité → MRC → région (s'applique aussi aux anciens rapports).
  const SECTION_ORDER = ['secteur', 'access', 'municipality', 'mrc', 'region'];
  const orderedSections = [...(report.sections || [])].sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a.key); const ib = SECTION_ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const Gauge = (s, Icon) => (
    <div className="ma-score-card" key={s.key}>
      <ScoreGauge score={s.score} size={76} />
      <div className="ma-score-label">{Icon ? <Icon size={13} /> : null} {lab(s)}</div>
      <div className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>{en ? s.detail_en : s.detail_fr}</div>
    </div>
  );
  // Lien Google Maps précis : coordonnées exactes du point d'intérêt (une seule destination, pas une
  // recherche par mot-clé). Repli sur nom + municipalité si les coordonnées manquent.
  const gmaps = (p) => (p.lat != null && p.lon != null)
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat}%2C${p.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, report.geo?.municipality].filter(Boolean).join(', '))}`;
  // Tuile de voisinage : jauge + nb + top 5 (noms cliquables + distance km).
  const nbTile = (s) => {
    const Icon = CAT_ICON[s.key] || MapPin;
    return (
      <div className="ma-score-card ma-nbtile" key={s.key}>
        <div className="ma-nbtile-head">
          <ScoreGauge score={s.score} size={54} />
          <div>
            <div className="ma-score-label"><Icon size={13} /> {lab(s)}</div>
            <div className="muted" style={{ fontSize: 11 }}>{s.count} {t('ma.nearby')}</div>
          </div>
        </div>
        {s.top?.length > 0 && (
          <ul className="ma-toplist">
            {s.top.map((p, i) => (
              <li key={i}><a href={gmaps(p)} target="_blank" rel="noreferrer">{p.name}</a> <span className="muted">({(p.dist_m / 1000).toFixed(1)} km)</span></li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  const renderTable = (sec) => (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table"><tbody>
        {sec.items.map((it, i) => {
          const Ic = labelIcon(it);
          return (
            <tr key={i}>
              <td style={{ width: '40%' }}><span className="ma-cell"><Ic size={14} className="ma-cell-ic" /> {lab(it)}</span></td>
              <td>{it.status === 'data' ? <span>{it.value}</span> : <Badge tone="neutral">{t('ma.pending')}</Badge>}</td>
              <td className="muted" style={{ fontSize: 12 }}>{it.source || ''}</td>
            </tr>
          );
        })}
      </tbody></table>
    </div>
  );
  // Image en tête de bloc : photo Wikipédia (libre) si disponible, sinon vue aérienne Sentinel-2
  // au bon niveau de zoom (secteur rapproché → région large). « aérienne » accepté comme « photo ».
  const AERIAL_SPAN = { secteur: 0.022, municipality: 0.08, mrc: 0.4, region: 1.5 };
  const IMG_KEYS = ['secteur', 'municipality', 'mrc', 'region'];
  const blockImage = (key) => {
    if (!IMG_KEYS.includes(key)) return null;
    const ph = report.images?.[key];
    if (ph) return { url: ph.url, caption: [ph.credit, ph.license].filter(Boolean).join(' · ') };
    if (report.geo?.lat != null && report.geo?.lon != null) {
      return { url: aerialUrl(report.geo.lat, report.geo.lon, 600, 380, AERIAL_SPAN[key] || 0.05), caption: 'Sentinel-2 cloudless — EOX (Copernicus), CC BY 4.0', aerial: true };
    }
    return null;
  };
  const ch = report.charts || {};
  const chartsBlock = (ch.age || ch.income || ch.lang) ? (
    <div className="ma-charts">
      {ch.age && <div className="ma-chart"><div className="ma-chart-title"><Cake size={13} /> {t('ma.ageChart')}</div><MiniBars data={ch.age} /></div>}
      {ch.income && <div className="ma-chart"><div className="ma-chart-title"><Wallet size={13} /> {t('ma.incomeChart')}</div><MiniBars data={ch.income} color="var(--color-success)" /></div>}
      {ch.lang && <div className="ma-chart"><div className="ma-chart-title"><Languages size={13} /> {t('ma.langChart')}</div><MiniBars data={ch.lang} color="var(--color-info)" /></div>}
    </div>
  ) : null;

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
            {report.geo?.median_age != null && <span className="ma-chip">{t('ma.medAge')} {report.geo.median_age}</span>}
            {report.geo?.median_hh_income != null && <span className="ma-chip">{t('ma.medInc')} {report.geo.median_hh_income.toLocaleString('fr-CA')} $</span>}
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

      {/* SYNTHÈSE + IMPACT VALEUR */}
      {ov && (
        <Card style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginTop: 0 }}><Lightbulb size={14} /> {t('ma.synthesis')}</div>
          <p style={{ margin: '4px 0 12px', lineHeight: 1.6 }}>{en ? ov.summary_en : ov.summary_fr}</p>
          <div className="ma-impact"><TrendingUp size={16} /><span>{en ? ov.value_impact_en : ov.value_impact_fr}</span></div>
        </Card>
      )}

      {/* BLOCS — ordre : secteur → accès → municipalité → MRC → région.
          Le bloc « Neighbourhood (proximity) » intègre les scores+commodités (combinés par tuile :
          jauge + nombre à proximité + plus proche). La connectivité routière va au bloc « Road access ». */}
      {orderedSections.map((sec) => {
        const SIc = SECTION_ICON[sec.key] || MapPin;
        const img = blockImage(sec.key);
        const rev = IMG_KEYS.indexOf(sec.key) % 2 === 1; // alternance gauche/droite
        const content = (
          sec.key === 'secteur' && poiGauges.length > 0 ? (
            <>
              <div className="ma-scores ma-scores-nb">{poiGauges.map((s) => nbTile(s))}</div>
              <div className="muted" style={{ fontSize: 11, margin: '10px 0 0' }}>{t('ma.scoresNote')}</div>
            </>
          ) : sec.key === 'access' ? (
            <>
              <div className="ma-access-row">
                {accessScore && <div className="ma-access-gauge">{Gauge(accessScore, Car)}</div>}
                {report.roads?.some((r) => r.sign) && (
                  <div className="ma-signs">
                    {report.roads.filter((r) => r.sign).map((r) => (
                      <span className="ma-sign" key={r.name}><img src={r.sign} alt={r.name} /> <span className="muted">~{(r.dist_m / 1000).toFixed(1)} km</span></span>
                    ))}
                  </div>
                )}
              </div>
              {renderTable(sec)}
            </>
          ) : sec.key === 'municipality' ? (
            <>{chartsBlock}{renderTable(sec)}</>
          ) : renderTable(sec)
        );
        return (
          <Card key={sec.key} style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}><SIc size={14} /> {lab(sec)}</div>
            {img ? (
              <div className={`ma-split${rev ? ' rev' : ''}`}>
                <figure className="ma-photo">
                  <img src={img.url} alt={lab(sec)} loading="lazy" />
                  {img.caption && <figcaption className="muted">{img.caption}</figcaption>}
                </figure>
                <div className="ma-split-main">{content}</div>
              </div>
            ) : content}
          </Card>
        );
      })}

      <div className="muted" style={{ fontSize: 11, margin: '0 0 8px' }}>
        {report.summary?.data_points ?? 0} / {(report.summary?.data_points || 0) + (report.summary?.pending_points || 0)} {t('ma.coverageSub')}
      </div>
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
