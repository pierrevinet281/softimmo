import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import api from '../api/client.js';
import { Button, Select, Input } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const CANON = ['why', 'guarantee', 'services', 'marketing', 'opportunities', 'timeline', 'fees', 'value_add', 'testimonials', 'next_steps'];
const ASSET_KINDS = ['logo', 'banner', 'portrait', 'buste', 'photo'];
const variantOf = (op) => (['vendeur', 'locateur'].includes(op) ? 'vendeur' : 'acheteur');

// petite liste réordonnable (drag & drop natif)
function DragList({ value = [], onReorder, renderRow }) {
  const [from, setFrom] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (to) => {
    if (from === null || from === to) { setFrom(null); setOver(null); return; }
    const a = value.slice(); const [m] = a.splice(from, 1); a.splice(to, 0, m);
    onReorder(a); setFrom(null); setOver(null);
  };
  return value.map((item, i) => (
    <div key={item.k ?? i}
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
const Handle = (hp) => <span className="drag-handle" {...hp}><GripVertical size={14} /></span>;

// Interrupteur (toggle) vert aligné à droite : activé = inclus, désactivé = exclu.
function Switch({ on, onChange, title }) {
  return (
    <button type="button" role="switch" aria-checked={on} title={title}
      className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="switch-knob" />
    </button>
  );
}

export default function OffreContentCustomizer({ opportunity, lang, value, onChange }) {
  const { t } = useI18n();
  const variant = variantOf(opportunity);
  const dlang = lang === 'en' ? 'en' : 'fr'; // 'bi' → on personnalise le FR (prééminent)
  const { data: cfg } = useQuery({ queryKey: ['offre-config'], queryFn: () => api.get('/offre/config') });
  const { data: assetsData } = useQuery({ queryKey: ['broker-assets', 'imgs'], queryFn: () => api.get('/broker-assets?limit=500') });
  const [insert, setInsert] = useState('logo');

  const base = cfg?.resolved?.[dlang]?.[variant] || {};
  const baseKeys = Array.isArray(base.sections) && base.sections.length
    ? base.sections.map((s) => s.key)
    : CANON.filter((k) => base[k]);

  const diff = value || {};
  const order = (Array.isArray(diff.order) && diff.order.length) ? diff.order : baseKeys;
  const hidden = diff.hidden || {};
  const items = diff.items || {};
  const assets = diff.assets || {};
  const emit = (patch) => onChange({ order, hidden, items, assets, ...patch });

  if (!cfg) return <p className="muted">…</p>;

  const libImgs = (assetsData?.rows || []).filter((a) => a.file_path && (a.mime || '').startsWith('image/'));
  const sectionLabel = (key) => {
    if (assets[key]) return `${t('off2.asset.image')} · ${assets[key].asset_id ? (libImgs.find((a) => a.id === assets[key].asset_id)?.name || t('off2.asset.image')) : t(`off2.asset.${assets[key].kind}`)}`;
    if (CANON.includes(key)) return t(`pc.sec.${key}`);
    return base[key]?.heading || key;
  };
  const itemText = (it) => (typeof it === 'string' ? it : (it?.quote || it?.text || ''));

  const setSectionIncluded = (key, inc) => {
    const h = { ...hidden }; if (inc) delete h[key]; else h[key] = true; emit({ hidden: h });
  };
  const setItemIncluded = (key, idx, inc) => {
    const baseItems = base[key]?.items || [];
    const cur = items[key] || { order: baseItems.map((_, i) => i), excluded: {} };
    const ex = { ...cur.excluded }; if (inc) delete ex[idx]; else ex[idx] = true;
    emit({ items: { ...items, [key]: { order: cur.order && cur.order.length ? cur.order : baseItems.map((_, i) => i), excluded: ex } } });
  };
  const reorderItems = (key, newIdxOrder) => emit({ items: { ...items, [key]: { order: newIdxOrder, excluded: (items[key]?.excluded) || {} } } });
  const insertAsset = () => {
    const k = `asset_${Date.now()}`;
    const meta = insert.startsWith('id:') ? { asset_id: insert.slice(3), caption: '' } : { kind: insert, caption: '' };
    emit({ order: [...order, k], assets: { ...assets, [k]: meta } });
  };
  const removeAsset = (key) => {
    const a = { ...assets }; delete a[key]; emit({ order: order.filter((x) => x !== key), assets: a });
  };
  const setCaption = (key, cap) => emit({ assets: { ...assets, [key]: { ...assets[key], caption: cap } } });

  return (
    <div>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>{t('off2.contentHint')}</p>
      <div className="col gap-2">
        <DragList value={order.map((k) => ({ k }))} onReorder={(arr) => emit({ order: arr.map((x) => x.k) })}
          renderRow={({ k: key }, i, hp) => {
            const isAsset = !!assets[key];
            const included = !hidden[key];
            const sec = base[key] || {};
            const flatItems = Array.isArray(sec.items) ? sec.items : null;
            const itOrder = (items[key]?.order && items[key].order.length) ? items[key].order : (flatItems ? flatItems.map((_, j) => j) : []);
            return (
              <div className={`offre-section ${included ? '' : 'section-hidden'}`}>
                <div className="section-head">
                  <Handle {...hp} />
                  <span className="offre-section-title">{sectionLabel(key)}</span>
                  {isAsset && <ImageIcon size={13} style={{ color: 'var(--color-text-tertiary)' }} />}
                  <span className="spacer" />
                  {isAsset && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => removeAsset(key)} />}
                  <Switch on={included} title={included ? t('off2.include') : t('off2.exclude')} onChange={(v) => setSectionIncluded(key, v)} />
                </div>
                {included && isAsset && (
                  <Input value={assets[key].caption || ''} placeholder={t('off2.caption')} onChange={(e) => setCaption(key, e.target.value)} />
                )}
                {included && !isAsset && flatItems && (
                  <DragList value={itOrder.map((idx) => ({ k: `${key}:${idx}`, idx }))} onReorder={(arr) => reorderItems(key, arr.map((x) => x.idx))}
                    renderRow={({ idx }, j, hp2) => {
                      const inc = !(items[key]?.excluded && items[key].excluded[idx]);
                      return (
                        <div className={`item-row ${inc ? '' : 'item-excluded'}`}>
                          <Handle {...hp2} />
                          <span className="item-text">{itemText(flatItems[idx])}</span>
                          <span className="spacer" />
                          <Switch on={inc} title={inc ? t('off2.include') : t('off2.exclude')} onChange={(v) => setItemIncluded(key, idx, v)} />
                        </div>
                      );
                    }} />
                )}
                {included && !isAsset && !flatItems && (sec.groups || sec.subgroups || sec.steps) && (
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('off2.groupNote')}</p>
                )}
              </div>
            );
          }} />
      </div>

      <div className="add-section">
        <Select value={insert} onChange={(e) => setInsert(e.target.value)} style={{ maxWidth: 260 }}>
          <optgroup label={t('pc.branding')}>
            {ASSET_KINDS.map((k) => <option key={k} value={k}>{t(`off2.asset.${k}`)}</option>)}
          </optgroup>
          {libImgs.length > 0 && (
            <optgroup label={t('nav.brokerAssets')}>
              {libImgs.map((a) => <option key={a.id} value={`id:${a.id}`}>{a.name}</option>)}
            </optgroup>
          )}
        </Select>
        <Button variant="outline" icon={Plus} onClick={insertAsset}>{t('off2.insertAsset')}</Button>
      </div>
    </div>
  );
}
