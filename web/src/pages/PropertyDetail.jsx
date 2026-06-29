import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Building, DoorOpen, Receipt, Calculator,
  History, Scale, FileText, AlertTriangle, Info, Plus, Upload, FileDown, Presentation,
  Image as ImageIcon, Trash2, Megaphone, Copy, Check, Save, Pencil, Eye,
} from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge, EmptyState, Modal } from '../components/ui.jsx';
import { EntityTable, EntityForm, InlineTable, PasteImportModal } from '../components/EntityTable.jsx';
import { buildingsConfig, unitsConfig } from '../lib/propertyConfigs.jsx';
import { useI18n } from '../i18n/index.jsx';
import { money, num, pct, mult } from '../lib/format.js';

// ─────────────────────────── Field / column specs per entity ───────────────────────────
// Forms and tables are config-driven (DRY, mirrors the server-side repo/route factories).
// Bâtiments / Unités : voir lib/propertyConfigs.js (partagés avec la page Ajouter/Éditer).
const EXPENSE_CATS = ['taxes_municipales', 'taxes_scolaires', 'assurances', 'energie', 'entretien', 'gestion', 'deneigement', 'conciergerie', 'reserve', 'autre'];
const TX_STATUS = ['inscription', 'en_vigueur', 'vendue', 'expiree', 'retiree'];

function expensesConfig(t) {
  return {
    path: 'expenses', titleKey: 'd.tab.expenses', icon: Receipt,
    columns: [
      { key: 'category', label: t('d.exp.category'), render: (r) => t(`d.exp.cat.${r.category}`) || r.category },
      { key: 'label', label: t('common.name'), render: (r) => r.label || '—' },
      { key: 'amount', label: t('d.exp.amount'), align: 'num', render: (r) => money(r.amount) },
      { key: 'period', label: t('d.exp.period'), render: (r) => t(`d.exp.period.${r.period}`) || r.period },
    ],
    fields: [
      { key: 'category', label: t('d.exp.category'), type: 'select', required: true, options: EXPENSE_CATS.map((c) => ({ value: c, label: t(`d.exp.cat.${c}`) })), half: true },
      { key: 'label', label: t('common.name'), half: true },
      { key: 'amount', label: t('d.exp.amount'), type: 'number', half: true },
      { key: 'period', label: t('d.exp.period'), type: 'select', options: [{ value: 'annuel', label: t('d.exp.period.annuel') }, { value: 'mensuel', label: t('d.exp.period.mensuel') }], half: true },
      { key: 'notes', label: t('common.notes'), type: 'textarea' },
    ],
    defaults: { period: 'annuel', category: 'taxes_municipales' },
  };
}

function transactionsConfig(t) {
  return {
    path: 'transactions', titleKey: 'd.tab.transactions', icon: History,
    columns: [
      { key: 'date', label: t('d.tx.date'), render: (r) => r.date || '—' },
      { key: 'status', label: t('common.status'), render: (r) => <Badge tone="info">{t(`d.tx.st.${r.status}`) || r.status}</Badge> },
      { key: 'price', label: t('d.tx.price'), align: 'num', render: (r) => money(r.price) },
      { key: 'source', label: t('d.tx.source') },
    ],
    fields: [
      { key: 'date', label: t('d.tx.date'), placeholder: 'AAAA-MM-JJ', half: true },
      { key: 'status', label: t('common.status'), type: 'select', options: TX_STATUS.map((s) => ({ value: s, label: t(`d.tx.st.${s}`) })), half: true },
      { key: 'price', label: t('d.tx.price'), type: 'number', half: true },
      { key: 'source', label: t('d.tx.source'), placeholder: 'Centris / Registre foncier / JLR', half: true },
      { key: 'party_seller', label: t('d.tx.seller'), half: true },
      { key: 'party_buyer', label: t('d.tx.buyer'), half: true },
      { key: 'notes', label: t('common.notes'), type: 'textarea' },
    ],
    defaults: { status: 'inscription' },
  };
}

// ─────────────────────────── Profitability (Rentabilité) tab ───────────────────────────
function ProfitabilityTab({ propertyId }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [vacancy, setVacancy] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['analysis', propertyId, value, vacancy],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (value !== '') qs.set('value', value);
      if (vacancy !== '') qs.set('vacancy', String(Number(vacancy) / 100));
      const s = qs.toString();
      return api.get(`/properties/${propertyId}/analysis${s ? `?${s}` : ''}`);
    },
  });

  if (isLoading) return <div className="muted">…</div>;
  const f = data?.financials;
  if (!f) return null;

  const kpis = [
    { label: t('d.fin.gpi'), value: money(f.grossPotentialIncome), sub: t('d.fin.annual') },
    { label: t('d.fin.egi'), value: money(f.effectiveGrossIncome), sub: f.vacancyLoss ? `− ${money(f.vacancyLoss)} ${t('d.fin.vacancy')}` : t('d.fin.annual') },
    { label: t('d.fin.opex'), value: money(f.operatingExpenses), sub: f.expenseRatio != null ? `${t('d.fin.expRatio')} ${pct(f.expenseRatio)}` : '' },
    { label: t('d.fin.noi'), value: money(f.netOperatingIncome), sub: f.noiPerDoor != null ? `${money(f.noiPerDoor)} ${t('d.fin.perDoor')}` : '' },
    { label: t('d.fin.capRate'), value: pct(f.capRate, 2), sub: 'TGA' },
    { label: t('d.fin.grm'), value: mult(f.grossRentMultiplier), sub: 'MRB' },
    { label: t('d.fin.nrm'), value: mult(f.netRentMultiplier), sub: 'MRN' },
    { label: t('d.fin.perDoorPrice'), value: money(f.pricePerDoor), sub: `${f.doors} ${t('d.fin.doors')}` },
  ];

  return (
    <div>
      {(f.alerts || []).map((a, i) => (
        <div key={i} className={`notice notice-${a.level === 'warn' ? 'warn' : 'info'}`}>
          {a.level === 'warn' ? <AlertTriangle size={16} /> : <Info size={16} />}{a.message}
        </div>
      ))}

      <Card style={{ marginBottom: 16 }}>
        <div className="field-row">
          <div className="field">
            <label>{t('d.fin.refValue')}</label>
            <input className="input" type="number" value={value} placeholder={data?.valueSource === 'transaction active' ? `${num(data.value)} (${t('d.fin.fromTx')})` : t('d.fin.refValueHint')} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('d.fin.vacancyRate')}</label>
            <input className="input" type="number" value={vacancy} placeholder="0" onChange={(e) => setVacancy(e.target.value)} />
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{t('d.fin.note')}</div>
      </Card>

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="label">{k.label}</div>
            <div className="value">{k.value}</div>
            {k.sub && <div className="sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      {f.expenseLines?.length > 0 && (
        <Card style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>{t('d.exp.category')}</th><th>{t('common.name')}</th><th className="num">{t('d.fin.annual')}</th></tr></thead>
            <tbody>
              {f.expenseLines.map((e) => (
                <tr key={e.id}><td>{t(`d.exp.cat.${e.category}`) || e.category}</td><td>{e.label}</td><td className="num">{money(e.annual)}</td></tr>
              ))}
              <tr><td colSpan={2}><strong>{t('d.fin.opex')}</strong></td><td className="num"><strong>{money(f.operatingExpenses)}</strong></td></tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────── Read-only list (comparables / reports — Module 2) ───────────────────────────
function ReadOnlyList({ icon: Icon, items, columns, hint }) {
  const { t } = useI18n();
  if (!items || items.length === 0) return <EmptyState icon={Icon} title={t('d.empty')} hint={hint} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.align === 'num' ? 'num' : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>{columns.map((c) => <td key={c.key} className={c.align === 'num' ? 'num' : undefined}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Characterization (Caractérisation) ───────────────────────────
function CharacterizationTab({ bundle, refetch }) {
  const { t } = useI18n();
  const p = bundle.property;
  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div className="kv">
          <div className="muted">{t('common.type')}</div><div>{p.genre}</div>
          <div className="muted">{t('d.prop.client')}</div><div>{bundle.client ? `${bundle.client.full_name}${bundle.client.org_name ? ` (${bundle.client.org_name})` : ''}` : <span className="muted">—</span>}</div>
          <div className="muted">Adresse</div><div>{p.address || '—'}{p.city ? `, ${p.city}` : ''}</div>
          <div className="muted">{t('d.prop.zoning')}</div><div>{p.zoning || '—'}</div>
          <div className="muted">{t('d.prop.lot')}</div><div className="mono">{p.lot_number || '—'}</div>
          <div className="muted">MLS / Centris</div><div className="mono">{p.mls_number || '—'}</div>
          <div className="muted">{t('common.status')}</div><div><Badge tone="neutral">{p.status}</Badge></div>
        </div>
      </Card>
      <EntityTable cfg={buildingsConfig(t)} propertyId={p.id} items={bundle.buildings} onChanged={refetch} extraInvalidate={[['analysis', p.id]]} />
    </div>
  );
}

// ─────────────────────────── Dépenses : tableau à édition en ligne (+ dialogue) ───────────────────────────
function ExpensesTab({ p, items, refetch }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const cfg = expensesConfig(t);
  const onSaved = () => { refetch(); qc.invalidateQueries({ queryKey: ['analysis', p.id] }); };
  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 13 }}>{t('d.exp.inlineHint')}</div>
        <div className="spacer" />
        <Button variant="outline" size="sm" icon={Plus} onClick={() => setDialog(true)}>{t('d.exp.addForm')}</Button>
      </div>
      <InlineTable cfg={cfg} propertyId={p.id} items={items} onChanged={onSaved} extraInvalidate={[['analysis', p.id]]} />
      {dialog && <EntityForm cfg={cfg} propertyId={p.id} row={null} onClose={() => setDialog(false)} onSaved={onSaved} />}
    </div>
  );
}

// ─────────────────────────── Rent roll : table + import copier-coller ───────────────────────────
function UnitsTab({ p, items, buildings, refetch }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const cfg = unitsConfig(t, buildings);
  const onChanged = () => { refetch(); qc.invalidateQueries({ queryKey: ['analysis', p.id] }); };
  return (
    <>
      <EntityTable
        cfg={cfg} propertyId={p.id} items={items} onChanged={refetch} extraInvalidate={[['analysis', p.id]]}
        headerActions={<Button variant="outline" size="sm" icon={Upload} onClick={() => setImporting(true)}>{t('imp.paste')}</Button>}
      />
      {importing && <PasteImportModal cfg={cfg} propertyId={p.id} onClose={() => setImporting(false)} onDone={onChanged} />}
    </>
  );
}

// ─────────────────────────── Marketing : annonces texte (déterministe) ───────────────────────────
function CopyField({ label, text, limit }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text || ''); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  };
  const over = limit && (text || '').length > limit;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <span className="muted" style={{ fontSize: 11, color: over ? 'var(--color-danger)' : undefined }}>
          {(text || '').length}{limit ? ` / ${limit}` : ''} car.
        </span>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={copy}>
          {copied ? t('d.mkt.copied') : t('d.mkt.copy')}
        </Button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 10, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function MarketingTab({ propertyId }) {
  const { t } = useI18n();
  const [lang, setLang] = useState('fr');
  const [emoji, setEmoji] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['mkt', propertyId, lang, emoji],
    queryFn: () => api.get(`/properties/${propertyId}/marketing-copy?lang=${lang}&emoji=${emoji}`),
  });
  const f = data?.formats;
  const sel = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 };
  return (
    <Card>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t('d.mkt.hint')}</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={sel}>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="bi">Bilingue (FR + EN)</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={emoji} onChange={(e) => setEmoji(e.target.checked)} /> {t('d.mkt.emoji')}
        </label>
      </div>
      {isLoading || !f ? (
        <div className="muted">…</div>
      ) : (
        <div>
          <CopyField label={t('d.mkt.kijijiTitle')} text={f.kijiji.title} limit={70} />
          <CopyField label={t('d.mkt.kijijiBody')} text={f.kijiji.body} />
          <CopyField label="Facebook" text={f.facebook.text} />
          <CopyField label="Facebook Marketplace" text={f.marketplace.description} />
          <CopyField label="Instagram" text={f.instagram.caption} limit={2200} />
          <CopyField label={t('d.mkt.xthread')} text={f.twitter.thread.join('\n\n')} />
          <CopyField label="LinkedIn" text={f.linkedin.text} limit={3000} />
          {data.disclaimers && (
            <div className="muted" style={{ fontSize: 11, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
              {data.disclaimers.map((d, i) => <div key={i}>• {d}</div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────── Photos de propriété ───────────────────────────
// Téléversement + assignation de rôle (photo principale / carte / intérieur / galerie) ;
// alimente les brochures (PDF + PPTX). Les images sans rôle servent de repli.
const PHOTO_ROLES = [
  { id: 'hero', key: 'd.ph.hero' },
  { id: 'map', key: 'd.ph.map' },
  { id: 'interior', key: 'd.ph.interior' },
  { id: 'gallery', key: 'd.ph.gallery' },
];

function PhotosTab({ property, refetch }) {
  const propertyId = property.id;
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [qrUrl, setQrUrl] = useState(property.brochure_qr_url || '');
  const [qrSaved, setQrSaved] = useState(false);
  const saveQr = async () => {
    const v = qrUrl.trim();
    if (v === (property.brochure_qr_url || '')) return;
    await api.patch(`/properties/${propertyId}`, { brochure_qr_url: v || null });
    setQrSaved(true); setTimeout(() => setQrSaved(false), 1500);
    refetch?.();
  };
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', propertyId],
    queryFn: () => api.get(`/properties/${propertyId}/photos`),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['photos', propertyId] });

  const onUpload = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      await api.upload(`/properties/${propertyId}/photos`, fd);
      invalidate();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const setRole = async (m, role) => { await api.patch(`/properties/${propertyId}/photos/${m.id}`, { role }); invalidate(); };
  const remove = async (m) => { await api.del(`/properties/${propertyId}/photos/${m.id}`); invalidate(); };

  return (
    <Card>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t('d.ph.hint')}</div>
      <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? t('d.ph.uploading') : t('d.ph.add')}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t('d.ph.qr')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 560 }}>
          <input
            type="text"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
            onBlur={saveQr}
            placeholder={t('d.ph.qr.ph')}
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }}
          />
          {qrSaved && <span style={{ color: 'var(--color-success, #07D581)', fontSize: 12 }}>✓</span>}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('d.ph.qr.help')}</div>
      </div>
      {err && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{err}</div>}
      {isLoading ? (
        <div className="muted" style={{ marginTop: 16 }}>…</div>
      ) : photos.length === 0 ? (
        <div style={{ marginTop: 16 }}><EmptyState icon={ImageIcon} title={t('d.ph.empty')} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          {photos.map((m) => (
            <div key={m.id} className="card" style={{ padding: 8, border: '1px solid var(--color-border)' }}>
              <img
                src={api.url(m.url)}
                alt={m.filename || ''}
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, background: 'var(--color-surface-2)' }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <select
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value)}
                  style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  {PHOTO_ROLES.map((r) => <option key={r.id} value={r.id}>{t(r.key)}</option>)}
                </select>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(m)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────── Sélecteur de modèle de brochure ───────────────────────────
// Le courtier DOIT choisir un modèle (notamment car le modèle Luxe affiche un logo de service
// non encore souscrit). Aucun modèle n'est généré sans choix explicite.
const BROCHURE_TEMPLATES = [
  { id: 'unifamilial', labelKey: 'd.bro.unifamilial', descKey: 'd.bro.unifamilial.d' },
  { id: 'luxe', labelKey: 'd.bro.luxe', descKey: 'd.bro.luxe.d' },
  { id: 'rpa', labelKey: 'd.bro.rpa', descKey: 'd.bro.rpa.d' },
  { id: 'commercial', labelKey: 'd.bro.commercial', descKey: 'd.bro.commercial.d' },
  { id: 'industriel', labelKey: 'd.bro.industriel', descKey: 'd.bro.industriel.d' },
];

// Round-trip PPTX d'UNE propriété avec garde-fou draft → approve/discard + reset to default.
// Le sync enregistre un BROUILLON ; la version live n'est remplacée qu'à l'approbation.
function PptxSync({ statusUrl, postUrl, approveUrl, discardUrl, draftPreviewUrl, queryKey, labelKey, hintKey }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data } = useQuery({ queryKey, queryFn: () => api.get(statusUrl) });
  const inv = () => qc.invalidateQueries({ queryKey });
  const run = async (fn, okKey) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg(okKey ? t(okKey) : null); inv(); return r; }
    catch (e2) { setMsg(e2.message); } finally { setBusy(false); }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    await run(async () => {
      const fd = new FormData(); fd.append('file', f);
      const r = await api.upload(postUrl, fd);
      setMsg(t('d.bro.draft.ready').replace('{n}', (r.roles || []).length));
      return r;
    });
  };
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="sm" variant="ghost" icon={Upload} onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? t('d.bro.tpl.uploading') : t(labelKey)}
        </Button>
        <input ref={ref} type="file" accept=".pptx" hidden onChange={onFile} />
        {data?.customized && <Badge tone="info">{t('d.bro.tpl.custom')}</Badge>}
        {data?.customized && <Button size="sm" variant="ghost" onClick={() => run(() => api.del(statusUrl))} disabled={busy}>{t('d.bro.tpl.reset')}</Button>}
      </div>
      {data?.hasDraft && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--color-bg-secondary)' }}>
          <Badge tone="warning">{t('d.bro.draft.badge')}</Badge>
          <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(draftPreviewUrl, '_blank')}>{t('d.bro.draft.preview')}</Button>
          <Button size="sm" icon={Check} onClick={() => run(() => api.post(approveUrl), 'd.bro.draft.approved')} disabled={busy}>{t('d.bro.draft.approve')}</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => run(() => api.del(discardUrl))} disabled={busy}>{t('d.bro.draft.discard')}</Button>
        </div>
      )}
      {msg && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{msg}</div>}
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t(hintKey)}</div>
    </div>
  );
}

// Round-trip des POSITIONS du MODÈLE (global) avec garde-fou draft → approve/discard + reset.
function TemplateLayout({ template }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data } = useQuery({
    queryKey: ['tpl-layout', template],
    queryFn: () => api.get(`/brochure/templates/${template}/layout`),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ['tpl-layout', template] });
  const run = async (fn, okKey) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg(okKey ? t(okKey) : null); inv(); return r; }
    catch (e2) { setMsg(e2.message); } finally { setBusy(false); }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    await run(async () => {
      const fd = new FormData(); fd.append('file', f);
      const r = await api.upload(`/brochure/templates/${template}/layout`, fd);
      setMsg(t('d.bro.draft.ready').replace('{n}', (r.roles || []).length));
      return r;
    });
  };
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="sm" variant="ghost" icon={Upload} onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? t('d.bro.tpl.uploading') : t('d.bro.tpl.update')}
        </Button>
        <input ref={ref} type="file" accept=".pptx" hidden onChange={onFile} />
        {data?.customized && <Badge tone="info">{t('d.bro.tpl.custom')}</Badge>}
        {data?.customized && <Button size="sm" variant="ghost" onClick={() => run(() => api.del(`/brochure/templates/${template}/layout`))} disabled={busy}>{t('d.bro.tpl.reset')}</Button>}
      </div>
      {data?.hasDraft && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--color-bg-secondary)' }}>
          <Badge tone="warning">{t('d.bro.draft.badge')}</Badge>
          <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(api.url(`/brochure/templates/${template}/sample.pdf?draft=1`), '_blank')}>{t('d.bro.draft.preview')}</Button>
          <Button size="sm" icon={Check} onClick={() => run(() => api.post(`/brochure/templates/${template}/layout/approve`), 'd.bro.draft.approved')} disabled={busy}>{t('d.bro.draft.approve')}</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => run(() => api.del(`/brochure/templates/${template}/layout/draft`))} disabled={busy}>{t('d.bro.draft.discard')}</Button>
        </div>
      )}
      {msg && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{msg}</div>}
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('d.bro.tpl.hint')}</div>
    </div>
  );
}

// ─────────────────────────── Éditeur de contenu RPA (Module 4 phase 1b) ───────────────────────────
// Format éditorial distinct (render_rpa_brochure). Déterministe, sans IA : le contenu par défaut
// (rpa-brochure-content.json) sert de schéma ; la surcharge texte par propriété est enregistrée dans
// documents.data.content ; les photos sont affectées aux emplacements via le rôle de la photo (rpa_*).
const RPA_LABELS = {
  running_title: 'Titre courant', cover: 'Couverture', comfort: 'Confort', security: 'Sécurité',
  amenities: 'Commodités', life: 'Vie sociale', contact: 'Contact', pill: 'Pastille',
  eyebrow: 'Sur-titre', title: 'Titre', subtitle: 'Sous-titre', chips: 'Puces', text: 'Texte',
  lead: 'Accroche', kicker: 'Intro', features: 'Caractéristiques', label: 'Libellé', desc: 'Description',
  note: 'Note', sub: 'Sous-texte', wide_caption: 'Légende (image large)', panel_title: 'Titre du panneau',
  panel_items: 'Éléments du panneau', panel_caption: 'Légende du panneau', services: 'Services',
  services_title: 'Titre des services', services_kicker: 'Intro services', gallery: 'Galerie',
  caption: 'Légende', pillars: 'Piliers', events: 'Événements', neighborhood: 'Quartier',
  neighborhood_title: 'Titre du quartier', neighborhood_kicker: 'Intro quartier', finance: 'Avantage financier',
  cta: "Appel à l'action", disclaimer: 'Avertissement', running: 'Titre courant', hero_tag: 'Étiquette',
};
const RPA_SLOT_LABELS = {
  rpa_cover: 'Couverture (héros)', rpa_comfort: 'Confort (image large)', rpa_security: 'Sécurité (panneau)',
  rpa_gallery1: 'Galerie 1', rpa_gallery2: 'Galerie 2', rpa_gallery3: 'Galerie 3',
  rpa_gallery4: 'Galerie 4', rpa_gallery5: 'Galerie 5', rpa_gallery6: 'Galerie 6',
  rpa_event1: 'Événement 1', rpa_event2: 'Événement 2', rpa_event3: 'Événement 3',
  rpa_contact: 'Contact (héros)',
};
const rpaLabel = (k) => RPA_LABELS[k] || String(k).replace(/_/g, ' ');
const RPA_SKIP = new Set(['icon']);
const rpaIsObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function rpaMergeDeep(base, over) {
  if (!rpaIsObj(base)) return over === undefined ? base : over;
  if (!rpaIsObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = rpaIsObj(base[k]) && rpaIsObj(over[k]) ? rpaMergeDeep(base[k], over[k]) : over[k];
  return out;
}
function rpaSetAt(obj, parts, value) {
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return out;
}
const RPA_INPUT = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit' };
function RpaText({ value, onChange }) {
  const v = value == null ? '' : value;
  const rows = v.length > 60 ? 3 : 1;
  return <textarea value={v} rows={rows} onChange={(e) => onChange(e.target.value)} style={{ ...RPA_INPUT, resize: 'vertical' }} />;
}
function RpaNode({ node, path, onChange }) {
  if (typeof node === 'string' || node == null) return <RpaText value={node} onChange={(val) => onChange(path, val)} />;
  if (Array.isArray(node)) {
    const allStr = node.every((x) => typeof x === 'string' || x == null);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: allStr ? 6 : 10 }}>
        {node.map((item, i) => (allStr ? (
          <RpaText key={i} value={item} onChange={(val) => onChange([...path, i], val)} />
        ) : (
          <div key={i} className="card" style={{ padding: 10, border: '1px solid var(--color-border)' }}>
            <RpaNode node={item} path={[...path, i]} onChange={onChange} />
          </div>
        )))}
      </div>
    );
  }
  if (rpaIsObj(node)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.keys(node).filter((k) => !RPA_SKIP.has(k) && !k.startsWith('_')).map((k) => (
          <div key={k}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{rpaLabel(k)}</div>
            <RpaNode node={node[k]} path={[...path, k]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}
function RpaContentEditor({ propertyId, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['rpa-content', propertyId], queryFn: () => api.get(`/properties/${propertyId}/brochure/rpa/content`) });
  const { data: photos = [] } = useQuery({ queryKey: ['photos', propertyId], queryFn: () => api.get(`/properties/${propertyId}/photos`) });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  React.useEffect(() => {
    if (data && draft === null) setDraft(rpaMergeDeep(data.schema || {}, data.value || {}));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = (path, value) => setDraft((d) => rpaSetAt(d, path, value));
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api.put(`/properties/${propertyId}/brochure/rpa/content`, { content: draft }); setMsg(t('d.rpa.saved')); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const assign = async (role, mediaId) => {
    const prev = photos.find((p) => p.role === role);
    if (prev && prev.id !== mediaId) await api.patch(`/properties/${propertyId}/photos/${prev.id}`, { role: 'gallery' });
    if (mediaId) await api.patch(`/properties/${propertyId}/photos/${mediaId}`, { role });
    qc.invalidateQueries({ queryKey: ['photos', propertyId] });
  };
  const slots = data?.slots || [];
  const sectionKeys = draft ? Object.keys(draft).filter((k) => !k.startsWith('_')) : [];
  return (
    <Modal title={t('d.rpa.title')} onClose={onClose} size="lg">
      {isLoading || !draft ? (
        <div className="muted">…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
          <div className="muted" style={{ fontSize: 13 }}>{t('d.rpa.hint')}</div>
          <Card>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('d.rpa.photos')}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{t('d.rpa.photos.hint')}</div>
            {photos.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>{t('d.rpa.photos.empty')}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {slots.map(({ slot, role }) => {
                  const cur = photos.find((p) => p.role === role);
                  return (
                    <div key={role}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{RPA_SLOT_LABELS[role] || slot}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {cur && <img src={api.url(cur.url)} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                        <select value={cur?.id || ''} onChange={(e) => assign(role, e.target.value)} style={{ ...RPA_INPUT, flex: 1 }}>
                          <option value="">{t('d.rpa.photo.none')}</option>
                          {photos.map((p) => <option key={p.id} value={p.id}>{p.filename || p.id}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          {sectionKeys.map((k) => (
            <Card key={k}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{rpaLabel(k)}</div>
              <RpaNode node={draft[k]} path={[k]} onChange={onChange} />
            </Card>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, alignItems: 'center' }}>
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button icon={Save} onClick={save} disabled={busy || !draft}>{busy ? t('d.rpa.saving') : t('common.save')}</Button>
      </div>
    </Modal>
  );
}

function BrochureChooser({ propertyId, onClose }) {
  const { t } = useI18n();
  const [rpaEdit, setRpaEdit] = useState(false);
  const gen = (tplId, fmt) => {
    window.open(api.url(`/properties/${propertyId}/brochure.${fmt}?template=${tplId}`), '_blank');
    onClose();
  };
  return (
    <Modal title={t('d.bro.title')} onClose={onClose} size="lg">
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t('d.bro.hint')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BROCHURE_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="card"
            style={{ opacity: tpl.soon ? 0.55 : 1, padding: 16, border: '1px solid var(--color-border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} />
              <strong>{t(tpl.labelKey)}</strong>
              {tpl.soon && <Badge tone="neutral">{t('common.soon')}</Badge>}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t(tpl.descKey)}</div>
            {!tpl.soon && (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Button size="sm" icon={FileDown} onClick={() => gen(tpl.id, 'pdf')}>{t('d.bro.pdf')}</Button>
                  <Button size="sm" variant="outline" icon={Presentation} onClick={() => gen(tpl.id, 'pptx')}>{t('d.bro.pptx')}</Button>
                  {tpl.id === 'rpa' && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setRpaEdit(true)}>{t('d.bro.rpa.edit')}</Button>}
                </div>
                <PptxSync
                  statusUrl={`/properties/${propertyId}/brochure/${tpl.id}/presentation`}
                  postUrl={`/properties/${propertyId}/brochure/${tpl.id}/sync`}
                  approveUrl={`/properties/${propertyId}/brochure/${tpl.id}/approve`}
                  discardUrl={`/properties/${propertyId}/brochure/${tpl.id}/draft`}
                  draftPreviewUrl={api.url(`/properties/${propertyId}/brochure.pdf?template=${tpl.id}&draft=1`)}
                  queryKey={['pres', propertyId, tpl.id]}
                  labelKey="d.bro.pres.update"
                  hintKey={tpl.id === 'rpa' ? 'd.bro.pres.hintRpa' : 'd.bro.pres.hint'}
                />
                {tpl.id !== 'rpa' && <TemplateLayout template={tpl.id} />}
              </>
            )}
          </div>
        ))}
      </div>
      {rpaEdit && <RpaContentEditor propertyId={propertyId} onClose={() => setRpaEdit(false)} />}
    </Modal>
  );
}

// ─────────────────────────── Page ───────────────────────────
const TABS = [
  { id: 'charact', labelKey: 'd.tab.charact', icon: Building },
  { id: 'units', labelKey: 'd.tab.units', icon: DoorOpen },
  { id: 'expenses', labelKey: 'd.tab.expenses', icon: Receipt },
  { id: 'profit', labelKey: 'd.tab.profit', icon: Calculator },
  { id: 'transactions', labelKey: 'd.tab.transactions', icon: History },
  { id: 'comparables', labelKey: 'd.tab.comparables', icon: Scale },
  { id: 'photos', labelKey: 'd.tab.photos', icon: ImageIcon },
  { id: 'marketing', labelKey: 'd.tab.marketing', icon: Megaphone },
  { id: 'reports', labelKey: 'd.tab.reports', icon: FileText },
];

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('charact');
  const [brochureOpen, setBrochureOpen] = useState(false);

  const { data: bundle, isLoading, isError } = useQuery({
    queryKey: ['bundle', id],
    queryFn: () => api.get(`/properties/${id}/bundle`),
  });
  const refetch = () => qc.invalidateQueries({ queryKey: ['bundle', id] });

  if (isLoading) return <div className="page"><div className="muted">…</div></div>;
  if (isError || !bundle) return <div className="page"><EmptyState icon={Building} title={t('d.notFound')} action={<Button onClick={() => navigate('/properties')}>{t('d.back')}</Button>} /></div>;

  const p = bundle.property;

  return (
    <div className="page">
      <button className="crumb" onClick={() => navigate('/properties')}><ChevronLeft size={16} />{t('d.back')}</button>
      <div className="page-header">
        <div>
          <h1>{p.name || p.address || t('nav.properties')}</h1>
          <div className="page-subtitle">
            <Badge tone="info">{p.genre}</Badge>{' '}
            {p.address ? `${p.address}${p.city ? `, ${p.city}` : ''}` : (p.city || '')}
          </div>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <Button variant="outline" icon={FileText} onClick={() => setBrochureOpen(true)}>{t('d.brochure')}</Button>
      </div>
      {brochureOpen && <BrochureChooser propertyId={p.id} onClose={() => setBrochureOpen(false)} />}

      <div className="tab-row">
        <div className="tabs">
          {TABS.map((tb) => (
            <button key={tb.id} className={`tab ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>{t(tb.labelKey)}</button>
          ))}
        </div>
      </div>

      {tab === 'charact' && <CharacterizationTab bundle={bundle} refetch={refetch} />}
      {tab === 'units' && <UnitsTab p={p} items={bundle.units} buildings={bundle.buildings} refetch={refetch} />}
      {tab === 'expenses' && <ExpensesTab p={p} items={bundle.expenses} refetch={refetch} />}
      {tab === 'profit' && <ProfitabilityTab propertyId={p.id} />}
      {tab === 'transactions' && <EntityTable cfg={transactionsConfig(t)} propertyId={p.id} items={bundle.transactions} onChanged={refetch} extraInvalidate={[['analysis', p.id]]} />}
      {tab === 'comparables' && (
        <ReadOnlyList
          icon={Scale}
          items={bundle.comparables}
          hint={t('d.comp.hint')}
          columns={[
            { key: 'address', label: 'Adresse' },
            { key: 'kind', label: t('common.type') },
            { key: 'date', label: t('d.tx.date') },
            { key: 'price', label: t('d.tx.price'), align: 'num', render: (r) => money(r.price) },
            { key: 'area', label: t('d.unit.area'), align: 'num', render: (r) => num(r.area) },
          ]}
        />
      )}
      {tab === 'photos' && <PhotosTab property={p} refetch={refetch} />}
      {tab === 'marketing' && <MarketingTab propertyId={p.id} />}
      {tab === 'reports' && (
        <ReadOnlyList
          icon={FileText}
          items={bundle.reports}
          hint={t('d.rep.hint')}
          columns={[
            { key: 'title', label: t('common.name') },
            { key: 'report_type', label: t('common.type') },
            { key: 'date', label: t('d.tx.date') },
          ]}
        />
      )}
    </div>
  );
}
