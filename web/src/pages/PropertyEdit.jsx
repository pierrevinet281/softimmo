import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, ArrowLeft } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, FormField, Select } from '../components/ui.jsx';
import ClientModal from '../components/ClientModal.jsx';
import { useI18n } from '../i18n/index.jsx';

const BASE_EMPTY = {
  client_id: '', name: '', genre: '', address: '', city: '', region: '', province: 'QC', postal_code: '', country: 'Canada',
};
// Attributs déjà couverts par les champs fixes en haut → exclus du formulaire dynamique.
const CORE_ATTR_KEYS = new Set(['address', 'sector']);

export default function PropertyEdit() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const lab = (o) => (lang === 'en' ? o.label_en : o.label_fr) || o.label_fr;

  const [base, setBase] = useState(BASE_EMPTY);
  const [attrs, setAttrs] = useState({});
  const [pendingType, setPendingType] = useState(null); // type en attente de confirmation
  const [newClient, setNewClient] = useState(false);

  // Instantané « sauvegardé » (réfs lues en synchrone par les garde-fous).
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

  const { data: existing } = useQuery({ queryKey: ['property', id], queryFn: () => api.get(`/properties/${id}`), enabled: isEdit });
  useEffect(() => {
    if (!existing) return;
    const b = {
      client_id: existing.client_id || '', name: existing.name || '', genre: existing.genre || '',
      address: existing.address || '', city: existing.city || '', region: existing.region || '',
      province: existing.province || 'QC', postal_code: existing.postal_code || '', country: existing.country || 'Canada',
    };
    const a = existing.attributes || {};
    setBase(b); setAttrs(a);
    snapBaseRef.current = JSON.stringify(b); snapAttrsRef.current = JSON.stringify(a);
  }, [existing]);

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
    onDone?.(row);
  };

  const onTypeSelect = (g) => {
    if (g === base.genre) return;
    if (base.genre && attrsTouched()) { setPendingType(g); return; }
    setBase((b) => ({ ...b, genre: g })); setAttrs({});
  };
  const applyType = (g) => { setBase((b) => ({ ...b, genre: g })); setAttrs({}); setPendingType(null); };

  // Garde-fou : navigation interne (data router) + fermeture/rafraîchissement de l'onglet.
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{isEdit ? t('pe.titleEdit') : t('pe.title')}</h1>
          <div className="page-subtitle">{t('pe.subtitle')}</div>
        </div>
        <div className="spacer" />
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/properties')}>{t('pe.back')}</Button>
        <Button variant="primary" icon={Save} disabled={save.isPending || !base.name}
          onClick={() => persist(() => navigate('/properties'))}>{t('common.save')}</Button>
      </div>

      <Card>
        <div className="section-label">{t('pe.identity')}</div>
        <div className="field-row">
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
          <FormField label={t('pe.name')} value={base.name} onChange={(e) => setBaseField('name', e.target.value)} placeholder={t('pe.namePh')} />
          <FormField label={t('pe.address')} value={base.address} onChange={(e) => setBaseField('address', e.target.value)} />
          <FormField label={t('pe.city')} value={base.city} onChange={(e) => setBaseField('city', e.target.value)} />
          <FormField label={t('pe.region')} value={base.region} onChange={(e) => setBaseField('region', e.target.value)} />
          <FormField label={t('pe.state')} value={base.province} onChange={(e) => setBaseField('province', e.target.value)} />
          <FormField label={t('pe.postal')} value={base.postal_code} onChange={(e) => setBaseField('postal_code', e.target.value)} />
          <FormField label={t('pe.country')} value={base.country} onChange={(e) => setBaseField('country', e.target.value)} />
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
                  <div key={a.key} className="field" style={{ margin: 0 }}>
                    <label>{lab(a)}{a.unit ? ` (${a.unit})` : ''}</label>
                    {a.input === 'bool' ? (
                      <Select value={attrs[a.key] ?? ''} onChange={(e) => setAttr(a.key, e.target.value)}>
                        <option value="">—</option>
                        <option value="Oui">{t('sa.yes')}</option>
                        <option value="Non">{t('sa.no')}</option>
                      </Select>
                    ) : (
                      <input
                        className="input"
                        type={['number', 'currency', 'percent'].includes(a.input) ? 'number' : 'text'}
                        value={attrs[a.key] ?? ''}
                        onChange={(e) => setAttr(a.key, e.target.value)}
                        placeholder={a.input === 'currency' ? '$' : (a.unit || '')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

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
