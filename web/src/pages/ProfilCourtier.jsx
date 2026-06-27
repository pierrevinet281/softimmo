import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, Trash2, Eye, EyeOff, Plus, X, GripVertical } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Select, Textarea, Field } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const IDENTITY = ['name', 'title', 'subtitle', 'agency', 'company', 'phone', 'email', 'web', 'linkedin', 'linkedin_label'];
// Sections intégrées (ordre canonique) — modifiables/masquables mais NON supprimables.
const CANON = ['why', 'guarantee', 'services', 'marketing', 'opportunities', 'timeline', 'fees', 'value_add', 'testimonials', 'next_steps'];

function normalizeContent(content) {
  for (const lang of Object.keys(content || {})) {
    for (const variant of Object.keys(content[lang] || {})) {
      const cv = content[lang][variant];
      if (!Array.isArray(cv.sections)) cv.sections = CANON.filter((k) => cv[k]).map((k) => ({ key: k, hidden: false }));
    }
  }
  return content;
}

// ── Liste réordonnable par glisser-déposer (drag & drop natif HTML5) ──
function DragList({ value = [], onReorder, renderRow }) {
  const [from, setFrom] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (to) => {
    if (from === null || from === to) { setFrom(null); setOver(null); return; }
    const a = value.slice(); const [m] = a.splice(from, 1); a.splice(to, 0, m);
    onReorder(a); setFrom(null); setOver(null);
  };
  return value.map((item, i) => (
    <div key={i}
      className={`drag-row ${over === i && from !== null && from !== i ? 'drag-over' : ''} ${from === i ? 'dragging' : ''}`}
      onDragOver={(e) => { if (from !== null) { e.preventDefault(); setOver(i); } }}
      onDrop={() => drop(i)}>
      {renderRow(item, i, {
        draggable: true,
        onDragStart: (e) => { setFrom(i); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ } },
        onDragEnd: () => { setFrom(null); setOver(null); },
      })}
    </div>
  ));
}

const Handle = (hp) => <span className="drag-handle" title="Glisser pour réordonner" {...hp}><GripVertical size={14} /></span>;

// ── Éditeurs réutilisables (réordonnables) ──
function ItemsEditor({ value = [], onChange, placeholder }) {
  const { t } = useI18n();
  return (
    <div className="col gap-1">
      <DragList value={value} onReorder={onChange} renderRow={(it, i, hp) => (
        <div className="row gap-1" style={{ alignItems: 'center' }}>
          <Handle {...hp} />
          <Input value={it} placeholder={placeholder} onChange={(e) => { const a = value.slice(); a[i] = e.target.value; onChange(a); }} />
          <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      )} />
      <div><Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...value, ''])}>{t('pc.addItem')}</Button></div>
    </div>
  );
}

function GroupsEditor({ value = [], onChange }) {
  const { t } = useI18n();
  const upd = (i, patch) => { const a = value.slice(); a[i] = { ...a[i], ...patch }; onChange(a); };
  return (
    <div className="col gap-2">
      <DragList value={value} onReorder={onChange} renderRow={(g, i, hp) => (
        <div className="sub-block">
          <div className="row gap-1" style={{ alignItems: 'center' }}>
            <Handle {...hp} />
            <Input value={g.label || ''} placeholder={t('pc.label')} onChange={(e) => upd(i, { label: e.target.value })} />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <ItemsEditor value={g.items || []} onChange={(items) => upd(i, { items })} />
        </div>
      )} />
      <div><Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...value, { label: '', items: [''] }])}>{t('pc.addGroup')}</Button></div>
    </div>
  );
}

function StepsEditor({ value = [], onChange }) {
  const { t } = useI18n();
  const upd = (i, patch) => { const a = value.slice(); a[i] = { ...a[i], ...patch }; onChange(a); };
  return (
    <div className="col gap-2">
      <DragList value={value} onReorder={onChange} renderRow={(s, i, hp) => (
        <div className="sub-block">
          <div className="row gap-1" style={{ alignItems: 'center' }}>
            <Handle {...hp} />
            <Input value={s.label || ''} placeholder={t('pc.label')} onChange={(e) => upd(i, { label: e.target.value })} />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <Textarea rows={2} value={s.text || ''} placeholder={t('pc.text')} onChange={(e) => upd(i, { text: e.target.value })} />
        </div>
      )} />
      <div><Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...value, { label: '', text: '' }])}>{t('pc.addItem')}</Button></div>
    </div>
  );
}

function TestimonialsEditor({ value = [], onChange }) {
  const { t } = useI18n();
  const upd = (i, patch) => { const a = value.slice(); a[i] = { ...a[i], ...patch }; onChange(a); };
  return (
    <div className="col gap-2">
      <DragList value={value} onReorder={onChange} renderRow={(s, i, hp) => (
        <div className="sub-block">
          <div className="row gap-1" style={{ alignItems: 'center' }}>
            <Handle {...hp} />
            <Textarea rows={2} value={s.quote || ''} placeholder={t('pc.quote')} onChange={(e) => upd(i, { quote: e.target.value })} />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <Input value={s.author || ''} placeholder={t('pc.author')} onChange={(e) => upd(i, { author: e.target.value })} />
        </div>
      )} />
      <div><Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...value, { quote: '', author: '' }])}>{t('pc.addItem')}</Button></div>
    </div>
  );
}

function SectionEditor({ keyName, sec, onChange }) {
  const { t } = useI18n();
  const set = (patch) => onChange({ ...sec, ...patch });
  const isTestimonials = keyName === 'testimonials';
  return (
    <div className="col gap-2">
      <Field label={t('pc.heading')}><Input value={sec.heading || ''} onChange={(e) => set({ heading: e.target.value })} /></Field>
      {sec.intro !== undefined && <Field label={t('pc.intro_field')}><Textarea rows={2} value={sec.intro || ''} onChange={(e) => set({ intro: e.target.value })} /></Field>}
      {sec.body !== undefined && <Field label={t('pc.body')}><Textarea rows={3} value={sec.body || ''} onChange={(e) => set({ body: e.target.value })} /></Field>}
      {sec.note !== undefined && <Field label={t('pc.note')}><Input value={sec.note || ''} onChange={(e) => set({ note: e.target.value })} /></Field>}
      {Array.isArray(sec.items) && (isTestimonials
        ? <TestimonialsEditor value={sec.items} onChange={(items) => set({ items })} />
        : <ItemsEditor value={sec.items} onChange={(items) => set({ items })} />)}
      {Array.isArray(sec.groups) && <GroupsEditor value={sec.groups} onChange={(groups) => set({ groups })} />}
      {Array.isArray(sec.subgroups) && <GroupsEditor value={sec.subgroups} onChange={(subgroups) => set({ subgroups })} />}
      {Array.isArray(sec.steps) && <StepsEditor value={sec.steps} onChange={(steps) => set({ steps })} />}
    </div>
  );
}

function ImageSlot({ kind, label, url, onChanged }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const up = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    await api.upload(`/broker/profile/image/${kind}`, fd);
    onChanged();
    if (ref.current) ref.current.value = '';
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="brand-slot">
        {url ? <img src={api.url(url)} alt="" /> : <span className="muted" style={{ fontSize: 12 }}>—</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => up(e.target.files?.[0])} />
      <div className="row gap-1" style={{ marginTop: 6 }}>
        <Button variant="outline" size="sm" icon={Upload} onClick={() => ref.current?.click()}>{url ? t('pc.replace') : t('pc.upload')}</Button>
        {url && <Button variant="ghost" size="sm" icon={Trash2} onClick={async () => { await api.del(`/broker/profile/image/${kind}`); onChanged(); }} />}
      </div>
    </div>
  );
}

export default function ProfilCourtier() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ['offre-config'], queryFn: () => api.get('/offre/config') });

  const [broker, setBroker] = useState(null);
  const [content, setContent] = useState(null);
  const [variant, setVariant] = useState('vendeur');
  const [lang, setLang] = useState('fr');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('text');

  useEffect(() => {
    if (cfg && broker === null) {
      setBroker({ ...(cfg.broker || {}) });
      setContent(normalizeContent(structuredClone(cfg.resolved || {})));
    }
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!broker || !content) return <div className="page"><Card>…</Card></div>;

  const theme = broker.theme || {};
  const setTheme = (patch) => setBroker({ ...broker, theme: { ...theme, ...patch } });
  const cv = content?.[lang]?.[variant] || {};
  const sections = cv.sections || [];

  const mutateCV = (fn) => setContent((prev) => { const n = structuredClone(prev); fn(n[lang][variant]); return n; });
  const setField = (k, val) => mutateCV((v) => { v[k] = val; });
  const editSection = (key, newSec) => mutateCV((v) => { v[key] = newSec; });
  const reorderSections = (arr) => mutateCV((v) => { v.sections = arr; });
  const toggleHide = (key) => mutateCV((v) => { v.sections = v.sections.map((s) => (s.key === key ? { ...s, hidden: !s.hidden } : s)); });
  const deleteCustom = (key) => mutateCV((v) => { v.sections = v.sections.filter((s) => s.key !== key); delete v[key]; });
  const addCustom = () => {
    const name = newName.trim(); if (!name) return;
    const key = `custom_${Date.now()}`;
    const base = newKind === 'groups' ? { heading: name, kind: 'groups', groups: [{ label: '', items: [''] }] }
      : newKind === 'list' ? { heading: name, kind: 'list', items: [''] }
        : { heading: name, kind: 'text', body: '' };
    mutateCV((v) => { v[key] = base; v.sections = [...(v.sections || []), { key, hidden: false, custom: true, kind: newKind }]; });
    setNewName('');
  };

  const secLabel = (s) => (s.custom ? (cv[s.key]?.heading || 'Section') : t(`pc.sec.${s.key}`));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/offre/config', { broker, content });
      qc.invalidateQueries({ queryKey: ['offre-config'] });
      setSavedAt(Date.now());
    } finally { setSaving(false); }
  };
  const refetch = () => qc.invalidateQueries({ queryKey: ['offre-config'] });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.profile')}</h1>
          <p className="page-subtitle">{t('pc.intro')}</p>
        </div>
        <span className="spacer" />
        <Button variant="outline" icon={Eye} onClick={() => window.open(api.url(`/offre.pdf?variant=${variant}&lang=${lang}`), '_blank')}>{t('pc.previewOffre')}</Button>
        <Button variant="primary" icon={Save} onClick={save} disabled={saving}>
          {saving ? t('pc.saving') : (savedAt ? t('pc.saved') : t('pc.save'))}
        </Button>
      </div>

      {/* Identité */}
      <Card>
        <div className="card-title">{t('pc.identity')}</div>
        <div className="grid grid-3">
          {IDENTITY.map((k) => (
            <Field key={k} label={t(`pc.f.${k}`)}>
              <Input value={broker[k] || ''} onChange={(e) => setBroker({ ...broker, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Card>

      {/* Image de marque */}
      <Card style={{ marginTop: 16 }}>
        <div className="card-title">{t('pc.branding')}</div>
        <div className="grid grid-3">
          <ImageSlot kind="logo" label={t('pc.logo')} url={cfg?.images?.logo} onChanged={refetch} />
          <ImageSlot kind="banner" label={t('pc.banner')} url={cfg?.images?.banner} onChanged={refetch} />
          <ImageSlot kind="photo" label={t('pc.photo')} url={cfg?.images?.photo} onChanged={refetch} />
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>{t('pc.bannerHint')}</p>
        <div className="grid grid-2">
          <Field label={t('pc.bandColor')}>
            <div className="row gap-1" style={{ alignItems: 'center' }}>
              <input type="color" value={theme.band_color || '#314897'} onChange={(e) => setTheme({ band_color: e.target.value })} style={{ width: 44, height: 32, border: 'none', background: 'none' }} />
              <Input value={theme.band_color || '#314897'} onChange={(e) => setTheme({ band_color: e.target.value })} style={{ maxWidth: 120 }} />
            </div>
          </Field>
          <Field label={t('pc.titleColor')}>
            <div className="row gap-1" style={{ alignItems: 'center' }}>
              <input type="color" value={theme.title_color || '#314897'} onChange={(e) => setTheme({ title_color: e.target.value })} style={{ width: 44, height: 32, border: 'none', background: 'none' }} />
              <Input value={theme.title_color || '#314897'} onChange={(e) => setTheme({ title_color: e.target.value })} style={{ maxWidth: 120 }} />
            </div>
          </Field>
        </div>
      </Card>

      {/* Contenu de l'offre */}
      <Card style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{t('pc.content')}</div>
          <div className="row gap-2">
            <div className="seg">
              {['vendeur', 'acheteur'].map((v) => (
                <button key={v} className={`seg-btn ${variant === v ? 'active' : ''}`} onClick={() => setVariant(v)}>{t(`pc.${v}`)}</button>
              ))}
            </div>
            <div className="seg">
              {['fr', 'en'].map((l) => (
                <button key={l} className={`seg-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <Field label="Titre du document"><Input value={cv.doc_title || ''} onChange={(e) => setField('doc_title', e.target.value)} /></Field>
          <Field label="Sous-titre"><Input value={cv.subtitle || ''} onChange={(e) => setField('subtitle', e.target.value)} /></Field>
        </div>

        <p className="muted" style={{ fontSize: 12, margin: '4px 0 2px' }}>{t('pc.reorderHint')}</p>
        <div className="col gap-2" style={{ marginTop: 4 }}>
          <DragList value={sections} onReorder={reorderSections} renderRow={(s, i, hp) => {
            const sec = cv[s.key] || {};
            return (
              <div className={`offre-section ${s.hidden ? 'section-hidden' : ''}`}>
                <div className="section-head">
                  <Handle {...hp} />
                  <span className="offre-section-title">{secLabel(s)}{s.custom ? ' ·' : ''}{s.custom ? <span className="badge-soft">{t('pc.custom')}</span> : null}</span>
                  {s.hidden && <span className="muted" style={{ fontSize: 12 }}>· {t('pc.hidden')}</span>}
                  <span className="spacer" />
                  <Button variant="ghost" size="sm" icon={s.hidden ? EyeOff : Eye} onClick={() => toggleHide(s.key)}>
                    {s.hidden ? t('pc.show') : t('pc.hide')}
                  </Button>
                  {s.custom && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => deleteCustom(s.key)} />}
                </div>
                {!s.hidden && <SectionEditor keyName={s.key} sec={sec} onChange={(ns) => editSection(s.key, ns)} />}
              </div>
            );
          }} />
        </div>

        {/* Ajouter une section personnalisée */}
        <div className="add-section">
          <Input value={newName} placeholder={t('pc.newSectionName')} onChange={(e) => setNewName(e.target.value)} style={{ maxWidth: 280 }} />
          <Select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="text">{t('pc.kind.text')}</option>
            <option value="list">{t('pc.kind.list')}</option>
            <option value="groups">{t('pc.kind.groups')}</option>
          </Select>
          <Button variant="outline" icon={Plus} onClick={addCustom} disabled={!newName.trim()}>{t('pc.addSection')}</Button>
        </div>
      </Card>
    </div>
  );
}
