import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, FileText, Info, MonitorPlay, RefreshCw, Eye, Check, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Field, Input, Select } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import OffreContentCustomizer from './OffreContentCustomizer.jsx';

const CLIENT_TYPES = ['residentiel', 'commercial', 'industriel', 'entreprise', 'autre'];
const OPPORTUNITIES = ['vendeur', 'acheteur', 'locateur', 'locataire'];
const variantOf = (op) => (['vendeur', 'locateur'].includes(op) ? 'vendeur' : 'acheteur');

export default function OffreEdit() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const syncRef = useRef(null);

  const { data: clients } = useQuery({ queryKey: ['clients', 'all'], queryFn: () => api.get('/clients?limit=500&sort=full_name&dir=asc') });
  const { data: properties } = useQuery({ queryKey: ['properties', 'all'], queryFn: () => api.get('/properties?limit=500&sort=updated_at&dir=desc') });
  const { data: offer } = useQuery({ queryKey: ['offre', id], queryFn: () => api.get(`/offres/${id}`), enabled: !!id });

  const [f, setF] = useState({
    name: '', client_type: 'residentiel', opportunity: 'vendeur', lang: 'fr',
    client_id: '', property_id: '', date_iso: new Date().toISOString().slice(0, 10), is_template: false,
  });
  const [saving, setSaving] = useState('');
  const [custom, setCustom] = useState({});   // personnalisation par langue : { fr|en: diff }
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const dlang = f.lang === 'en' ? 'en' : 'fr';

  useEffect(() => {
    if (offer) {
      setF({
        name: offer.name || offer.offer_name || '', client_type: offer.client_type || 'residentiel',
        opportunity: offer.opportunity || offer.variant || 'vendeur', lang: offer.lang || 'fr',
        client_id: offer.client_id || '', property_id: offer.property_id || '',
        date_iso: offer.date_iso || new Date().toISOString().slice(0, 10), is_template: !!offer.is_template,
      });
      setCustom(offer.customization || {});
    }
  }, [offer]);

  const clientOpts = clients?.rows || [];
  const propOpts = properties?.rows || [];

  const payload = () => ({ ...f, variant: variantOf(f.opportunity), customization: custom });

  const persist = async () => {
    const body = payload();
    if (id) { await api.put(`/offres/${id}`, body); return id; }
    const created = await api.post('/offres', body);
    return created.id;
  };

  const doSave = async (then) => {
    if (!f.name.trim()) return;
    setSaving(then || 'save');
    try {
      const newId = await persist();
      if (then === 'pdf' && newId) window.open(api.url(`/offres/${newId}/pdf`), '_blank');
      if (then === 'pptx' && newId) window.open(api.url(`/offres/${newId}/pptx`), '_blank');
      qc.invalidateQueries({ queryKey: ['offres'] });
      if (!id && newId) navigate(`/offres/edit/${newId}`, { replace: true });
    } finally { setSaving(''); }
  };

  const syncPptx = async (file) => {
    if (!file || !id) return;
    setSaving('sync');
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.upload(`/offres/${id}/pptx/sync`, fd);
      qc.invalidateQueries({ queryKey: ['offre', id] });
      qc.invalidateQueries({ queryKey: ['offres'] });
    } finally { setSaving(''); if (syncRef.current) syncRef.current.value = ''; }
  };
  // Garde-fou brouillon : approuver / rejeter le PPTX ré-ingéré, ou réinitialiser au défaut.
  const draftAction = async (key, fn) => {
    if (!id) return;
    setSaving(key);
    try { await fn(); qc.invalidateQueries({ queryKey: ['offre', id] }); qc.invalidateQueries({ queryKey: ['offres'] }); }
    finally { setSaving(''); }
  };

  const Buttons = () => (
    <div className="toolbar" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
      <Button variant="primary" icon={Save} onClick={() => doSave('save')} disabled={!f.name.trim() || !!saving}>
        {saving === 'save' ? t('off2.saving') : t('off2.save')}
      </Button>
      <Button variant="primary" icon={Download} onClick={() => doSave('pdf')} disabled={!f.name.trim() || !!saving}>
        {t('off2.saveGen')}
      </Button>
      <Button variant="outline" icon={MonitorPlay} onClick={() => doSave('pptx')} disabled={!f.name.trim() || !!saving}>
        {t('off2.savePptx')}
      </Button>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/offres')}>{t('off2.back')}</Button>
          <h1 style={{ marginTop: 6 }}>{id ? t('off2.edit') : t('off2.new')}</h1>
        </div>
      </div>

      <Card>
        <div className="card-title"><FileText size={16} style={{ verticalAlign: '-3px' }} /> {t('off2.offerInfo')}</div>
        <div className="grid grid-2">
          <Field label={t('off2.offerName')}>
            <Input value={f.name} placeholder={t('off2.offerNamePh')} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={t('off2.clientType')}>
            <Select value={f.client_type} onChange={(e) => set('client_type', e.target.value)}>
              {CLIENT_TYPES.map((c) => <option key={c} value={c}>{t(`off2.ct.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('off2.opportunity')}>
            <Select value={f.opportunity} onChange={(e) => set('opportunity', e.target.value)}>
              {OPPORTUNITIES.map((o) => <option key={o} value={o}>{t(`off2.op.${o}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('off.lang')}>
            <Select value={f.lang} onChange={(e) => set('lang', e.target.value)}>
              <option value="fr">{t('off.lang.fr')}</option>
              <option value="en">{t('off.lang.en')}</option>
              <option value="bi">{t('off.lang.bi')}</option>
            </Select>
          </Field>
          <Field label={t('off.client')}>
            <Select value={f.client_id} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">{t('off.none')}</option>
              {clientOpts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </Field>
          <Field label={t('off.property')}>
            <Select value={f.property_id} onChange={(e) => set('property_id', e.target.value)}>
              <option value="">{t('off.none')}</option>
              {propOpts.map((p) => <option key={p.id} value={p.id}>{p.name || p.address || p.id}</option>)}
            </Select>
          </Field>
          <Field label={t('off.date')}>
            <Input type="date" value={f.date_iso} onChange={(e) => set('date_iso', e.target.value)} />
          </Field>
        </div>
        <label className="check-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={f.is_template} onChange={(e) => set('is_template', e.target.checked)} />
          <span>{t('off2.convertTemplate')}</span>
        </label>
        <div style={{ marginTop: 10 }}><Buttons /></div>
        <div className="notice notice-info" style={{ marginTop: 14, marginBottom: 0 }}>
          <Info size={15} /> <span>{t('off.compliance')}</span>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="card-title">{t('off2.content')}</div>
        <OffreContentCustomizer
          opportunity={f.opportunity} lang={f.lang}
          value={custom[dlang]} onChange={(diff) => setCustom((c) => ({ ...c, [dlang]: diff }))} />
      </Card>

      {/* Aller-retour PPTX */}
      <Card style={{ marginTop: 16 }}>
        <div className="card-title"><MonitorPlay size={16} style={{ verticalAlign: '-3px' }} /> {t('off2.pptxTitle')}</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('off2.pptxHint')}</p>
        {!id ? (
          <p className="muted" style={{ fontSize: 13 }}>{t('off2.pptxSaveFirst')}</p>
        ) : (
          <>
            {offer?.pptx_synced_at && (
              <p className="muted" style={{ fontSize: 12 }}>{t('off2.lastSync')} : {String(offer.pptx_synced_at).slice(0, 16).replace('T', ' ')}</p>
            )}
            <input ref={syncRef} type="file" accept=".pptx" hidden onChange={(e) => syncPptx(e.target.files?.[0])} />
            <div className="toolbar" style={{ marginBottom: 0, gap: 8 }}>
              <Button variant="outline" icon={MonitorPlay} onClick={() => doSave('pptx')} disabled={!!saving}>{t('off2.savePptx')}</Button>
              <Button variant="primary" icon={RefreshCw} onClick={() => syncRef.current?.click()} disabled={saving === 'sync'}>
                {saving === 'sync' ? t('off2.syncing') : t('off2.synchronize')}
              </Button>
              {offer?.pptx_content && (
                <Button variant="ghost" onClick={() => draftAction('reset', () => api.del(`/offres/${id}/pptx`))} disabled={!!saving}>
                  {t('off2.pptxReset')}
                </Button>
              )}
            </div>
            {offer?.draft_synced_at && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, padding: 10, borderRadius: 6, background: 'var(--color-bg-secondary)' }}>
                <span className="badge badge-warning">{t('off2.draftBadge')}</span>
                <Button variant="outline" size="sm" icon={Eye} onClick={() => window.open(api.url(`/offres/${id}/pdf?draft=1`), '_blank')} disabled={!!saving}>{t('off2.draftPreview')}</Button>
                <Button variant="primary" size="sm" icon={Check} onClick={() => draftAction('approve', () => api.post(`/offres/${id}/pptx/approve`))} disabled={!!saving}>{t('off2.draftApprove')}</Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => draftAction('discard', () => api.del(`/offres/${id}/pptx/draft`))} disabled={!!saving}>{t('off2.draftDiscard')}</Button>
              </div>
            )}
          </>
        )}
      </Card>

      <div style={{ marginTop: 16 }}><Buttons /></div>
    </div>
  );
}
