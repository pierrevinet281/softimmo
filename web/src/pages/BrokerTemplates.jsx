import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Eye, LayoutTemplate, Upload, Check, Trash2, ArrowLeft, Pencil, Lock, Unlock, Copy, RotateCcw } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge, EmptyState, Modal } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Gabarits de brochure existants (moteurs render_brochure / render_rpa_brochure).
// `mode` : 'content' (RPA — texte éditorial) ou 'layout' (brochures standard — positions).
const BROCHURE_TEMPLATES = [
  { key: 'unifamilial', label: 'Unifamiliale', mode: 'layout' },
  { key: 'luxe', label: 'Luxury', mode: 'layout' },
  { key: 'rpa', label: 'RPA · Location', note: 'Format éditorial 6 pages', mode: 'content' },
  { key: 'commercial', label: 'Commercial', mode: 'layout' },
  { key: 'industriel', label: 'Industriel', mode: 'layout' },
];

const TABS = ['brochures', 'posts', 'presentations'];

// Endpoints du cycle d'édition selon le mode (contenu RPA vs layout standard).
// `lock`/`copies` ne sont présents que pour les gabarits pilotés par document (RPA).
function tplEndpoints(tpl) {
  if (tpl.mode === 'content') {
    const b = `/brochure/templates/${tpl.key}/content`;
    const r = `/brochure/templates/${tpl.key}`;
    return { status: b, sync: `${b}/sync`, approve: `${b}/approve`, discard: `${b}/draft`, reset: b,
      draftPdf: api.url(`/brochure/templates/${tpl.key}/sample.pdf?draft=1`),
      lock: `${r}/lock`, copies: `${r}/copies` };
  }
  const b = `/brochure/templates/${tpl.key}/layout`;
  return { status: b, sync: b, approve: `${b}/approve`, discard: `${b}/draft`, reset: b,
    draftPdf: api.url(`/brochure/templates/${tpl.key}/sample.pdf?draft=1`) };
}

// Fenêtre d'édition d'un gabarit : télécharger PPTX → éditer dans PowerPoint → téléverser
// (= brouillon) → aperçu PDF → approuver (remplace le gabarit) ou rejeter ; réinitialiser au défaut.
function TemplateEditModal({ tpl, onClose }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ep = tplEndpoints(tpl);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const queryKey = ['tpl-edit', tpl.key];
  const { data } = useQuery({ queryKey, queryFn: () => api.get(ep.status) });
  const inv = () => qc.invalidateQueries({ queryKey });
  const run = async (fn, okKey) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(okKey ? t(okKey) : null); inv(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    await run(async () => {
      const fd = new FormData(); fd.append('file', f);
      await api.upload(ep.sync, fd);
      setMsg(t('d.bro.draft.ready'));
    });
  };
  const approve = () => { if (window.confirm(t('ba.tpl.confirmApprove'))) run(() => api.post(ep.approve), 'd.bro.draft.approved'); };
  const reset = () => { if (window.confirm(t('ba.tpl.confirmReset'))) run(() => api.del(ep.reset)); };

  // Verrou + copies (Clone/Restore) — uniquement pour les gabarits pilotés par document (RPA).
  const locked = !!data?.locked;
  const canClone = !!ep.copies;
  const [sel, setSel] = useState({});
  const copiesQ = useQuery({ queryKey: ['tpl-copies', tpl.key], queryFn: () => api.get(ep.copies), enabled: canClone });
  const copies = copiesQ.data || [];
  const invC = () => qc.invalidateQueries({ queryKey: ['tpl-copies', tpl.key] });
  const toggleLock = () => run(() => api.post(ep.lock, { locked: !locked }));
  const clone = () => run(async () => { await api.post(ep.copies); invC(); setMsg(t('ba.tpl.cloned')); });
  const restore = (id) => { if (window.confirm(t('ba.tpl.confirmRestore'))) run(async () => { await api.post(`${ep.copies}/${id}/restore`); invC(); setMsg(t('ba.tpl.restored')); }); };
  const delCopy = (id) => run(async () => { await api.del(`${ep.copies}/${id}`); invC(); setSel((s) => { const n = { ...s }; delete n[id]; return n; }); });
  const selIds = Object.keys(sel).filter((k) => sel[k]);
  const delSelected = () => { if (!selIds.length) return; if (window.confirm(t('ba.tpl.confirmDelSel'))) run(async () => { for (const id of selIds) await api.del(`${ep.copies}/${id}`); invC(); setSel({}); }); };

  return (
    <Modal title={tpl.label} onClose={onClose} size="lg">
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {t(tpl.mode === 'content' ? 'ba.tpl.editHintContent' : 'ba.tpl.editHintLayout')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a className="file-chip" href={api.url(`/brochure/templates/${tpl.key}/sample.pptx`)}>
          <Download size={14} /> {t('ba.tpl.downloadPptx')}
        </a>
        <Button variant="outline" size="sm" icon={Eye}
          onClick={() => window.open(api.url(`/brochure/templates/${tpl.key}/sample.pdf`), '_blank')}>
          {t('ba.tpl.previewPdf')}
        </Button>
        {canClone && (
          <>
            <Button variant="outline" size="sm" icon={locked ? Unlock : Lock} onClick={toggleLock} disabled={busy}>
              {t(locked ? 'ba.tpl.unlock' : 'ba.tpl.lock')}
            </Button>
            <Button variant="outline" size="sm" icon={Copy} onClick={clone} disabled={busy}>{t('ba.tpl.clone')}</Button>
          </>
        )}
      </div>

      {locked && (
        <div className="notice notice-info" style={{ marginTop: 12, marginBottom: 0 }}>
          <Lock size={15} /> <span>{t('ba.tpl.lockedNotice')}</span>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy || locked}>
          {busy ? t('d.bro.tpl.uploading') : t('ba.tpl.upload')}
        </Button>
        <input ref={fileRef} type="file" accept=".pptx" hidden onChange={onFile} />
        {data?.customized && <Badge tone="info">{t('d.bro.tpl.custom')}</Badge>}
        {data?.customized && !locked && <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>{t('d.bro.tpl.reset')}</Button>}
      </div>

      {data?.hasDraft && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--color-bg-secondary)' }}>
          <Badge tone="warning">{t('d.bro.draft.badge')}</Badge>
          <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(ep.draftPdf, '_blank')}>{t('d.bro.draft.preview')}</Button>
          <Button size="sm" icon={Check} onClick={approve} disabled={busy || locked}>{t('d.bro.draft.approve')}</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => run(() => api.del(ep.discard))} disabled={busy}>{t('d.bro.draft.discard')}</Button>
        </div>
      )}
      {msg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{msg}</div>}

      {canClone && copies.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{t('ba.tpl.copies')}</strong>
            {selIds.length > 0 && <Button size="sm" variant="ghost" icon={Trash2} onClick={delSelected} disabled={busy}>{t('ba.tpl.deleteSel')} ({selIds.length})</Button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {copies.map((cp) => (
              <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <input type="checkbox" checked={!!sel[cp.id]} onChange={(e) => setSel((s) => ({ ...s, [cp.id]: e.target.checked }))} />
                <Lock size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ flex: 1, fontSize: 13 }}>{cp.name}</span>
                <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => restore(cp.id)} disabled={busy}>{t('ba.tpl.restore')}</Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => delCopy(cp.id)} disabled={busy} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" icon={ArrowLeft} onClick={onClose}>{t('ba.tpl.back')}</Button>
      </div>
    </Modal>
  );
}

function BrochuresTab() {
  const { t } = useI18n();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <div className="tpl-grid">
        {BROCHURE_TEMPLATES.map((tpl) => (
          <Card key={tpl.key}>
            <button
              type="button"
              onClick={() => setEditing(tpl)}
              title={t('ba.tpl.edit')}
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}
            >
              <LayoutTemplate size={16} /> <span className="card-title" style={{ margin: 0 }}>{tpl.label}</span>
            </button>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 12px' }}>{tpl.note || tpl.key}</p>
            <div className="toolbar" style={{ marginBottom: 0, gap: 8 }}>
              <Button variant="primary" size="sm" icon={Pencil} onClick={() => setEditing(tpl)}>
                {t('ba.tpl.edit')}
              </Button>
              <Button variant="outline" size="sm" icon={Eye}
                onClick={() => window.open(api.url(`/brochure/templates/${tpl.key}/sample.pdf`), '_blank')}>
                {t('ba.tpl.previewPdf')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {editing && <TemplateEditModal tpl={editing} onClose={() => setEditing(null)} />}
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
          <button key={k} className={`tpl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {t(`ba.tpl.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'brochures' && <BrochuresTab />}
      {tab === 'posts' && (
        <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>
      )}
      {tab === 'presentations' && (
        <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>
      )}
    </div>
  );
}
