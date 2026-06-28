import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import api from '../api/client.js';
import { Modal, Button, FormField, Select, Textarea } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Types de client (mandants). landlord = locateur, tenant = locataire (ajoutés aux vendeur/acheteur).
export const CLIENT_KINDS = ['seller', 'buyer', 'both', 'landlord', 'tenant'];
export const KIND_TONE = { seller: 'info', buyer: 'success', both: 'accent', landlord: 'warning', tenant: 'neutral' };

const EMPTY = { full_name: '', kind: 'seller', org_name: '', email: '', phone: '', notes: '', consent_given: 0, consent_scope: '', consent_at: null };

// Dialogue de création/édition d'un client, réutilisable (page Clients + création « on the fly »).
// onSaved(savedRow) reçoit le client créé/modifié (permet à l'appelant de le sélectionner).
export default function ClientModal({ row, onClose, onSaved }) {
  const { t } = useI18n();
  const isEdit = !!row;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(row || {}) }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.patch(`/clients/${row.id}`, body) : api.post('/clients', body)),
    onSuccess: (saved) => { onSaved?.(saved); onClose(); },
  });

  const submit = () => {
    const given = form.consent_given ? 1 : 0;
    // Loi 25 : horodatage du consentement à l'octroi ; effacé si retiré.
    const consent_at = given ? (form.consent_at || new Date().toISOString()) : null;
    save.mutate({ ...form, consent_given: given, consent_at });
  };

  return (
    <Modal
      title={isEdit ? t('cli.edit') : t('cli.new')}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={save.isPending || !form.full_name} onClick={submit}>{isEdit ? t('common.save') : t('common.create')}</Button>
        </>
      )}
    >
      <div className="field-row">
        <FormField label={`${t('cli.fullName')} *`} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
        <div className="field">
          <label>{t('cli.kind')}</label>
          <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {CLIENT_KINDS.map((k) => <option key={k} value={k}>{t(`cli.kind.${k}`)}</option>)}
          </Select>
        </div>
        <FormField label={t('cli.org')} value={form.org_name} onChange={(e) => set('org_name', e.target.value)} />
        <FormField label="Courriel" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <FormField label={t('cli.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>

      <div className="section-label">{t('cli.consent')}</div>
      <div className="notice notice-muted" style={{ fontSize: 12 }}><ShieldCheck size={16} />{t('cli.consentNote')}</div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '6px 0 10px' }}>
        <input type="checkbox" className="checkbox" checked={!!Number(form.consent_given)} onChange={(e) => set('consent_given', e.target.checked ? 1 : 0)} />
        {t('cli.consentGiven')}
      </label>
      {!!Number(form.consent_given) && (
        <>
          <FormField label={t('cli.consentScope')} value={form.consent_scope} onChange={(e) => set('consent_scope', e.target.value)} placeholder={t('cli.consentScopePh')} />
          {form.consent_at && <div className="muted" style={{ fontSize: 12, marginTop: -6 }}>{t('cli.consentSince')} {new Date(form.consent_at).toLocaleString('fr-CA')}</div>}
        </>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label>{t('common.notes')}</label>
        <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}
