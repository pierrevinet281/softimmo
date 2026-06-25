import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Sparkles, ShieldCheck, Trash2, Save, ExternalLink, Mail, Phone, Linkedin, Globe } from 'lucide-react';
import api from '../api/client.js';
import { Button, Field, Input, Grade, EmailStatusBadge, StatusBadge, Badge, Progress } from './ui.jsx';
import { useToast } from './Toast.jsx';

const CONTACT_EDIT = [
  'first_name', 'last_name', 'title', 'company_name', 'company_id',
  'email', 'phone', 'extension', 'mobile',
  'linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok', 'whatsapp',
  'reddit', 'wechat', 'telegram', 'threads', 'location',
];
const COMPANY_EDIT = [
  'name', 'domain', 'website', 'industry', 'sic_code', 'naics_code', 'size',
  'address', 'city', 'state', 'postal_code', 'country', 'phone',
  'linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'description',
];

export default function LeadDrawer({ type, id, onClose }) {
  const isCompany = type === 'company';
  const base = isCompany ? '/companies' : '/contacts';
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({});

  const { data: entity } = useQuery({ queryKey: [type, id], queryFn: () => api.get(`${base}/${id}`), enabled: !!id });
  const { data: prov } = useQuery({ queryKey: [type, id, 'prov'], queryFn: () => api.get(`${base}/${id}/provenance`), enabled: !!id });

  useEffect(() => { if (entity) setForm(entity); }, [entity]);

  const save = useMutation({
    mutationFn: (patch) => api.patch(`${base}/${id}`, patch),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: [type, id] }); qc.invalidateQueries({ queryKey: [isCompany ? 'companies' : 'contacts'] }); },
    onError: (e) => toast.error(e.message),
  });
  const enrich = useMutation({
    mutationFn: () => api.post(`${base}/${id}/enrich`, {}),
    onSuccess: () => toast.info('Enrichment started — watch the Activity / job progress'),
    onError: (e) => toast.error(e.message),
  });
  const verify = useMutation({
    mutationFn: () => api.post('/verify', { ids: [id] }),
    onSuccess: () => toast.info('Verification started'),
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => api.del(`${base}/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: [isCompany ? 'companies' : 'contacts'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!entity) return null;
  const fields = isCompany ? COMPANY_EDIT : CONTACT_EDIT;
  const title = isCompany ? entity.name : (entity.full_name || entity.email || 'Contact');
  const changed = JSON.stringify(form) !== JSON.stringify(entity);

  const socialLinks = [
    entity.website && ['Website', entity.website, Globe],
    entity.linkedin && ['LinkedIn', entity.linkedin, Linkedin],
    entity.twitter && ['X', entity.twitter, ExternalLink],
    entity.facebook && ['Facebook', entity.facebook, ExternalLink],
    entity.instagram && ['Instagram', entity.instagram, ExternalLink],
    entity.youtube && ['YouTube', entity.youtube, ExternalLink],
  ].filter(Boolean);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 10 }}>
              <Grade grade={entity.grade} />
              <h2 style={{ fontSize: 20 }}>{title}</h2>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <StatusBadge status={entity.status} />
              {!isCompany && <EmailStatusBadge status={entity.email_status} />}
              <Badge tone="neutral">{Math.round((entity.completeness || 0) * 100)}% complete</Badge>
            </div>
          </div>
          <Button variant="ghost" icon={X} onClick={onClose} />
        </div>

        <div className="drawer-body">
          <div className="row" style={{ gap: 8, marginBottom: 18 }}>
            <Button variant="primary" size="sm" icon={Sparkles} onClick={() => enrich.mutate()} disabled={enrich.isPending}>Enrich</Button>
            {!isCompany && <Button variant="outline" size="sm" icon={ShieldCheck} onClick={() => verify.mutate()} disabled={verify.isPending}>Verify</Button>}
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm('Delete this lead?')) del.mutate(); }} />
          </div>

          {socialLinks.length > 0 && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {socialLinks.map(([label, href, Icon]) => (
                <a key={label} className="btn btn-outline btn-sm" href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer">
                  <Icon size={14} /> {label}
                </a>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 12 }}>Details</h3>
          {fields.map((f) => (
            <Field key={f} label={f.replace('_', ' ')}>
              <Input value={form[f] ?? ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </Field>
          ))}
          <Button variant="primary" icon={Save} disabled={!changed || save.isPending}
            onClick={() => { const patch = {}; fields.forEach((f) => { patch[f] = form[f]; }); save.mutate(patch); }}>
            Save changes
          </Button>

          <div className="divider" />
          <h3 style={{ marginBottom: 12 }}>Provenance & confidence</h3>
          {!prov?.rows?.length && <div className="muted">No enrichment history yet. Run Enrich to populate.</div>}
          {prov?.rows?.map((p) => (
            <div key={p.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: 10 }}>
              <Badge tone="neutral">{p.field}</Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.value}</div>
                <div className="muted" style={{ fontSize: 11 }}>{p.method} · {p.source || '—'} · {p.observed_at}</div>
              </div>
              {p.confidence != null && (
                <div style={{ width: 54 }}>
                  <Progress value={p.confidence} />
                  <div className="muted" style={{ fontSize: 10, textAlign: 'right' }}>{Math.round(p.confidence * 100)}%</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
