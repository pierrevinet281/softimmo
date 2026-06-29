import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, FormField, Select, EmptyState } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import { functionsForGenre, functionLabel } from '../lib/roomFunctions.js';

const LIN = [{ v: 'pi', l: 'pi' }, { v: 'm', l: 'm' }];
const SQ = [{ v: 'pi2', l: 'pi²' }, { v: 'm2', l: 'm²' }];
const UNIT_LABEL = { pi: 'pi', m: 'm', pi2: 'pi²', m2: 'm²' };

// Recouvrements de plancher — ordre par popularité, familles regroupées (bois, tuiles/pierre,
// souple, résilient, béton). Valeur stockée = clé ; affichage selon la langue.
const FLOOR_COVERINGS = [
  { v: 'bois_franc', fr: 'Bois franc', en: 'Hardwood' },
  { v: 'bois_ingenierie', fr: "Bois d'ingénierie", en: 'Engineered wood' },
  { v: 'flottant', fr: 'Plancher flottant (stratifié)', en: 'Laminate (floating)' },
  { v: 'vinyle_luxe', fr: 'Vinyle de luxe (LVP)', en: 'Luxury vinyl (LVP)' },
  { v: 'vinyle', fr: 'Vinyle / Prélart', en: 'Vinyl / Sheet vinyl' },
  { v: 'liege', fr: 'Liège', en: 'Cork' },
  { v: 'bambou', fr: 'Bambou', en: 'Bamboo' },
  { v: 'ceramique', fr: 'Céramique', en: 'Ceramic tile' },
  { v: 'porcelaine', fr: 'Porcelaine', en: 'Porcelain tile' },
  { v: 'ardoise', fr: 'Ardoise', en: 'Slate' },
  { v: 'marbre', fr: 'Marbre', en: 'Marble' },
  { v: 'granit', fr: 'Granit', en: 'Granite' },
  { v: 'terrazzo', fr: 'Terrazzo', en: 'Terrazzo' },
  { v: 'tapis', fr: 'Tapis / Moquette', en: 'Carpet' },
  { v: 'linoleum', fr: 'Linoléum', en: 'Linoleum' },
  { v: 'epoxy', fr: 'Époxy', en: 'Epoxy' },
  { v: 'beton_poli', fr: 'Béton poli', en: 'Polished concrete' },
  { v: 'beton', fr: 'Béton', en: 'Concrete' },
  { v: 'autre', fr: 'Autre', en: 'Other' },
];
const covLabel = (v, lang) => {
  if (!v) return '—';
  const o = FLOOR_COVERINGS.find((x) => x.v === v);
  return o ? (lang === 'en' ? o.en : o.fr) : v;
};
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

// Champ dimension : valeur + bascule d'unité (pi/m ou pi²/m²).
function DimField({ label, value, unit, options, onValue, onUnit }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="dim-field">
        <input className="input" type="number" value={value ?? ''} onChange={(e) => onValue(e.target.value)} />
        <div className="unit-toggle">
          {options.map((o) => (
            <button key={o.v} type="button" className={`unit-opt ${unit === o.v ? 'active' : ''}`} onClick={() => onUnit(o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function useEntity(path, propertyId) {
  const qc = useQueryClient();
  const key = [path, propertyId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get(`/${path}?property_id=${propertyId}&limit=2000&sort=created_at&dir=asc`) });
  const refetch = () => qc.invalidateQueries({ queryKey: key });
  const remove = useMutation({ mutationFn: (id) => api.del(`/${path}/${id}`), onSuccess: refetch });
  return { rows: data?.rows || [], refetch, remove };
}

// ───────────────────────── Bâtiment : formulaire ─────────────────────────
const BLD_EMPTY = { address: '', width: '', width_unit: 'pi', length: '', length_unit: 'pi', building_area: '', area_unit: 'pi2', floors_total: '' };

function BuildingForm({ propertyId, propertyAddress, row, onClose, onSaved }) {
  const { t } = useI18n();
  const [f, setF] = useState(() => ({ ...BLD_EMPTY, ...(row || {}), ...(!row && propertyAddress ? { address: propertyAddress } : {}) }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  // « Même adresse » : verrouille l'adresse du bâtiment sur celle de la propriété (auto-rempli).
  const [same, setSame] = useState(() => (row ? (!!row.address && row.address === propertyAddress) : !!propertyAddress));
  const toggleSame = (v) => { setSame(v); if (v) set('address', propertyAddress || ''); };
  const save = useMutation({
    mutationFn: (b) => (b.id ? api.patch(`/buildings/${b.id}`, b) : api.post('/buildings', b)),
    onSuccess: () => { onSaved(); onClose(); },
  });
  const submit = () => save.mutate({
    id: row?.id, property_id: propertyId, label: f.address || row?.label || null,
    address: f.address, width: numOrNull(f.width), width_unit: f.width_unit,
    length: numOrNull(f.length), length_unit: f.length_unit,
    building_area: numOrNull(f.building_area), area_unit: f.area_unit, floors_total: numOrNull(f.floors_total),
  });
  return (
    <Modal title={row ? t('bu.editBuilding') : t('bu.addBuilding')} onClose={onClose} size="lg"
      footer={(<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={save.isPending} onClick={submit}>{row ? t('common.save') : t('common.create')}</Button></>)}>
      <div className="field-row">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>{t('bu.address')}</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
              <input type="checkbox" className="checkbox" checked={same} onChange={(e) => toggleSame(e.target.checked)} />
              {t('bu.sameAddress')}
            </label>
            <input className="input" style={{ flex: 1 }} value={f.address} disabled={same} onChange={(e) => set('address', e.target.value)} />
          </div>
        </div>
        <DimField label={t('bu.width')} value={f.width} unit={f.width_unit} options={LIN} onValue={(v) => set('width', v)} onUnit={(u) => set('width_unit', u)} />
        <DimField label={t('bu.length')} value={f.length} unit={f.length_unit} options={LIN} onValue={(v) => set('length', v)} onUnit={(u) => set('length_unit', u)} />
        <DimField label={t('bu.area')} value={f.building_area} unit={f.area_unit} options={SQ} onValue={(v) => set('building_area', v)} onUnit={(u) => set('area_unit', u)} />
        <FormField label={t('bu.floors')} type="number" value={f.floors_total} onChange={(e) => set('floors_total', e.target.value)} />
      </div>
    </Modal>
  );
}

// ───────────────────────── Unité / pièce : formulaire ─────────────────────────
const UNIT_EMPTY = { building_id: '', floor: 0, room_function: '', width: '', width_unit: 'pi', length: '', length_unit: 'pi', area: '', area_unit: 'pi2', ceiling_height: '', ceiling_unit: 'pi', floor_covering: '' };

function UnitForm({ propertyId, genre, buildings, row, onClose, onSaved }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState(() => ({ ...UNIT_EMPTY, ...(row || {}) }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const fns = functionsForGenre(genre);
  const save = useMutation({
    mutationFn: (b) => (b.id ? api.patch(`/units/${b.id}`, b) : api.post('/units', b)),
    onSuccess: () => { onSaved(); onClose(); },
  });
  const submit = () => save.mutate({
    id: row?.id, property_id: propertyId, building_id: f.building_id || null,
    floor: numOrNull(f.floor), room_function: f.room_function,
    label: functionLabel(f.room_function, lang) || row?.label || null, unit_type: f.room_function || null,
    width: numOrNull(f.width), width_unit: f.width_unit, length: numOrNull(f.length), length_unit: f.length_unit,
    area: numOrNull(f.area), area_unit: f.area_unit,
    ceiling_height: numOrNull(f.ceiling_height), ceiling_unit: f.ceiling_unit, floor_covering: f.floor_covering,
  });
  return (
    <Modal title={row ? t('bu.editUnit') : t('bu.addUnit')} onClose={onClose} size="lg"
      footer={(<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={save.isPending} onClick={submit}>{row ? t('common.save') : t('common.create')}</Button></>)}>
      <div className="field-row">
        <div className="field">
          <label>{t('bu.building')}</label>
          <Select value={f.building_id} onChange={(e) => set('building_id', e.target.value)}>
            <option value="">{t('bu.pick')}</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.address || b.label || b.id}</option>)}
          </Select>
        </div>
        <div className="field">
          <label>{t('bu.floor')}</label>
          <Select value={String(f.floor ?? 0)} onChange={(e) => set('floor', Number(e.target.value))}>
            {floorOptions(lang).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </Select>
        </div>
        <div className="field">
          <label>{t('bu.function')}</label>
          <Select value={f.room_function} onChange={(e) => set('room_function', e.target.value)}>
            <option value="">{t('bu.pick')}</option>
            {fns.map((o) => <option key={o.key} value={o.key}>{lang === 'en' ? o.en : o.fr}</option>)}
          </Select>
        </div>
        <DimField label={t('bu.width')} value={f.width} unit={f.width_unit} options={LIN} onValue={(v) => set('width', v)} onUnit={(u) => set('width_unit', u)} />
        <DimField label={t('bu.length')} value={f.length} unit={f.length_unit} options={LIN} onValue={(v) => set('length', v)} onUnit={(u) => set('length_unit', u)} />
        <DimField label={t('bu.area')} value={f.area} unit={f.area_unit} options={SQ} onValue={(v) => set('area', v)} onUnit={(u) => set('area_unit', u)} />
        <DimField label={t('bu.ceiling')} value={f.ceiling_height} unit={f.ceiling_unit} options={LIN} onValue={(v) => set('ceiling_height', v)} onUnit={(u) => set('ceiling_unit', u)} />
        <div className="field">
          <label>{t('bu.floorCovering')}</label>
          <Select value={f.floor_covering} onChange={(e) => set('floor_covering', e.target.value)}>
            <option value="">{t('bu.pick')}</option>
            {FLOOR_COVERINGS.map((o) => <option key={o.v} value={o.v}>{lang === 'en' ? o.en : o.fr}</option>)}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

const dim = (v, u) => (v == null || v === '' ? '—' : `${v} ${UNIT_LABEL[u] || ''}`.trim());

// Étages : RDC (0), positifs 1..99, sous-sols SS1..SS10 (= -1..-10). Stocké en entier.
function floorOptions(lang) {
  const ground = lang === 'en' ? 'GF' : 'RDC';
  const sub = lang === 'en' ? 'B' : 'SS';
  const opts = [];
  for (let i = 99; i >= 1; i--) opts.push({ v: i, l: String(i) });
  opts.push({ v: 0, l: ground });
  for (let i = 1; i <= 10; i++) opts.push({ v: -i, l: `${sub}${i}` });
  return opts;
}
function floorLabel(n, lang) {
  if (n == null || n === '') return '—';
  const x = Number(n);
  if (x === 0) return lang === 'en' ? 'GF' : 'RDC';
  if (x < 0) return `${lang === 'en' ? 'B' : 'SS'}${-x}`;
  return String(x);
}

// ───────────────────────── Onglet Bâtiments & unités/pièces ─────────────────────────
export default function BuildingsUnits({ propertyId, genre, propertyAddress }) {
  const { t, lang } = useI18n();
  const blds = useEntity('buildings', propertyId);
  const units = useEntity('units', propertyId);
  const [bEdit, setBEdit] = useState(null); // 'new' | row | null
  const [uEdit, setUEdit] = useState(null);
  const bldName = (id) => { const b = blds.rows.find((x) => x.id === id); return b ? (b.address || b.label || '—') : '—'; };

  return (
    <>
      <Card>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>{t('bu.buildings')}</div>
          <div className="spacer" />
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setBEdit('new')}>{t('bu.addBuilding')}</Button>
        </div>
        {blds.rows.length === 0 ? <EmptyState title={t('bu.noBuildings')} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('bu.address')}</th><th className="num">{t('bu.width')}</th><th className="num">{t('bu.length')}</th><th className="num">{t('bu.area')}</th><th className="num">{t('bu.floors')}</th><th style={{ width: 76 }} /></tr></thead>
            <tbody>
              {blds.rows.map((b) => (
                <tr key={b.id} onClick={() => setBEdit(b)}>
                  <td><strong>{b.address || b.label || '—'}</strong></td>
                  <td className="num">{dim(b.width, b.width_unit)}</td>
                  <td className="num">{dim(b.length, b.length_unit)}</td>
                  <td className="num">{dim(b.building_area, b.area_unit)}</td>
                  <td className="num">{b.floors_total ?? '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setBEdit(b)} title={t('common.edit')} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) blds.remove.mutate(b.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>{t('bu.units')}</div>
          <div className="spacer" />
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setUEdit('new')}>{t('bu.addUnit')}</Button>
        </div>
        {units.rows.length === 0 ? <EmptyState title={t('bu.noUnits')} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('bu.function')}</th><th>{t('bu.building')}</th><th className="num">{t('bu.floor')}</th><th className="num">{t('bu.area')}</th><th>{t('bu.ceiling')}</th><th>{t('bu.floorCovering')}</th><th style={{ width: 76 }} /></tr></thead>
            <tbody>
              {units.rows.map((u) => (
                <tr key={u.id} onClick={() => setUEdit(u)}>
                  <td><strong>{functionLabel(u.room_function, lang) || u.label || '—'}</strong></td>
                  <td>{bldName(u.building_id)}</td>
                  <td className="num">{floorLabel(u.floor, lang)}</td>
                  <td className="num">{dim(u.area, u.area_unit)}</td>
                  <td>{dim(u.ceiling_height, u.ceiling_unit)}</td>
                  <td>{covLabel(u.floor_covering, lang)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setUEdit(u)} title={t('common.edit')} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) units.remove.mutate(u.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      {bEdit && <BuildingForm propertyId={propertyId} propertyAddress={propertyAddress} row={bEdit === 'new' ? null : bEdit} onClose={() => setBEdit(null)} onSaved={blds.refetch} />}
      {uEdit && <UnitForm propertyId={propertyId} genre={genre} buildings={blds.rows} row={uEdit === 'new' ? null : uEdit} onClose={() => setUEdit(null)} onSaved={() => { units.refetch(); blds.refetch(); }} />}
    </>
  );
}
