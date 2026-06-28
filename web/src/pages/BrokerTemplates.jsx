import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Eye, LayoutTemplate, Upload, Check, Trash2, ArrowLeft, Pencil } from 'lucide-react';
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
function tplEndpoints(tpl) {
  if (tpl.mode === 'content') {
    const b = `/brochure/templates/${tpl.key}/content`;
    return { status: b, sync: `${b}/sync`, approve: `${b}/approve`, discard: `${b}/draft`, reset: b,
      draftPdf: api.url(`/brochure/templates/${tpl.key}/sample.pdf?draft=1`) };
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
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? t('d.bro.tpl.uploading') : t('ba.tpl.upload')}
        </Button>
        <input ref={fileRef} type="file" accept=".pptx" hidden onChange={onFile} />
        {data?.customized && <Badge tone="info">{t('d.bro.tpl.custom')}</Badge>}
        {data?.customized && <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>{t('d.bro.tpl.reset')}</Button>}
      </div>

      {data?.hasDraft && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--color-bg-secondary)' }}>
          <Badge tone="warning">{t('d.bro.draft.badge')}</Badge>
          <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(ep.draftPdf, '_blank')}>{t('d.bro.draft.preview')}</Button>
          <Button size="sm" icon={Check} onClick={approve} disabled={busy}>{t('d.bro.draft.approve')}</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => run(() => api.del(ep.discard))} disabled={busy}>{t('d.bro.draft.discard')}</Button>
        </div>
      )}
      {msg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{msg}</div>}

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
