import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileBarChart, Scale, Calculator, AlertTriangle, Info, ShieldAlert, Save, Upload, Plus, Trash2, Ruler,
} from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Select, Modal, EmptyState, Badge } from '../components/ui.jsx';
import { EntityTable, InclusionsField } from '../components/EntityTable.jsx';
import { useI18n } from '../i18n/index.jsx';
import { money, num } from '../lib/format.js';

// Avertissement légal obligatoire (docs/06 §1) — opinion de valeur ≠ évaluation.
const DISCLAIMER_FR = "Le présent document constitue une opinion de la valeur marchande établie par un courtier immobilier à des fins de mise en marché. Il ne constitue pas une évaluation au sens de la Loi sur les évaluateurs agréés et ne remplace pas le rapport d'un évaluateur agréé reconnu par les institutions financières, les tribunaux ou les autorités fiscales.";

const KIND_TONE = { sold: 'success', active: 'info', expired: 'warning' };

// Champs des caractéristiques catégorielles (selects) + âges (nombres), dérivés des paramètres.
function buildFeatureFields(params) {
  const fields = [];
  for (const [key, cfg] of Object.entries(params?.features || {})) {
    fields.push({
      key, label: cfg.label || prettyIncl(key), type: 'select', half: true,
      options: [{ value: '', label: '—' }, ...Object.keys(cfg.options || {}).map((o) => ({ value: o, label: prettyIncl(o) }))],
    });
  }
  for (const [key, cfg] of Object.entries(params?.age_features || {})) {
    fields.push({ key, label: cfg.label || prettyIncl(key), type: 'number', half: true });
  }
  return fields;
}

function comparablesConfig(t, inclOptions, featureFields = []) {
  const kindOpts = [
    { value: 'sold', label: t('ev.kind.sold') },
    { value: 'active', label: t('ev.kind.active') },
    { value: 'expired', label: t('ev.kind.expired') },
  ];
  const ratingOpts = [
    { value: '', label: '—' },
    { value: 'worse', label: t('ev.rating.worse') },
    { value: 'equal', label: t('ev.rating.equal') },
    { value: 'better', label: t('ev.rating.better') },
  ];
  return {
    path: 'comparables', icon: Scale, addLabel: t('ev.addComp'),
    defaults: { kind: 'sold', weight: 1, seller_redacted: 1 },
    columns: [
      { key: 'kind', label: t('common.type'), render: (r) => <Badge tone={KIND_TONE[r.kind] || 'neutral'}>{t(`ev.kind.${r.kind}`) || r.kind}</Badge> },
      { key: 'address', label: 'Adresse', render: (r) => r.address || <span className="muted">—</span> },
      { key: 'sold_price', label: t('ev.soldPrice'), align: 'num', render: (r) => money(r.sold_price ?? r.price) },
      { key: 'list_price', label: t('ev.listPrice'), align: 'num', render: (r) => money(r.list_price) },
      { key: 'livable_area', label: t('ev.livable'), align: 'num', render: (r) => num(r.livable_area ?? r.area) },
      { key: 'sale_date', label: t('ev.saleDate') },
      { key: 'weight', label: t('ev.weight'), align: 'num', render: (r) => num(r.weight) },
    ],
    fields: [
      { key: 'kind', label: t('common.type'), type: 'select', options: kindOpts, half: true },
      { key: 'address', label: 'Adresse', half: true },
      { key: 'centris_no', label: 'No Centris', half: true },
      { key: 'sale_date', label: t('ev.saleDate'), placeholder: 'AAAA-MM-JJ', half: true },
      { key: 'list_price', label: t('ev.listPrice'), type: 'number', half: true },
      { key: 'sold_price', label: t('ev.soldPrice'), type: 'number', half: true },
      { key: 'livable_area', label: t('ev.livable'), type: 'number', half: true },
      { key: 'year_built', label: t('d.bld.year'), type: 'number', half: true },
      { key: 'municipal_assessment', label: t('ev.assessment'), type: 'number', half: true },
      { key: 'days_on_market', label: 'JSM', type: 'number', half: true },
      ...featureFields,
      { key: 'weight', label: t('ev.weight'), type: 'number', half: true },
      { key: 'rating', label: t('ev.rating'), type: 'select', options: ratingOpts, half: true },
      { key: 'inclusions', label: t('ev.inclusions'), type: 'inclusions', options: inclOptions },
      { key: 'notes', label: t('common.notes'), type: 'textarea' },
    ],
  };
}

// ─────────────────────────── Paramètres d'ajustement (éditables) ───────────────────────────
const SCALAR_PARAMS = [
  { key: 'construction_cost_per_sqft', labelKey: 'ev.p.cost' },
  { key: 'age_adjustment_pct_per_year', labelKey: 'ev.p.age', step: 0.001 },
  { key: 'monthly_appreciation_pct', labelKey: 'ev.p.apprec', step: 0.001 },
  { key: 'sale_to_list_ratio', labelKey: 'ev.p.saleList', step: 0.001 },
  { key: 'sale_to_assessment_ratio', labelKey: 'ev.p.saleAssess', step: 0.001 },
];

// Statistiques APCIQ : fichier réutilisable (en mémoire), téléversement, extraction des ratios.
function StatsRatios({ city, genre, onRatios }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const { data: fileInfo } = useQuery({ queryKey: ['acmStatsFile'], queryFn: () => api.get('/acm/stats/file') });
  const upload = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return api.upload('/acm/stats/upload', fd); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acmStatsFile'] }),
    onError: (e) => alert(String(e?.message || 'Erreur')),
  });
  const lookup = useMutation({
    mutationFn: () => api.post('/acm/stats/lookup', { municipality: city, genre }),
    onSuccess: (r) => {
      if (r?.not_found) { alert(r.reason || t('ev.stats.notFound')); return; }
      onRatios(r);
      alert(t('ev.stats.applied').replace('{m}', r.matched_municipality).replace('{g}', r.genre_label).replace('{p}', r.period || ''));
    },
    onError: (e) => alert(String(e?.message || 'Erreur')),
  });
  return (
    <div className="notice notice-muted" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ fontSize: 13 }}>
        <strong>{t('ev.stats.title')}</strong> — {fileInfo
          ? `${fileInfo.filename} (${(fileInfo.uploaded_at || '').slice(0, 10)})`
          : t('ev.stats.none')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="file" accept="application/pdf" ref={fileRef} style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
        <Button variant="outline" size="sm" icon={Upload} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {upload.isPending ? t('ev.importing') : (fileInfo ? t('ev.stats.replace') : t('ev.stats.upload'))}
        </Button>
        <Button variant="outline" size="sm" icon={FileBarChart} disabled={!fileInfo || !city || lookup.isPending}
          onClick={() => lookup.mutate()}>
          {lookup.isPending ? '…' : t('ev.stats.extract').replace('{c}', city || '?')}
        </Button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{t('ev.stats.hint')}</div>
    </div>
  );
}

function ParamsPanel({ params, onChange, onSave, saving, city, genre }) {
  const { t } = useI18n();
  const setScalar = (k, v) => onChange({ ...params, [k]: v === '' ? null : Number(v) });
  const setIncl = (k, v) => onChange({ ...params, inclusions: { ...params.inclusions, [k]: v === '' ? 0 : Number(v) } });
  const setFeatPct = (feat, opt, v) => onChange({ ...params, features: { ...params.features, [feat]: { ...params.features[feat], options: { ...params.features[feat].options, [opt]: v === '' ? 0 : Number(v) / 100 } } } });
  const setAgePct = (key, v) => onChange({ ...params, age_features: { ...params.age_features, [key]: { ...params.age_features[key], pct_per_year: v === '' ? 0 : Number(v) / 100 } } });
  const applyRatios = (r) => onChange({ ...params, sale_to_list_ratio: r.sale_to_list_ratio ?? params.sale_to_list_ratio, sale_to_assessment_ratio: r.sale_to_assessment_ratio ?? params.sale_to_assessment_ratio });
  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('ev.params')}</summary>
      <div className="muted" style={{ fontSize: 12, margin: '8px 0 14px' }}>{t('ev.paramsNote')}</div>
      <StatsRatios city={city} genre={genre} onRatios={applyRatios} />
      <div className="field-row">
        {SCALAR_PARAMS.map((p) => (
          <div className="field" key={p.key}>
            <label>{t(p.labelKey)}</label>
            <input className="input" type="number" step={p.step || 1} value={params[p.key] ?? ''} onChange={(e) => setScalar(p.key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="section-label">{t('ev.inclPrices')}</div>
      <div className="field-row">
        {Object.entries(params.inclusions || {}).map(([k, v]) => (
          <div className="field" key={k}>
            <label>{prettyIncl(k)}</label>
            <input className="input" type="number" value={v ?? ''} onChange={(e) => setIncl(k, e.target.value)} />
          </div>
        ))}
      </div>

      {/* Caractéristiques catégorielles : valeur marché en % par option (éditable). */}
      <div className="section-label">{t('ev.featPct')}</div>
      {Object.entries(params.features || {}).map(([feat, cfg]) => (
        <div key={feat} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{cfg.label || prettyIncl(feat)}</div>
          <div className="field-row">
            {Object.entries(cfg.options || {}).map(([opt, pct]) => (
              <div className="field" key={opt} style={{ marginBottom: 8 }}>
                <label>{prettyIncl(opt)} (%)</label>
                <input className="input" type="number" step={0.1} value={pct == null ? '' : +(pct * 100).toFixed(2)} onChange={(e) => setFeatPct(feat, opt, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Âges (fenêtres, toiture) : % du prix par an d'écart. */}
      <div className="section-label">{t('ev.agePct')}</div>
      <div className="field-row">
        {Object.entries(params.age_features || {}).map(([key, cfg]) => (
          <div className="field" key={key}>
            <label>{cfg.label || prettyIncl(key)} (%/an)</label>
            <input className="input" type="number" step={0.1} value={cfg.pct_per_year == null ? '' : +(cfg.pct_per_year * 100).toFixed(2)} onChange={(e) => setAgePct(key, e.target.value)} />
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" icon={Save} onClick={onSave} disabled={saving}>{t('ev.saveParams')}</Button>
    </details>
  );
}

function prettyIncl(key) {
  const s = String(key).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Lien vers Google Maps pour une adresse de comparable (ouverture dans un nouvel onglet).
function mapsUrl(s) {
  const q = [s.address, s.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
function AddressLink({ s, className }) {
  const label = s.address || s.id;
  if (!s.address) return <span className={className}>{label}</span>;
  return <a className={className} href={mapsUrl(s)} target="_blank" rel="noreferrer" title="Voir sur Google Maps">{label}</a>;
}

// ─────────────────────────── Grille d'ajustements ventilée (comps en colonnes) ───────────────────────────
function AdjustmentGrid({ sold, clientView }) {
  const { t } = useI18n();
  const comps = clientView ? sold.filter((s) => !s.excluded) : sold;
  const { keys, labels } = useMemo(() => {
    const ks = []; const lbl = {};
    for (const s of comps) for (const l of s.adjustments) if (!(l.key in lbl)) { lbl[l.key] = l.label; ks.push(l.key); }
    return { keys: ks, labels: lbl };
  }, [comps]);
  if (!comps.length) return <div className="muted">{t('ev.noGrid')}</div>;

  const r = clientView ? 1000 : 1;
  const amt = (v) => (v == null ? '—' : money(Math.round(v / r) * r));
  const cell = (s, k) => { const l = s.adjustments.find((x) => x.key === k); return l ? amt(l.amount) : '—'; };

  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>{t('ev.characteristic')}</th>
            {comps.map((s) => (
              <th key={s.id} className="num" style={s.excluded ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                <AddressLink s={s} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr><td>{t('ev.soldPrice')}</td>{comps.map((s) => <td key={s.id} className="num">{amt(s.soldPrice)}</td>)}</tr>
          {keys.map((k) => (
            <tr key={k}><td>{labels[k]}</td>{comps.map((s) => <td key={s.id} className="num">{cell(s, k)}</td>)}</tr>
          ))}
          {!clientView && (
            <tr><td className="muted">{t('ev.adjTotal')}</td>{comps.map((s) => <td key={s.id} className="num">{amt(s.adjustmentsTotal)}</td>)}</tr>
          )}
          <tr style={{ fontWeight: 700 }}><td>{t('ev.adjustedPrice')}</td>{comps.map((s) => <td key={s.id} className="num">{s.excluded ? '—' : amt(s.adjustedPrice)}</td>)}</tr>
          {!clientView && (
            <tr><td className="muted">{t('ev.weight')}</td>{comps.map((s) => <td key={s.id} className="num">{s.excluded ? '—' : num(s.weight)}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Ventilation expliquée, comparable par comparable (texte clair).
function ExplainedBreakdown({ sold, clientView }) {
  const { t } = useI18n();
  const comps = sold.filter((s) => !s.excluded && s.adjustments.length);
  if (!comps.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {comps.map((s) => (
        <details key={s.id} className="card" style={{ padding: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            <AddressLink s={s} />
            {s.centris_no && <span className="muted mono" style={{ fontWeight: 400, marginLeft: 8 }}>No Centris {s.centris_no}</span>}
            {' '}— {money(s.soldPrice)} → <strong>{money(Math.round(s.adjustedPrice / (clientView ? 1000 : 1)) * (clientView ? 1000 : 1))}</strong>
          </summary>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {s.adjustments.map((l, i) => <li key={i}>{l.explanation}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );
}

// ─────────────────────────── Résultats ACM ───────────────────────────
function AcmResults({ result, clientView, setClientView }) {
  const { t } = useI18n();
  const { expected, listingPrice, corroboration: cor, warnings } = result;
  return (
    <div>
      {warnings.map((w, i) => (
        <div key={i} className={`notice notice-${w.level === 'warn' ? 'warn' : 'info'}`}>
          {w.level === 'warn' ? <AlertTriangle size={16} /> : <Info size={16} />}{w.message}
        </div>
      ))}

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="label">{t('ev.expected')}</div><div className="value">{money(expected.point)}</div>{expected.low != null && <div className="sub">{money(expected.low)} – {money(expected.high)}</div>}</div>
        <div className="kpi"><div className="label">{t('ev.listing')}</div><div className="value">{money(listingPrice)}</div><div className="sub">{t('ev.listingSub')}</div></div>
        {cor.expiredCap && <div className="kpi"><div className="label">{t('ev.cap')}</div><div className="value">{money(cor.expiredCap.avg)}</div><div className="sub">{t('ev.capSub')} ({cor.expiredCap.n})</div></div>}
        {cor.activeCompetition && <div className="kpi"><div className="label">{t('ev.competition')}</div><div className="value">{money(cor.activeCompetition.avg)}</div><div className="sub">{t('ev.competitionSub')} ({cor.activeCompetition.n})</div></div>}
      </div>

      {cor.municipal && (
        <div className={`notice ${cor.municipal.flag ? 'notice-warn' : 'notice-muted'}`}>
          {cor.municipal.flag ? <ShieldAlert size={16} /> : <Info size={16} />}
          {t('ev.assessCorrob')} : {money(cor.municipal.estimated)} ({money(cor.municipal.assessment)} × {(cor.municipal.ratio * 100).toFixed(1)} %) — {t('ev.gap')} {(cor.municipal.gap * 100).toFixed(0)} %.
          {cor.municipal.flag ? ` ${t('ev.gapFlag')}` : ''}
        </div>
      )}

      <div className="tab-row" style={{ marginTop: 16, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{t('ev.grid')}</h3>
        <div className="spacer" style={{ flex: 1 }} />
        <div className="tabs">
          <button className={`tab ${!clientView ? 'active' : ''}`} onClick={() => setClientView(false)}>{t('ev.broker')}</button>
          <button className={`tab ${clientView ? 'active' : ''}`} onClick={() => setClientView(true)}>{t('ev.client')}</button>
        </div>
      </div>
      <AdjustmentGrid sold={result.sold} clientView={clientView} />

      <div className="section-label" style={{ marginTop: 20 }}>{t('ev.breakdown')}</div>
      <ExplainedBreakdown sold={result.sold} clientView={clientView} />

      <div className="notice notice-muted" style={{ marginTop: 20, fontSize: 12 }}>
        <ShieldAlert size={16} />{DISCLAIMER_FR}
      </div>
    </div>
  );
}

// ─────────────────────────── Calculatrice de superficie ───────────────────────────
// Additionne des pièces/sections (longueur × largeur) pour obtenir une superficie totale,
// quand le courtier ne connaît pas la superficie par cœur. Déterministe.
function SurfaceCalculator({ onApply, onClose }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([{ label: '', l: '', w: '' }]);
  const areaOf = (r) => (Number(r.l) || 0) * (Number(r.w) || 0);
  const total = Math.round(rows.reduce((s, r) => s + areaOf(r), 0));
  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => setRows([...rows, { label: '', l: '', w: '' }]);
  const del = (i) => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : rows);
  return (
    <Modal
      title={t('ev.calc.title')}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!total} onClick={() => onApply(total)}>{t('ev.calc.apply')} ({num(total)} pi²)</Button>
        </>
      )}
    >
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('ev.calc.hint')}</div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('ev.calc.room')}</th><th className="num">{t('ev.calc.length')}</th><th className="num">{t('ev.calc.width')}</th><th className="num">{t('ev.calc.area')}</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="cell"><input className="cell-input" value={r.label} placeholder={`${t('ev.calc.room')} ${i + 1}`} onChange={(e) => setRow(i, 'label', e.target.value)} /></td>
                <td className="cell"><input className="cell-input num" type="number" value={r.l} onChange={(e) => setRow(i, 'l', e.target.value)} /></td>
                <td className="cell"><input className="cell-input num" type="number" value={r.w} onChange={(e) => setRow(i, 'w', e.target.value)} /></td>
                <td className="num">{num(Math.round(areaOf(r)))}</td>
                <td><Button variant="ghost" size="sm" icon={Trash2} onClick={() => del(i)} /></td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={3}>{t('ev.calc.total')}</td><td className="num">{num(total)} pi²</td><td /></tr>
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" icon={Plus} onClick={add} style={{ marginTop: 12 }}>{t('ev.calc.addRoom')}</Button>
    </Modal>
  );
}

// ─────────────────────────── Import PDF Matrix ───────────────────────────
function MatrixImport({ propertyId, onDone }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const up = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return api.upload(`/properties/${propertyId}/comparables/import-matrix`, fd); },
    onSuccess: (r) => { onDone(r); if (r?.count != null) alert(t('ev.importDone').replace('{n}', r.count)); },
    onError: (e) => alert(String(e?.message || 'Erreur')),
  });
  return (
    <>
      <input type="file" accept="application/pdf" ref={ref} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ''; }} />
      <Button variant="outline" size="sm" icon={Upload} disabled={up.isPending} onClick={() => ref.current?.click()}>
        {up.isPending ? t('ev.importing') : t('ev.importMatrix')}
      </Button>
    </>
  );
}

// Éditeur de comparables réutilisable (onglet Comparables de la fiche propriété) : import PDF
// (matrice) + ajout/édition manuels (mêmes config et endpoints que la page Évaluation).
export function ComparablesEditor({ propertyId }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: paramData } = useQuery({ queryKey: ['acmParams'], queryFn: () => api.get('/acm/params') });
  const params = paramData?.params;
  const { data: bundle } = useQuery({ queryKey: ['bundle', propertyId], queryFn: () => api.get(`/properties/${propertyId}/bundle`), enabled: !!propertyId });
  const boolIncl = useMemo(() => new Set([...(params?.boolean_inclusions || []), 'sous_sol_fini', 'climatisation', 'thermopompe']), [params]);
  const inclOptions = useMemo(() => Object.keys(params?.inclusions || {}).map((k) => ({ value: k, label: prettyIncl(k), boolean: boolIncl.has(k) })), [params, boolIncl]);
  const featureFields = useMemo(() => buildFeatureFields(params), [params]);
  const refetch = () => qc.invalidateQueries({ queryKey: ['bundle', propertyId] });
  return (
    <EntityTable
      cfg={comparablesConfig(t, inclOptions, featureFields)}
      propertyId={propertyId}
      items={bundle?.comparables || []}
      onChanged={refetch}
      selectable
      headerActions={<MatrixImport propertyId={propertyId} onDone={refetch} />}
    />
  );
}

// ─────────────────────────── Page ───────────────────────────
export default function Evaluation() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState('');
  const [subject, setSubject] = useState(null);   // { living_area, year_built, inclusions, municipal_assessment }
  const [params, setParams] = useState(null);
  const [clientView, setClientView] = useState(false);
  const [result, setResult] = useState(null);
  const [calcOpen, setCalcOpen] = useState(false);

  const { data: props } = useQuery({ queryKey: ['properties', 'all'], queryFn: () => api.get('/properties?limit=500&sort=updated_at&dir=desc') });
  const { data: paramData } = useQuery({ queryKey: ['acmParams'], queryFn: () => api.get('/acm/params') });
  const { data: bundle } = useQuery({
    queryKey: ['bundle', propertyId],
    queryFn: () => api.get(`/properties/${propertyId}/bundle`),
    enabled: !!propertyId,
  });

  // Initialisation au rendu (TanStack Query v5 : pas d'onSuccess sur useQuery). Converge :
  // une fois params/subject définis, les conditions deviennent fausses.
  if (paramData && !params) setParams(paramData.params);
  if (bundle && subject == null) {
    const livable = (bundle.buildings || []).reduce((s, x) => s + (Number(x.livable_area) || 0), 0) || '';
    const b0 = (bundle.buildings || []).find((x) => x.year_built) || (bundle.buildings || [])[0] || {};
    setSubject({
      living_area: livable, year_built: b0.year_built ?? '', inclusions: {},
      municipal_assessment: bundle.property?.municipal_assessment ?? '',
      // Caractéristiques pré-remplies depuis le bâtiment principal (éditables).
      foundation: b0.foundation ?? '', cladding: b0.exterior_cladding ?? '',
      windows_type: b0.fenestration ?? '', flooring: b0.flooring ?? '',
      windows_age: '', roof_age: '',
    });
  }

  // Inclusions oui/non (case à cocher, pas de quantité). Repli local au cas où les paramètres
  // du serveur ne contiennent pas encore `boolean_inclusions` (seed mis en cache au démarrage).
  const boolIncl = useMemo(() => new Set([...(params?.boolean_inclusions || []), 'sous_sol_fini', 'climatisation', 'thermopompe']), [params]);
  const inclOptions = useMemo(() => Object.keys(params?.inclusions || {}).map((k) => ({ value: k, label: prettyIncl(k), boolean: boolIncl.has(k) })), [params, boolIncl]);
  const featureFields = useMemo(() => buildFeatureFields(params), [params]);

  const putParams = useMutation({
    mutationFn: (p) => api.put('/acm/params', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acmParams'] }),
  });

  const compute = useMutation({
    mutationFn: () => api.post(`/properties/${propertyId}/acm`, { subject, params }),
    onSuccess: (r) => setResult(r),
  });

  const onSelect = (id) => { setPropertyId(id); setSubject(null); setResult(null); };
  const refetchComps = () => qc.invalidateQueries({ queryKey: ['bundle', propertyId] });

  const propRows = props?.rows || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.evaluation')}</h1>
          <div className="page-subtitle">{t('ev.subtitle')}</div>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <Button variant="outline" icon={Ruler} onClick={() => setCalcOpen(true)}>{t('ev.calc.btn')}</Button>
      </div>
      {calcOpen && <SurfaceCalculator onClose={() => setCalcOpen(false)} onApply={(total) => { setCalcOpen(false); if (subject) setSubject({ ...subject, living_area: total }); }} />}

      <Card style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: 480 }}>
          <label>{t('ev.selectProp')}</label>
          <Select value={propertyId} onChange={(e) => onSelect(e.target.value)}>
            <option value="">{t('ev.selectPropPh')}</option>
            {propRows.map((p) => <option key={p.id} value={p.id}>{p.name || p.address || p.id} {p.city ? `— ${p.city}` : ''}</option>)}
          </Select>
        </div>
      </Card>

      {!propertyId ? (
        <EmptyState icon={FileBarChart} title={t('ev.pickFirst')} hint={t('ev.pickHint')} />
      ) : !subject || !params ? (
        <div className="muted">…</div>
      ) : (
        <>
          {/* 1. Sujet */}
          <div className="section-label">{t('ev.subject')}</div>
          <Card style={{ marginBottom: 16 }}>
            <div className="field-row">
              <div className="field"><label>{t('ev.livable')} (pi²)</label><input className="input" type="number" value={subject.living_area ?? ''} onChange={(e) => setSubject({ ...subject, living_area: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
              <div className="field"><label>{t('d.bld.year')}</label><input className="input" type="number" value={subject.year_built ?? ''} onChange={(e) => setSubject({ ...subject, year_built: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
              <div className="field"><label>{t('ev.assessment')}</label><input className="input" type="number" value={subject.municipal_assessment ?? ''} onChange={(e) => setSubject({ ...subject, municipal_assessment: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
            </div>
            <div className="field-row">
              {featureFields.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <Select value={subject[f.key] ?? ''} onChange={(e) => setSubject({ ...subject, [f.key]: e.target.value })}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <input className="input" type="number" value={subject[f.key] ?? ''} onChange={(e) => setSubject({ ...subject, [f.key]: e.target.value === '' ? '' : Number(e.target.value) })} />
                  )}
                </div>
              ))}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('ev.inclusions')} ({t('ev.inclQty')})</label>
              <InclusionsField value={subject.inclusions} options={inclOptions} onChange={(v) => setSubject({ ...subject, inclusions: v })} />
            </div>
          </Card>

          {/* 2. Comparables */}
          <div className="section-label">{t('ev.comparables')}</div>
          <EntityTable
            cfg={comparablesConfig(t, inclOptions, featureFields)}
            propertyId={propertyId}
            items={bundle?.comparables || []}
            onChanged={refetchComps}
            selectable
            headerActions={<MatrixImport propertyId={propertyId} onDone={refetchComps} />}
          />

          {/* 3. Paramètres */}
          <div className="section-label" style={{ marginTop: 20 }}>{t('ev.paramsTitle')}</div>
          <ParamsPanel params={params} onChange={setParams} onSave={() => putParams.mutate(params)} saving={putParams.isPending} city={bundle?.property?.city} genre={bundle?.property?.genre} />

          {/* 4. Calcul */}
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <Button variant="primary" icon={Calculator} onClick={() => compute.mutate()} disabled={compute.isPending}>{t('ev.compute')}</Button>
            {compute.isError && <span className="notice notice-warn" style={{ margin: 0 }}><AlertTriangle size={16} />{String(compute.error?.message)}</span>}
          </div>

          {result && <AcmResults result={result} clientView={clientView} setClientView={setClientView} />}
        </>
      )}
    </div>
  );
}
