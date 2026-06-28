import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Download, Eye, LayoutTemplate, Upload, Check, Trash2, ArrowLeft, Pencil,
  Copy, Lock, Unlock,
} from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge, EmptyState, Modal, Field, Input, Select } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const TABS = ['brochures', 'posts', 'presentations'];

// Mono-utilisateur = administrateur : l'édition d'un original verrouillé reste possible, mais
// l'upload/approbation est bloqué tant que la brochure n'est pas déverrouillée (garde-fou).
const IS_ADMIN = true;

// ── Dialogue Édition / Clone d'une variante de brochure ──────────────────────────────────
function VariantDialog({ id, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const key = ['variant', id];
  const { data: v } = useQuery({ queryKey: key, queryFn: () => api.get(`/brochure/variants/${id}`) });
  const [form, setForm] = useState(null);
  React.useEffect(() => { if (v && !form) setForm({ name: v.name, property_name: v.property_name || '', lang: v.lang, types: (v.property_types || []).join(', ') }); }, [v]); // eslint-disable-line
  const inv = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['library'] }); };
  const run = async (fn, okKey) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(okKey ? t(okKey) : null); inv(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  if (!v || !form) return <Modal title="…" onClose={onClose} size="lg"><div className="muted">…</div></Modal>;
  const locked = v.locked;
  const saveMeta = (patch) => run(() => api.put(`/brochure/variants/${id}`, patch));
  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    await run(async () => { const fd = new FormData(); fd.append('file', f); await api.upload(`/brochure/variants/${id}/sync`, fd); setMsg(t('bl.draftReady')); });
  };
  const approve = () => { if (window.confirm(t('bl.confirmApprove'))) run(() => api.post(`/brochure/variants/${id}/approve`), 'bl.approved'); };

  return (
    <Modal title={v.is_base ? `${v.name} (${t('bl.original')})` : v.name} onClose={onClose} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label={t('bl.name')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => form.name !== v.name && saveMeta({ name: form.name })} />
          </Field>
          <Field label={t('bl.types')}>
            <Input value={form.types} onChange={(e) => setForm({ ...form, types: e.target.value })}
              onBlur={() => saveMeta({ property_types: form.types.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label={t('bl.propertyName')}>
            <Input value={form.property_name} placeholder={t('bl.propertyNamePh')} onChange={(e) => setForm({ ...form, property_name: e.target.value })}
              onBlur={() => form.property_name !== (v.property_name || '') && saveMeta({ property_name: form.property_name || null })} />
          </Field>
          <Field label={t('bl.lang')}>
            <Select value={form.lang} onChange={(e) => { setForm({ ...form, lang: e.target.value }); saveMeta({ lang: e.target.value }); }}>
              <option value="fr">FR</option><option value="en">EN</option><option value="bi">FR/EN</option>
            </Select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" icon={locked ? Lock : Unlock} onClick={() => saveMeta({ locked: !locked })} disabled={busy}>
            {locked ? t('bl.locked') : t('bl.unlocked')}
          </Button>
          <Button variant="outline" size="sm" icon={Eye} onClick={() => window.open(api.url(`/brochure/variants/${id}/sample.pdf`), '_blank')}>{t('bl.viewPdf')}</Button>
          <a className="file-chip" href={api.url(`/brochure/variants/${id}/sample.pptx`)}><Download size={14} /> {t('bl.downloadPptx')}</a>
        </div>

        {locked && <div className="notice notice-info" style={{ margin: 0 }}><Lock size={15} /> <span>{t('bl.lockedNotice')}</span></div>}

        <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy || locked}>
            {busy ? t('bl.uploading') : t('bl.uploadPptx')}
          </Button>
          <input ref={fileRef} type="file" accept=".pptx" hidden onChange={onFile} />
          {v.hasDraft && <Badge tone="warning">{t('bl.draftPending')}</Badge>}
        </div>

        {v.hasDraft && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 12, borderRadius: 8, background: 'var(--color-bg-secondary)' }}>
            <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(api.url(`/brochure/variants/${id}/sample.pdf?draft=1`), '_blank')}>{t('bl.reviewDraft')}</Button>
            <Button size="sm" icon={Check} onClick={approve} disabled={busy || locked}>{t('bl.approveDraft')}</Button>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => run(() => api.del(`/brochure/variants/${id}/draft`))} disabled={busy}>{t('bl.discardDraft')}</Button>
          </div>
        )}
        {msg && <div className="muted" style={{ fontSize: 12 }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" icon={ArrowLeft} onClick={onClose}>{t('bl.back')}</Button>
      </div>
    </Modal>
  );
}

function BrochuresTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['library'], queryFn: () => api.get('/brochure/library') });
  const variants = data?.variants || [];

  const clone = async (sourceId) => {
    setBusy(true);
    try { const v = await api.post('/brochure/library/clone', { source_id: sourceId }); qc.invalidateQueries({ queryKey: ['library'] }); setEditId(v.id); }
    finally { setBusy(false); }
  };
  const removeVariant = async (id) => {
    if (!window.confirm(t('bl.confirmDelete'))) return;
    await api.del(`/brochure/variants/${id}`); qc.invalidateQueries({ queryKey: ['library'] });
  };

  if (isLoading) return <Card><div className="muted">…</div></Card>;
  return (
    <>
      <div className="tpl-grid">
        {variants.map((v) => (
          <Card key={v.id}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <LayoutTemplate size={16} />
              <span style={{ flex: 1 }}>{v.name}</span>
              {v.locked && <Lock size={13} style={{ color: 'var(--color-text-tertiary)' }} />}
              {v.is_base && <Badge tone="neutral">{t('bl.original')}</Badge>}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 2px' }}>{v.description}</p>
            <p className="muted" style={{ fontSize: 11, margin: '0 0 12px' }}>{(v.property_types || []).join(' · ')}{v.property_name ? ` — ${v.property_name}` : ''}</p>
            <div className="toolbar" style={{ marginBottom: 0, gap: 8, flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" icon={Eye} onClick={() => window.open(api.url(`/brochure/variants/${v.id}/sample.pdf`), '_blank')}>{t('bl.previewPdf')}</Button>
              {(!v.locked || IS_ADMIN) && <Button variant="primary" size="sm" icon={Pencil} onClick={() => setEditId(v.id)}>{t('bl.edit')}</Button>}
              <Button variant="outline" size="sm" icon={Copy} onClick={() => clone(v.id)} disabled={busy}>{t('bl.clone')}</Button>
              {!v.is_base && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeVariant(v.id)} />}
            </div>
          </Card>
        ))}
      </div>
      {editId && <VariantDialog id={editId} onClose={() => setEditId(null)} />}
    </>
  );
}

export default function BrokerTemplates() {
  const { t } = useI18n();
  const [tab, setTab] = useState('brochures');
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.ba.templates')}</h1>
          <p className="page-subtitle">{t('ba.intro')}</p>
        </div>
      </div>
      <div className="tpl-tabs">
        {TABS.map((k) => (
          <button key={k} className={`tpl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{t(`ba.tpl.${k}`)}</button>
        ))}
      </div>
      {tab === 'brochures' && <BrochuresTab />}
      {tab === 'posts' && <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>}
      {tab === 'presentations' && <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>}
    </div>
  );
}
