import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Save, Plus, Trash2, UserCircle, Quote, Info } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Field, Input, Select, Textarea, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const BROKER_FIELDS = [
  ['name', 'off.b.name'], ['title', 'off.b.title'], ['subtitle', 'off.b.subtitle'],
  ['agency', 'off.b.agency'], ['company', 'off.b.company'], ['phone', 'off.b.phone'],
  ['email', 'off.b.email'], ['web', 'off.b.web'],
];

export default function Offres() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: config } = useQuery({ queryKey: ['offre-config'], queryFn: () => api.get('/offre/config') });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties') });

  const [variant, setVariant] = useState('vendeur');
  const [lang, setLang] = useState('fr');
  const [clientId, setClientId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10));

  const generate = () => {
    const qs = new URLSearchParams({ variant, lang });
    if (clientId) qs.set('client_id', clientId);
    if (propertyId) qs.set('property_id', propertyId);
    if (dateIso) qs.set('date_iso', dateIso);
    window.open(api.url(`/offre.pdf?${qs.toString()}`), '_blank');
  };

  // ── Profil du courtier (partagé avec brochures + marketing) ──
  const [broker, setBroker] = useState({});
  useEffect(() => { if (config?.broker) setBroker(config.broker); }, [config?.broker]);
  const saveBroker = useMutation({
    mutationFn: () => api.put('/offre/config', { broker }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offre-config'] }),
  });

  // ── Témoignages (par variante, appliqués FR + EN — citation reproduite telle quelle) ──
  const savedTestimonials = useMemo(() => {
    const items = config?.content?.fr?.[variant]?.testimonials?.items;
    return Array.isArray(items) ? items : [];
  }, [config, variant]);
  const [testimonials, setTestimonials] = useState([]);
  useEffect(() => { setTestimonials(savedTestimonials); }, [savedTestimonials]);

  const saveTestimonials = useMutation({
    mutationFn: () => {
      const items = testimonials.filter((x) => (x.quote || '').trim());
      const content = JSON.parse(JSON.stringify(config?.content || {}));
      for (const l of ['fr', 'en']) {
        content[l] = content[l] || {};
        content[l][variant] = content[l][variant] || {};
        content[l][variant].testimonials = { items };
      }
      return api.put('/offre/config', { content });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offre-config'] }),
  });

  const clientOpts = clients?.items || clients || [];
  const propOpts = properties?.items || properties || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.offers')}</h1>
          <p className="page-subtitle">{t('off.intro')}</p>
        </div>
      </div>

      <div className="col gap-4">
        {/* Générateur */}
        <Card>
          <div className="card-title"><FileText size={16} style={{ verticalAlign: '-3px' }} /> {t('off.generator')}</div>
          <div className="grid grid-3">
            <Field label={t('off.variant')}>
              <Select value={variant} onChange={(e) => setVariant(e.target.value)}>
                <option value="vendeur">{t('off.vendeur')}</option>
                <option value="acheteur">{t('off.acheteur')}</option>
              </Select>
            </Field>
            <Field label={t('off.lang')}>
              <Select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="fr">{t('off.lang.fr')}</option>
                <option value="en">{t('off.lang.en')}</option>
                <option value="bi">{t('off.lang.bi')}</option>
              </Select>
            </Field>
            <Field label={t('off.date')}>
              <Input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
            </Field>
            <Field label={t('off.client')}>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">{t('off.none')}</option>
                {clientOpts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
            </Field>
            <Field label={t('off.property')}>
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">{t('off.none')}</option>
                {propOpts.map((p) => <option key={p.id} value={p.id}>{p.name || p.address || p.id}</option>)}
              </Select>
            </Field>
          </div>
          <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
            <Button variant="primary" icon={Download} onClick={generate}>{t('off.generate')}</Button>
          </div>
          <div className="notice notice-info" style={{ marginTop: 14, marginBottom: 0 }}>
            <Info size={15} /> <span>{t('off.compliance')}</span>
          </div>
        </Card>

        {/* Profil du courtier */}
        <Card>
          <div className="card-title"><UserCircle size={16} style={{ verticalAlign: '-3px' }} /> {t('off.brokerProfile')}</div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>{t('off.brokerNote')}</p>
          <div className="grid grid-2">
            {BROKER_FIELDS.map(([key, lk]) => (
              <Field key={key} label={t(lk)}>
                <Input value={broker[key] || ''} onChange={(e) => setBroker({ ...broker, [key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
            <span className="spacer" />
            <Button variant="primary" icon={Save} onClick={() => saveBroker.mutate()} disabled={saveBroker.isPending}>
              {saveBroker.isPending ? t('off.saving') : t('off.save')}
            </Button>
          </div>
        </Card>

        {/* Témoignages */}
        <Card>
          <div className="card-title">
            <Quote size={16} style={{ verticalAlign: '-3px' }} /> {t('off.testimonials')} — {t(`off.${variant}`)}
          </div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>{t('off.testimonialsNote')}</p>
          {testimonials.length === 0 && (
            <EmptyState icon={Quote} title={t('off.noTestimonials')} hint={t('off.testimonialsHint')} />
          )}
          {testimonials.map((tt, i) => (
            <div className="row gap-3" key={i} style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: 2 }}>
                <Field label={t('off.quote')}>
                  <Textarea rows={2} value={tt.quote || ''}
                    onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)))} />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label={t('off.author')}>
                  <Input value={tt.author || ''}
                    onChange={(e) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)))} />
                </Field>
              </div>
              <Button variant="ghost" icon={Trash2} onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))} />
            </div>
          ))}
          <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
            <Button variant="outline" icon={Plus} onClick={() => setTestimonials([...testimonials, { quote: '', author: '' }])}>
              {t('off.addTestimonial')}
            </Button>
            <span className="spacer" />
            <Button variant="primary" icon={Save} onClick={() => saveTestimonials.mutate()} disabled={saveTestimonials.isPending}>
              {saveTestimonials.isPending ? t('off.saving') : t('off.save')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
