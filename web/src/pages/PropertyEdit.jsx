import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, ArrowLeft, FileText, FileBarChart, Map as MapIcon, Trash2, ExternalLink } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, FormField, Select, EmptyState } from '../components/ui.jsx';
import { EntityTable } from '../components/EntityTable.jsx';
import BuildingsUnits, { RentRoll, ExpensesEditor } from '../components/BuildingsUnits.jsx';
import { ComparablesEditor } from './Evaluation.jsx';
import { MarketAnalysisPanel } from './MarketAnalysis.jsx';
import ClientModal from '../components/ClientModal.jsx';
import CityField from '../components/CityField.jsx';
import AttrField from '../components/AttrField.jsx';
import PlansTab from '../components/PlansTab.jsx';
import { COUNTRIES, provincesFor, ZONING_OPTIONS } from '../lib/geo.js';
import {
  ProfitabilityTab, ReadOnlyList, MarketingTab, PhotosTab,
  BrochureChooser, transactionsConfig,
} from './PropertyDetail.jsx';
import { useI18n } from '../i18n/index.jsx';

const BASE_EMPTY = {
  client_id: '', name: '', genre: '', transaction_type: '', address: '', city: '', region: '', mrc: '', province: 'QC',
  postal_code: '', country: 'CA', zoning: '', zoning_detail: '', lot_number: '', mls_number: '', status: 'prospect',
};
const TX_TYPES = ['seller', 'buyer', 'landlord', 'tenant'];
// Attributs déjà couverts par les champs fixes (haut de page) → exclus du formulaire dynamique.
const CORE_ATTR_KEYS = new Set(['address', 'sector', 'genre_detail', 'zoning', 'lot_number']);
const STATUSES = ['prospect', 'actif', 'inscrit', 'vendu', 'expire', 'archive'];
const TABS = [
  { id: 'details', labelKey: 'pe.tab.details' },
  { id: 'buildings', labelKey: 'pe.tab.buildings' },
  { id: 'units', labelKey: 'd.tab.units' },
  { id: 'expenses', labelKey: 'd.tab.expenses' },
  { id: 'profit', labelKey: 'd.tab.profit' },
  { id: 'transactions', labelKey: 'd.tab.transactions' },
  { id: 'comparables', labelKey: 'd.tab.comparables' },
  { id: 'evaluations', labelKey: 'pe.tab.evaluations' },
  { id: 'market', labelKey: 'pe.tab.market' },
  { id: 'photos', labelKey: 'd.tab.photos' },
  { id: 'plans', labelKey: 'pe.tab.plans' },
  { id: 'marketing', labelKey: 'd.tab.marketing' },
  { id: 'reports', labelKey: 'd.tab.reports' },
];

// Onglet Évaluations : instantanés d'opinions de valeur enregistrés (auto au calcul ACM).
function EvaluationsTab({ items, navigate, propertyId, refetch }) {
  const { t } = useI18n();
  const money = (v) => (v == null ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }));
  const del = async (id) => { if (window.confirm(t('pe.evl.delConfirm'))) { await api.del(`/evaluations/${id}`); refetch(); } };
  if (!items?.length) {
    return <EmptyState icon={FileBarChart} title={t('pe.evl.none')} hint={t('pe.evl.noneHint')}
      action={<Button variant="outline" icon={FileBarChart} onClick={() => navigate(`/evaluation?property=${propertyId}`)}>{t('pe.evaluate')}</Button>} />;
  }
  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead><tr>
          <th>{t('pe.evl.date')}</th><th className="num">{t('pe.evl.opinion')}</th><th className="num">{t('pe.evl.range')}</th>
          <th className="num">{t('pe.evl.listing')}</th><th className="num">{t('pe.evl.comps')}</th><th></th>
        </tr></thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{(e.created_at || e.as_of || '').slice(0, 16).replace('T', ' ')}</td>
              <td className="num" style={{ fontWeight: 700 }}>{money(e.expected_point)}</td>
              <td className="num muted">{e.expected_low != null ? `${money(e.expected_low)} – ${money(e.expected_high)}` : '—'}</td>
              <td className="num">{money(e.listing_price)}</td>
              <td className="num">{e.sold_count ?? '—'}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => navigate(`/evaluation?property=${propertyId}`)}>{t('pe.evl.open')}</Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => del(e.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PropertyEdit() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const lab = (o) => (lang === 'en' ? o.label_en : o.label_fr) || o.label_fr;

  const [base, setBase] = useState(BASE_EMPTY);
  const [attrs, setAttrs] = useState({});
  const [pendingType, setPendingType] = useState(null);
  const [newClient, setNewClient] = useState(false);
  const [tab, setTab] = useState('details');
  const [brochureOpen, setBrochureOpen] = useState(false);

  const snapBaseRef = useRef(JSON.stringify(BASE_EMPTY));
  const snapAttrsRef = useRef('{}');
  const baseRef = useRef(base); baseRef.current = base;
  const attrsRef = useRef(attrs); attrsRef.current = attrs;
  const isDirty = () => JSON.stringify(baseRef.current) !== snapBaseRef.current
    || JSON.stringify(attrsRef.current) !== snapAttrsRef.current;
  const dirty = JSON.stringify(base) !== snapBaseRef.current || JSON.stringify(attrs) !== snapAttrsRef.current;

  const { data: matrix } = useQuery({ queryKey: ['sales-attributes'], queryFn: () => api.get('/sales-attributes') });
  const { data: clientsData } = useQuery({ queryKey: ['clients', 'all'], queryFn: () => api.get('/clients?limit=1000&sort=full_name&dir=asc') });
  const clients = clientsData?.rows || [];
  const types = matrix?.types || [];

  // En édition : le bundle (propriété + enfants) alimente les onglets repris du détail.
  const { data: bundle } = useQuery({ queryKey: ['bundle', id], queryFn: () => api.get(`/properties/${id}/bundle`), enabled: isEdit });
  const property = bundle?.property;
  const refetch = () => qc.invalidateQueries({ queryKey: ['bundle', id] });

  // Initialisation UNE SEULE FOIS par propriété (les refetch dûs aux onglets enfants ne doivent
  // pas écraser les saisies non enregistrées des « Détails »).
  const loadedIdRef = useRef(null);
  useEffect(() => {
    if (!property || loadedIdRef.current === property.id) return;
    loadedIdRef.current = property.id;
    const cc = (property.country || '').toLowerCase();
    const country = !property.country ? 'CA'
      : (cc.startsWith('ca') ? 'CA' : (cc.startsWith('us') || cc.includes('état') || cc.includes('etat') || cc.includes('united') ? 'US' : property.country));
    const b = {
      client_id: property.client_id || '', name: property.name || '', genre: property.genre || '',
      transaction_type: property.transaction_type || '',
      address: property.address || '', city: property.city || '', region: property.region || '', mrc: property.mrc || '',
      province: property.province || 'QC', postal_code: property.postal_code || '', country,
      zoning: property.zoning || '', zoning_detail: property.zoning_detail || '',
      lot_number: property.lot_number || '', mls_number: property.mls_number || '',
      status: property.status || 'prospect',
    };
    const a = property.attributes || {};
    setBase(b); setAttrs(a);
    snapBaseRef.current = JSON.stringify(b); snapAttrsRef.current = JSON.stringify(a);
  }, [property]);

  const { data: schema } = useQuery({
    queryKey: ['sa-form', base.genre], queryFn: () => api.get(`/sales-attributes/form/${base.genre}`), enabled: !!base.genre,
  });

  const setBaseField = (k, v) => setBase((b) => ({ ...b, [k]: v }));
  const setAttr = (k, v) => setAttrs((a) => ({ ...a, [k]: v }));
  const attrsTouched = () => JSON.stringify(attrsRef.current) !== snapAttrsRef.current;

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.patch(`/properties/${id}`, body) : api.post('/properties', body)),
  });
  const persist = async (onDone) => {
    const row = await save.mutateAsync({ ...base, attributes: attrs });
    snapBaseRef.current = JSON.stringify(base); snapAttrsRef.current = JSON.stringify(attrs);
    qc.invalidateQueries({ queryKey: ['properties'] });
    if (isEdit) qc.invalidateQueries({ queryKey: ['bundle', id] });
    onDone?.(row);
  };

  const onTypeSelect = (g) => {
    if (g === base.genre) return;
    if (base.genre && attrsTouched()) { setPendingType(g); return; }
    setBase((b) => ({ ...b, genre: g })); setAttrs({});
  };
  const applyType = (g) => { setBase((b) => ({ ...b, genre: g })); setAttrs({}); setPendingType(null); };

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty() && !save.isPending && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    const h = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const clientName = (c) => `${c.full_name}${c.org_name ? ` (${c.org_name})` : ''}`;
  const cats = (schema?.categories || []).map((c) => ({
    ...c, attributes: c.attributes.filter((a) => !CORE_ATTR_KEYS.has(a.key)),
  })).filter((c) => c.attributes.length);
  const saveToEdit = () => persist((row) => { if (!isEdit && row?.id) navigate(`/properties/edit/${row.id}`); });
  const isQC = base.country === 'CA' && base.province === 'QC';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{isEdit ? t('pe.titleEdit') : t('pe.title')}</h1>
          <div className="page-subtitle">{t('pe.subtitle')}</div>
        </div>
        <div className="spacer" />
        {isEdit && <Button variant="outline" icon={FileBarChart} onClick={() => navigate(`/evaluation?property=${id}`)}>{t('pe.evaluate')}</Button>}
        {isEdit && <Button variant="outline" icon={MapIcon} onClick={() => navigate(`/market-analysis?property=${id}`)}>{t('pe.marketAnalysis')}</Button>}
        {isEdit && <Button variant="outline" icon={FileText} onClick={() => setBrochureOpen(true)}>{t('d.brochure')}</Button>}
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/properties')}>{t('pe.back')}</Button>
        <Button variant="primary" icon={Save} disabled={save.isPending || !base.name} onClick={saveToEdit}>{t('common.save')}</Button>
      </div>
      {dirty && (
        <button className="fab-save" onClick={() => persist()} disabled={save.isPending || !base.name} title={t('common.save')}>
          <Save size={18} />{save.isPending ? t('off2.saving') : t('common.save')}
        </button>
      )}
      {brochureOpen && <BrochureChooser propertyId={id} onClose={() => setBrochureOpen(false)} />}

      <div className="tab-row">
        <div className="tabs">
          {TABS.map((tb) => (
            <button key={tb.id} className={`tab ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>{t(tb.labelKey)}</button>
          ))}
        </div>
      </div>

      {tab === 'details' && (<>
        <Card>
          <div className="section-label">{t('pe.identity')}</div>
          <div className="field-row">
            <FormField label={t('pe.name')} value={base.name} onChange={(e) => setBaseField('name', e.target.value)} placeholder={t('pe.namePh')} />
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>{t('pe.client')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select value={base.client_id} onChange={(e) => setBaseField('client_id', e.target.value)} style={{ flex: 1 }}>
                  <option value="">{t('pe.clientNone')}</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
                </Select>
                <Button variant="outline" icon={Plus} onClick={() => setNewClient(true)}>{t('pe.newClient')}</Button>
              </div>
            </div>
            <div className="field">
              <label>{t('pe.transactionType')}</label>
              <Select value={base.transaction_type} onChange={(e) => setBaseField('transaction_type', e.target.value)}>
                <option value="">{t('pe.typePick')}</option>
                {TX_TYPES.map((k) => <option key={k} value={k}>{t(`cli.kind.${k}`)}</option>)}
              </Select>
            </div>
            <FormField label={t('pe.lots')} value={base.lot_number} onChange={(e) => setBaseField('lot_number', e.target.value)} />
            <FormField label={t('pe.mls')} value={base.mls_number} onChange={(e) => setBaseField('mls_number', e.target.value)} />
            <div className="field">
              <label>{t('pe.status')}</label>
              <Select value={base.status} onChange={(e) => setBaseField('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`pe.st.${s}`)}</option>)}
              </Select>
            </div>

            <div className="field">
              <label>{t('pe.country')}</label>
              <Select value={base.country} onChange={(e) => setBase((b) => ({ ...b, country: e.target.value, province: '', city: '', region: '' }))}>
                {COUNTRIES.map((c) => <option key={c.v} value={c.v}>{lang === 'en' ? c.en : c.fr}</option>)}
              </Select>
            </div>
            <div className="field">
              <label>{t('pe.state')}</label>
              <Select value={base.province} onChange={(e) => setBase((b) => ({ ...b, province: e.target.value, city: '', region: '' }))}>
                <option value="">{t('pe.typePick')}</option>
                {provincesFor(base.country).map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </Select>
            </div>
            <div className="field">
              <label>{t('pe.city')}</label>
              {isQC ? (
                <CityField value={base.city} placeholder={t('pe.cityPh')}
                  onSelect={(name, region, mrc) => setBase((b) => ({ ...b, city: name, ...(region != null ? { region } : {}), ...(mrc !== null && mrc !== undefined ? { mrc: mrc || '' } : {}) }))} />
              ) : (
                <input className="input" value={base.city} onChange={(e) => setBaseField('city', e.target.value)} />
              )}
            </div>
            <div className="field">
              <label>{t('pe.region')}</label>
              {isQC ? (
                <input className="input" value={base.region} readOnly placeholder={t('pe.regionAuto')} style={{ background: 'var(--color-bg-secondary)' }} />
              ) : (
                <input className="input" value={base.region} onChange={(e) => setBaseField('region', e.target.value)} />
              )}
            </div>
            <div className="field">
              <label>{t('pe.mrc')}</label>
              {isQC ? (
                <input className="input" value={base.mrc} readOnly placeholder={t('pe.regionAuto')} style={{ background: 'var(--color-bg-secondary)' }} />
              ) : (
                <input className="input" value={base.mrc} onChange={(e) => setBaseField('mrc', e.target.value)} />
              )}
            </div>
            <FormField label={t('pe.address')} value={base.address} onChange={(e) => setBaseField('address', e.target.value)} />
            <FormField label={t('pe.postal')} value={base.postal_code} onChange={(e) => setBaseField('postal_code', e.target.value)} />

            <div className="field">
              <label>{t('pe.zoning')}</label>
              <Select value={base.zoning} onChange={(e) => setBaseField('zoning', e.target.value)}>
                <option value="">{t('pe.typePick')}</option>
                {ZONING_OPTIONS.map((z) => <option key={z.v} value={z.v}>{lang === 'en' ? z.en : z.fr}</option>)}
              </Select>
            </div>
            <FormField label={t('pe.zoningDetail')} value={base.zoning_detail} onChange={(e) => setBaseField('zoning_detail', e.target.value)} />
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>{t('pe.propertyType')}</div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>{t('pe.propertyType')}</label>
            <Select value={base.genre} onChange={(e) => onTypeSelect(e.target.value)}>
              <option value="">{t('pe.typePick')}</option>
              {types.map((ty) => <option key={ty.key} value={ty.key}>{lab(ty)}</option>)}
            </Select>
          </div>
        </Card>

        {base.genre && (
          <Card style={{ marginTop: 16 }}>
            <div className="section-label">{t('pe.characteristics')}</div>
            {cats.length === 0 ? (
              <div className="muted">{t('pe.noFields')}</div>
            ) : cats.map((c) => (
              <div key={c.key} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{lab(c)}</div>
                <div className="sa-formgrid">
                  {c.attributes.map((a) => (
                    <AttrField key={a.key} a={a} attrs={attrs} setAttr={setAttr} units={bundle?.units || []} />
                  ))}
                </div>
              </div>
            ))}
          </Card>
        )}
      </>)}

      {tab !== 'details' && !isEdit && (
        <Card>
          <EmptyState title={t('pe.saveFirst')} action={(
            <Button variant="primary" icon={Save} disabled={save.isPending || !base.name} onClick={saveToEdit}>{t('common.save')}</Button>
          )} />
        </Card>
      )}

      {isEdit && (bundle ? (
        <>
          {tab === 'buildings' && <BuildingsUnits propertyId={id} genre={base.genre} propertyAddress={base.address} />}
          {tab === 'units' && <RentRoll propertyId={id} />}
          {tab === 'expenses' && <ExpensesEditor propertyId={id} />}
          {tab === 'profit' && <ProfitabilityTab propertyId={id} />}
          {tab === 'transactions' && <EntityTable cfg={transactionsConfig(t)} propertyId={id} items={bundle.transactions} onChanged={refetch} extraInvalidate={[['analysis', id]]} />}
          {tab === 'comparables' && <ComparablesEditor propertyId={id} />}
          {tab === 'evaluations' && <EvaluationsTab items={bundle.evaluations} navigate={navigate} propertyId={id} refetch={refetch} />}
          {tab === 'market' && <MarketAnalysisPanel propertyId={id} />}
          {tab === 'photos' && <PhotosTab property={property} units={bundle.units} refetch={refetch} />}
          {tab === 'plans' && <PlansTab propertyId={id} />}
          {tab === 'marketing' && <MarketingTab propertyId={id} saved={property.marketing} onSaved={refetch} />}
          {tab === 'reports' && (
            <ReadOnlyList icon={FileText} items={bundle.reports} hint={t('d.rep.hint')} columns={[
              { key: 'title', label: t('common.name') },
              { key: 'report_type', label: t('common.type') },
              { key: 'date', label: t('d.tx.date') },
            ]} />
          )}
        </>
      ) : (tab !== 'details' && <div className="muted" style={{ padding: 16 }}>…</div>))}

      {newClient && (
        <ClientModal
          row={null}
          onClose={() => setNewClient(false)}
          onSaved={(saved) => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            if (saved?.id) setBaseField('client_id', saved.id);
          }}
        />
      )}

      {pendingType !== null && (
        <Modal
          title={t('pe.typeTitle')}
          onClose={() => setPendingType(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setPendingType(null)}>{t('common.cancel')}</Button>
              <Button variant="outline" onClick={() => applyType(pendingType)}>{t('pe.discardSwitch')}</Button>
              <Button variant="primary" disabled={save.isPending || !base.name}
                onClick={() => { const g = pendingType; persist(() => applyType(g)); }}>{t('pe.saveSwitch')}</Button>
            </>
          )}
        >
          {t('pe.typeBody')}
        </Modal>
      )}

      {blocker.state === 'blocked' && (
        <Modal
          title={t('pe.leaveTitle')}
          onClose={() => blocker.reset()}
          footer={(
            <>
              <Button variant="ghost" onClick={() => blocker.reset()}>{t('common.cancel')}</Button>
              <Button variant="outline" onClick={() => blocker.proceed()}>{t('pe.leaveDiscard')}</Button>
              <Button variant="primary" disabled={save.isPending || !base.name}
                onClick={() => persist(() => blocker.proceed())}>{t('pe.saveLeave')}</Button>
            </>
          )}
        >
          {t('pe.leaveBody')}
        </Modal>
      )}
    </div>
  );
}
