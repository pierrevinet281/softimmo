import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, EmptyState } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import { functionsForGenre, functionLabel } from '../lib/roomFunctions.js';

const LIN = [{ v: 'pi', l: 'pi' }, { v: 'm', l: 'm' }];
const SQ = [{ v: 'pi2', l: 'pi²' }, { v: 'm2', l: 'm²' }];
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

// Recouvrements de plancher — ordre par popularité, familles regroupées. Valeur = clé.
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

// Étages : RDC (0), 1..99, sous-sols SS1..SS10 (= -1..-10). Stocké en entier.
function floorOptions(lang) {
  const ground = lang === 'en' ? 'GF' : 'RDC';
  const sub = lang === 'en' ? 'B' : 'SS';
  const opts = [];
  for (let i = 99; i >= 1; i--) opts.push({ v: i, l: String(i) });
  opts.push({ v: 0, l: ground });
  for (let i = 1; i <= 10; i++) opts.push({ v: -i, l: `${sub}${i}` });
  return opts;
}

function useEntity(path, propertyId) {
  const qc = useQueryClient();
  const key = [path, propertyId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get(`/${path}?property_id=${propertyId}&limit=2000&sort=created_at&dir=asc`) });
  const refetch = () => qc.invalidateQueries({ queryKey: key });
  const create = useMutation({ mutationFn: (body) => api.post(`/${path}`, body), onSuccess: refetch });
  const patch = useMutation({ mutationFn: ({ id, body }) => api.patch(`/${path}/${id}`, body), onSuccess: refetch });
  const remove = useMutation({ mutationFn: (id) => api.del(`/${path}/${id}`), onSuccess: refetch });
  return { rows: data?.rows || [], refetch, create, patch, remove };
}

// Cellule texte (non contrôlée, commit au blur). `key` force la réinit. quand la valeur serveur change.
function TextCell({ value, onCommit, num = false }) {
  return (
    <input
      key={String(value ?? '')}
      className={`cell-input ${num ? 'num' : ''}`}
      type={num ? 'number' : 'text'}
      defaultValue={value ?? ''}
      onBlur={(e) => { const v = e.target.value; if (String(v) !== String(value ?? '')) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function SelectCell({ value, onChange, children }) {
  return <select className="cell-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}

function CheckboxCell({ value, onChange }) {
  return <input type="checkbox" className="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />;
}

const LEASE_TYPES = ['', 'brut', 'net', 'TMI'];
const EXPENSE_CATS = ['taxes_municipales', 'taxes_scolaires', 'assurances', 'energie', 'entretien', 'gestion', 'deneigement', 'conciergerie', 'reserve', 'autre'];

// Cellule dimension : valeur (commit au blur) + bascule d'unité (commit au clic).
function DimCell({ value, unit, options, onValue, onUnit }) {
  return (
    <div className="dim-cell">
      <input
        key={String(value ?? '')}
        className="cell-input num"
        type="number"
        defaultValue={value ?? ''}
        onBlur={(e) => { const v = e.target.value; if (String(v) !== String(value ?? '')) onValue(numOrNull(v)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <div className="unit-toggle">
        {options.map((o) => (
          <button key={o.v} type="button" className={`unit-opt ${unit === o.v ? 'active' : ''}`} onClick={() => onUnit(o.v)}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

export default function BuildingsUnits({ propertyId, genre, propertyAddress }) {
  const { t, lang } = useI18n();
  const blds = useEntity('buildings', propertyId);
  const units = useEntity('units', propertyId);
  const fns = functionsForGenre(genre);
  const fopts = floorOptions(lang);

  const patchB = (id, body) => blds.patch.mutate({ id, body });
  const patchU = (id, body) => units.patch.mutate({ id, body });
  const addBuilding = () => blds.create.mutate({
    property_id: propertyId, address: propertyAddress || '', label: propertyAddress || '',
    width_unit: 'pi', length_unit: 'pi', area_unit: 'pi2',
  });
  const addUnit = () => units.create.mutate({
    property_id: propertyId, floor: 0, width_unit: 'pi', length_unit: 'pi', area_unit: 'pi2', ceiling_unit: 'pi',
  });
  const delBtn = (onClick) => (
    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) onClick(); }} title={t('common.delete')} />
  );

  return (
    <>
      <Card>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>{t('bu.buildings')}</div>
          <div className="spacer" />
          <Button variant="primary" size="sm" icon={Plus} onClick={addBuilding}>{t('bu.addBuilding')}</Button>
        </div>
        {blds.rows.length === 0 ? <EmptyState title={t('bu.noBuildings')} /> : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th style={{ minWidth: 200 }}>{t('bu.address')}</th>
                <th>{t('bu.width')}</th><th>{t('bu.length')}</th><th>{t('bu.area')}</th><th>{t('bu.floors')}</th><th style={{ width: 44 }} />
              </tr></thead>
              <tbody>
                {blds.rows.map((b) => (
                  <tr key={b.id}>
                    <td className="cell"><TextCell value={b.address} onCommit={(v) => patchB(b.id, { address: v, label: v })} /></td>
                    <td className="cell"><DimCell value={b.width} unit={b.width_unit || 'pi'} options={LIN} onValue={(v) => patchB(b.id, { width: v })} onUnit={(u) => patchB(b.id, { width_unit: u })} /></td>
                    <td className="cell"><DimCell value={b.length} unit={b.length_unit || 'pi'} options={LIN} onValue={(v) => patchB(b.id, { length: v })} onUnit={(u) => patchB(b.id, { length_unit: u })} /></td>
                    <td className="cell"><DimCell value={b.building_area} unit={b.area_unit || 'pi2'} options={SQ} onValue={(v) => patchB(b.id, { building_area: v })} onUnit={(u) => patchB(b.id, { area_unit: u })} /></td>
                    <td className="cell"><TextCell value={b.floors_total} num onCommit={(v) => patchB(b.id, { floors_total: numOrNull(v) })} /></td>
                    <td>{delBtn(() => blds.remove.mutate(b.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>{t('bu.units')}</div>
          <div className="spacer" />
          <Button variant="primary" size="sm" icon={Plus} onClick={addUnit}>{t('bu.addUnit')}</Button>
        </div>
        {units.rows.length === 0 ? <EmptyState title={t('bu.noUnits')} /> : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th style={{ minWidth: 130 }}>{t('bu.building')}</th><th>{t('bu.floor')}</th><th style={{ minWidth: 130 }}>{t('bu.function')}</th>
                <th>{t('bu.width')}</th><th>{t('bu.length')}</th><th>{t('bu.area')}</th><th>{t('bu.ceiling')}</th>
                <th style={{ minWidth: 150 }}>{t('bu.floorCovering')}</th><th style={{ width: 44 }} />
              </tr></thead>
              <tbody>
                {units.rows.map((u) => (
                  <tr key={u.id}>
                    <td className="cell">
                      <SelectCell value={u.building_id} onChange={(v) => patchU(u.id, { building_id: v || null })}>
                        <option value="">{t('bu.pick')}</option>
                        {blds.rows.map((b) => <option key={b.id} value={b.id}>{b.address || b.label || b.id}</option>)}
                      </SelectCell>
                    </td>
                    <td className="cell">
                      <SelectCell value={String(u.floor ?? 0)} onChange={(v) => patchU(u.id, { floor: Number(v) })}>
                        {fopts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </SelectCell>
                    </td>
                    <td className="cell">
                      <SelectCell value={u.room_function} onChange={(v) => patchU(u.id, { room_function: v, label: functionLabel(v, lang) || null })}>
                        <option value="">{t('bu.pick')}</option>
                        {fns.map((o) => <option key={o.key} value={o.key}>{lang === 'en' ? o.en : o.fr}</option>)}
                      </SelectCell>
                    </td>
                    <td className="cell"><DimCell value={u.width} unit={u.width_unit || 'pi'} options={LIN} onValue={(v) => patchU(u.id, { width: v })} onUnit={(x) => patchU(u.id, { width_unit: x })} /></td>
                    <td className="cell"><DimCell value={u.length} unit={u.length_unit || 'pi'} options={LIN} onValue={(v) => patchU(u.id, { length: v })} onUnit={(x) => patchU(u.id, { length_unit: x })} /></td>
                    <td className="cell"><DimCell value={u.area} unit={u.area_unit || 'pi2'} options={SQ} onValue={(v) => patchU(u.id, { area: v })} onUnit={(x) => patchU(u.id, { area_unit: x })} /></td>
                    <td className="cell"><DimCell value={u.ceiling_height} unit={u.ceiling_unit || 'pi'} options={LIN} onValue={(v) => patchU(u.id, { ceiling_height: v })} onUnit={(x) => patchU(u.id, { ceiling_unit: x })} /></td>
                    <td className="cell">
                      <SelectCell value={u.floor_covering} onChange={(v) => patchU(u.id, { floor_covering: v })}>
                        <option value="">{t('bu.pick')}</option>
                        {FLOOR_COVERINGS.map((o) => <option key={o.v} value={o.v}>{lang === 'en' ? o.en : o.fr}</option>)}
                      </SelectCell>
                    </td>
                    <td>{delBtn(() => units.remove.mutate(u.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// Rent roll : mêmes unités (table `units`), vue financière/locative, édition en ligne + scroll H.
export function RentRoll({ propertyId }) {
  const { t } = useI18n();
  const units = useEntity('units', propertyId);
  const blds = useEntity('buildings', propertyId);
  const patchU = (id, body) => units.patch.mutate({ id, body });
  const addUnit = () => units.create.mutate({ property_id: propertyId, is_vacant: 0 });
  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>{t('d.tab.units')}</div>
        <div className="spacer" />
        <Button variant="primary" size="sm" icon={Plus} onClick={addUnit}>{t('bu.addUnit')}</Button>
      </div>
      {units.rows.length === 0 ? <EmptyState title={t('bu.noUnits')} /> : (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr>
              <th style={{ minWidth: 130 }}>{t('bu.building')}</th>
              <th style={{ minWidth: 90 }}>{t('d.unit.label')}</th>
              <th style={{ minWidth: 90 }}>{t('common.type')}</th>
              <th>{t('d.unit.bedrooms')}</th>
              <th>{t('d.unit.bathrooms')}</th>
              <th>{t('d.unit.area')}</th>
              <th>{t('d.unit.rent')}</th>
              <th>{t('d.unit.other')}</th>
              <th style={{ minWidth: 100 }}>{t('d.unit.leaseType')}</th>
              <th style={{ minWidth: 110 }}>{t('d.unit.leaseEnd')}</th>
              <th style={{ minWidth: 120 }}>{t('d.unit.occupant')}</th>
              <th>{t('d.unit.vacant')}</th>
              <th style={{ minWidth: 140 }}>{t('common.notes')}</th>
              <th style={{ width: 44 }} />
            </tr></thead>
            <tbody>
              {units.rows.map((u) => (
                <tr key={u.id}>
                  <td className="cell">
                    <SelectCell value={u.building_id} onChange={(v) => patchU(u.id, { building_id: v || null })}>
                      <option value="">{t('bu.pick')}</option>
                      {blds.rows.map((b) => <option key={b.id} value={b.id}>{b.address || b.label || b.id}</option>)}
                    </SelectCell>
                  </td>
                  <td className="cell"><TextCell value={u.label} onCommit={(v) => patchU(u.id, { label: v })} /></td>
                  <td className="cell"><TextCell value={u.unit_type} onCommit={(v) => patchU(u.id, { unit_type: v })} /></td>
                  <td className="cell"><TextCell value={u.bedrooms} num onCommit={(v) => patchU(u.id, { bedrooms: numOrNull(v) })} /></td>
                  <td className="cell"><TextCell value={u.bathrooms} num onCommit={(v) => patchU(u.id, { bathrooms: numOrNull(v) })} /></td>
                  <td className="cell"><TextCell value={u.area} num onCommit={(v) => patchU(u.id, { area: numOrNull(v) })} /></td>
                  <td className="cell"><TextCell value={u.rent_monthly} num onCommit={(v) => patchU(u.id, { rent_monthly: numOrNull(v) })} /></td>
                  <td className="cell"><TextCell value={u.other_income} num onCommit={(v) => patchU(u.id, { other_income: numOrNull(v) })} /></td>
                  <td className="cell">
                    <SelectCell value={u.lease_type} onChange={(v) => patchU(u.id, { lease_type: v })}>
                      {LEASE_TYPES.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
                    </SelectCell>
                  </td>
                  <td className="cell"><TextCell value={u.lease_end} onCommit={(v) => patchU(u.id, { lease_end: v })} /></td>
                  <td className="cell"><TextCell value={u.occupant} onCommit={(v) => patchU(u.id, { occupant: v })} /></td>
                  <td className="cell" style={{ textAlign: 'center' }}><CheckboxCell value={u.is_vacant} onChange={(v) => patchU(u.id, { is_vacant: v })} /></td>
                  <td className="cell"><TextCell value={u.notes} onCommit={(v) => patchU(u.id, { notes: v })} /></td>
                  <td>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) units.remove.mutate(u.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Dépenses : édition en ligne (ajout + poubelle), même style que Rent roll.
export function ExpensesEditor({ propertyId }) {
  const { t } = useI18n();
  const exp = useEntity('expenses', propertyId);
  const patchE = (id, body) => exp.patch.mutate({ id, body });
  const addExp = () => exp.create.mutate({ property_id: propertyId, category: 'taxes_municipales', period: 'annuel' });
  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>{t('d.tab.expenses')}</div>
        <div className="spacer" />
        <Button variant="primary" size="sm" icon={Plus} onClick={addExp}>{t('common.add')}</Button>
      </div>
      {exp.rows.length === 0 ? <EmptyState title={t('d.empty')} /> : (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr>
              <th style={{ minWidth: 170 }}>{t('d.exp.category')}</th>
              <th style={{ minWidth: 150 }}>{t('common.name')}</th>
              <th>{t('d.exp.amount')}</th>
              <th style={{ minWidth: 110 }}>{t('d.exp.period')}</th>
              <th style={{ minWidth: 170 }}>{t('common.notes')}</th>
              <th style={{ width: 44 }} />
            </tr></thead>
            <tbody>
              {exp.rows.map((e) => (
                <tr key={e.id}>
                  <td className="cell">
                    <SelectCell value={e.category} onChange={(v) => patchE(e.id, { category: v })}>
                      {EXPENSE_CATS.map((c) => <option key={c} value={c}>{t(`d.exp.cat.${c}`)}</option>)}
                    </SelectCell>
                  </td>
                  <td className="cell"><TextCell value={e.label} onCommit={(v) => patchE(e.id, { label: v })} /></td>
                  <td className="cell"><TextCell value={e.amount} num onCommit={(v) => patchE(e.id, { amount: numOrNull(v) })} /></td>
                  <td className="cell">
                    <SelectCell value={e.period} onChange={(v) => patchE(e.id, { period: v })}>
                      <option value="annuel">{t('d.exp.period.annuel')}</option>
                      <option value="mensuel">{t('d.exp.period.mensuel')}</option>
                    </SelectCell>
                  </td>
                  <td className="cell"><TextCell value={e.notes} onCommit={(v) => patchE(e.id, { notes: v })} /></td>
                  <td>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) exp.remove.mutate(e.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
