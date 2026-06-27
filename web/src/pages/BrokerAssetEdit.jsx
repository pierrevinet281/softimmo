import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, FileText, ExternalLink, Plus } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Select, Textarea, Field } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ASSET_TYPES } from './BrokerAssetsList.jsx';

const EMPTY = { name: '', asset_type: 'logo', category: '', lang: '', text: '', tags: '', notes: '' };

export default function BrokerAssetEdit() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: asset } = useQuery({
    queryKey: ['broker-asset', id],
    queryFn: () => api.get(`/broker-assets/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (asset) {
      setForm({
        name: asset.name || '', asset_type: asset.asset_type || 'autre',
        category: asset.category || '', lang: asset.lang || '',
        text: asset.text || '', tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : '',
        notes: asset.notes || '',
      });
    }
  }, [asset]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Repart sur une page vierge pour saisir un nouvel élément.
  const addNew = () => {
    setForm(EMPTY); setErr('');
    if (id) navigate('/assets-courtier/edit');
  };

  const payload = () => ({
    ...form,
    tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    lang: form.lang || null,
  });

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      if (id) {
        await api.patch(`/broker-assets/${id}`, payload());
        qc.invalidateQueries({ queryKey: ['broker-asset', id] });
        qc.invalidateQueries({ queryKey: ['broker-assets'] });
      } else {
        const created = await api.post('/broker-assets', payload());
        qc.invalidateQueries({ queryKey: ['broker-assets'] });
        navigate(`/assets-courtier/edit/${created.id}`);
      }
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const uploadFile = async (file) => {
    if (!file || !id) return;
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(`/broker-assets/${id}/file`, fd);
      qc.invalidateQueries({ queryKey: ['broker-asset', id] });
      qc.invalidateQueries({ queryKey: ['broker-assets'] });
    } catch (e) { setErr(e.message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = async () => {
    if (!id) return;
    try {
      await api.del(`/broker-assets/${id}/file`);
      qc.invalidateQueries({ queryKey: ['broker-asset', id] });
      qc.invalidateQueries({ queryKey: ['broker-assets'] });
    } catch (e) { setErr(e.message); }
  };

  const isImg = asset?.file_path && (asset.mime || '').startsWith('image/');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/assets-courtier')}>{t('ba.back')}</Button>
          <h1 style={{ marginTop: 6 }}>{id ? t('ba.edit') : t('ba.new')}</h1>
        </div>
      </div>

      {err && <Card className="card-error" style={{ marginBottom: 12 }}>{err}</Card>}

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <div className="grid grid-2">
            <Field label={t('ba.f.name')}>
              <Input value={form.name} onChange={set('name')} placeholder={t('ba.f.name')} />
            </Field>
            <Field label={t('ba.f.type')}>
              <Select value={form.asset_type} onChange={set('asset_type')}>
                {ASSET_TYPES.map((ty) => <option key={ty} value={ty}>{t(`ba.t.${ty}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('ba.f.category')}>
              <Input value={form.category} onChange={set('category')} placeholder="—" />
            </Field>
            <Field label={t('ba.f.lang')}>
              <Select value={form.lang} onChange={set('lang')}>
                <option value="">{t('ba.lang.none')}</option>
                <option value="fr">FR</option>
                <option value="en">EN</option>
                <option value="bi">FR + EN</option>
              </Select>
            </Field>
          </div>
          <Field label={t('ba.f.text')}>
            <Textarea rows={5} value={form.text} onChange={set('text')} />
          </Field>
          <div className="grid grid-2">
            <Field label={t('ba.f.tags')}>
              <Input value={form.tags} onChange={set('tags')} placeholder="eXp, 2026, signature" />
            </Field>
            <Field label={t('ba.f.notes')}>
              <Input value={form.notes} onChange={set('notes')} />
            </Field>
          </div>
          <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
            <Button variant="primary" onClick={save} disabled={saving || !form.name}>
              {saving ? t('ba.saving') : (id ? t('ba.save') : t('ba.create'))}
            </Button>
            {id && <Button variant="outline" icon={Plus} onClick={addNew}>{t('ba.addNew')}</Button>}
          </div>
        </Card>

        <Card>
          <div className="card-title">{t('ba.f.file')}</div>
          {!id ? (
            <p className="muted" style={{ fontSize: 13 }}>{t('ba.fileHint')}</p>
          ) : (
            <>
              <div style={{ margin: '8px 0' }}>
                {isImg ? (
                  <img src={api.url(`/broker-assets/${id}/raw`)} alt=""
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                ) : asset?.file_path ? (
                  <a className="file-chip" href={api.url(`/broker-assets/${id}/raw`)} target="_blank" rel="noreferrer">
                    <FileText size={16} /> {asset.filename || 'fichier'} <ExternalLink size={13} />
                  </a>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>{t('ba.noFile')}</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
                onChange={(e) => uploadFile(e.target.files?.[0])} />
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <Button variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                  {asset?.file_path ? t('ba.replaceFile') : t('ba.upload')}
                </Button>
                {asset?.file_path && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={removeFile}>{t('ba.removeFile')}</Button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
