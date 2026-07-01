import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, EmptyState } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Types de plan (valeur = clé stockée dans media.role).
export const PLAN_TYPES = [
  { v: 'etage', fr: "Plan d'étage", en: 'Floor plan' },
  { v: 'architecture', fr: "Plans d'architecture", en: 'Architectural plans' },
  { v: 'amenagement', fr: "Plan d'aménagement", en: 'Site/landscape plan' },
  { v: 'localisation', fr: 'Certificat de localisation', en: 'Location certificate' },
  { v: 'implantation', fr: "Plan d'implantation", en: 'Plot plan' },
  { v: 'electrique', fr: 'Plan électrique', en: 'Electrical plan' },
  { v: 'plomberie', fr: 'Plan de plomberie', en: 'Plumbing plan' },
  { v: 'structure', fr: 'Plan de structure', en: 'Structural plan' },
  { v: 'arpentage', fr: "Plan d'arpentage", en: 'Survey plan' },
  { v: 'autre', fr: 'Autre', en: 'Other' },
];

export default function PlansTab({ propertyId }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const { data: plans = [], isLoading } = useQuery({ queryKey: ['plans', propertyId], queryFn: () => api.get(`/properties/${propertyId}/plans`) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['plans', propertyId] });
  const setType = useMutation({ mutationFn: ({ id, role }) => api.patch(`/properties/${propertyId}/plans/${id}`, { role }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id) => api.del(`/properties/${propertyId}/plans/${id}`), onSuccess: invalidate });

  const onUpload = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      await api.upload(`/properties/${propertyId}/plans`, fd);
      invalidate();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t('pe.plansHint')}</div>
      <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? t('d.ph.uploading') : t('pe.plansAdd')}</Button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={onUpload} />
      {err && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{err}</div>}
      {isLoading ? (
        <div className="muted" style={{ marginTop: 16 }}>…</div>
      ) : plans.length === 0 ? (
        <div style={{ marginTop: 16 }}><EmptyState icon={FileText} title={t('pe.plansEmpty')} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          {plans.map((m) => {
            const isPdf = (m.mime || '').includes('pdf');
            return (
              <div key={m.id} className="card" style={{ padding: 8, border: '1px solid var(--color-border)' }}>
                {isPdf ? (
                  <a href={api.url(m.url)} target="_blank" rel="noreferrer" style={{ display: 'grid', placeItems: 'center', width: '100%', height: 120, borderRadius: 4, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                    <FileText size={32} /><span style={{ fontSize: 11, marginTop: 4 }}>PDF</span>
                  </a>
                ) : (
                  <a href={api.url(m.url)} target="_blank" rel="noreferrer">
                    <img src={api.url(m.url)} alt={m.filename || ''} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, background: 'var(--color-bg-secondary)' }} />
                  </a>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <select value={m.role} onChange={(e) => setType.mutate({ id: m.id, role: e.target.value })}
                    style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}>
                    {PLAN_TYPES.map((p) => <option key={p.v} value={p.v}>{lang === 'en' ? p.en : p.fr}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove.mutate(m.id)} />
                </div>
                {m.filename && <div className="muted" style={{ fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename}</div>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
