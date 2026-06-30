import React from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button, Select } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';
import { optionsFor, labelOf, deriveHeatingEnergy, UNIT_LIN, UNIT_AREA } from '../lib/attrOptions.js';

const arr = (v) => (Array.isArray(v) ? v : []);

// Multi-sélection : cases à cocher en ligne (valeur = tableau de clés).
function MultiSelect({ options, value, onChange, lang }) {
  const sel = arr(value);
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  return (
    <div className="ms-box">
      {options.map((o) => (
        <label key={o.v} className={`ms-opt ${sel.includes(o.v) ? 'on' : ''}`}>
          <input type="checkbox" className="checkbox" checked={sel.includes(o.v)} onChange={() => toggle(o.v)} />
          {lang === 'en' ? o.en : o.fr}
        </label>
      ))}
    </div>
  );
}

function YearSelect({ value, onChange }) {
  const years = [];
  for (let y = 2027; y >= 1900; y--) years.push(y);
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </Select>
  );
}

function DimInput({ value, unit, area, onValue, onUnit }) {
  const opts = area ? UNIT_AREA : UNIT_LIN;
  const u = unit || (area ? 'pi2' : 'pi');
  return (
    <div className="dim-field">
      <input className="input" type="number" value={value ?? ''} onChange={(e) => onValue(e.target.value)} />
      <div className="unit-toggle">
        {opts.map((o) => <button key={o.v} type="button" className={`unit-opt ${u === o.v ? 'active' : ''}`} onClick={() => onUnit(o.v)}>{o.l}</button>)}
      </div>
    </div>
  );
}

const SYNC = {
  rooms: (units) => units.length,
  bedrooms: (units) => units.filter((u) => ['chambre', 'chambre_principale'].includes(u.room_function)).length,
  bathrooms: (units) => units.filter((u) => u.room_function === 'salle_de_bain').length,
  powder: (units) => units.filter((u) => u.room_function === 'salle_eau').length,
};

// Sous-champ d'un groupe (select | multiselect).
function SubField({ f, value, onChange, lang }) {
  if (f.input === 'multiselect') return <MultiSelect options={optionsFor(f.optset)} value={value} onChange={onChange} lang={lang} />;
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {optionsFor(f.optset).map((o) => <option key={o.v} value={o.v}>{lang === 'en' ? o.en : o.fr}</option>)}
    </Select>
  );
}

// Champ d'attribut générique piloté par la définition de taxonomie (input/optset/group/...).
export default function AttrField({ a, attrs, setAttr, units = [] }) {
  const { t, lang } = useI18n();
  const L = lang === 'en' ? a.label_en : a.label_fr;
  const v = attrs[a.key];

  // Groupe répétable (chauffage, piscines).
  if (a.input === 'group') {
    const rows = arr(v);
    const setRows = (next) => setAttr(a.key, next);
    return (
      <div className="field" style={{ gridColumn: '1 / -1', margin: 0 }}>
        <label>{L}</label>
        {rows.map((row, i) => (
          <div key={i} className="grp-row">
            {a.group.fields.map((f) => (
              <div key={f.key} className="grp-cell">
                <div className="grp-cell-label">{lang === 'en' ? f.label_en : f.label_fr}</div>
                <SubField f={f} value={row[f.key]} lang={lang}
                  onChange={(val) => setRows(rows.map((r, j) => (j === i ? { ...r, [f.key]: val } : r)))} />
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setRows(rows.filter((_, j) => j !== i))} title={t('common.delete')} />
          </div>
        ))}
        <Button variant="outline" size="sm" icon={Plus} style={{ marginTop: 6 }} onClick={() => setRows([...rows, {}])}>{t('common.add')}</Button>
      </div>
    );
  }

  const inner = (() => {
    switch (a.input) {
      case 'select':
        return (
          <Select value={v ?? ''} onChange={(e) => setAttr(a.key, e.target.value)}>
            <option value="">—</option>
            {optionsFor(a.optset).map((o) => <option key={o.v} value={o.v}>{lang === 'en' ? o.en : o.fr}</option>)}
          </Select>
        );
      case 'multiselect':
        return <MultiSelect options={optionsFor(a.optset)} value={v} onChange={(val) => setAttr(a.key, val)} lang={lang} />;
      case 'dim':
        return (
          <DimInput value={v} unit={attrs[`${a.key}_unit`]} area={a.unit === 'area'}
            onValue={(val) => setAttr(a.key, val)} onUnit={(u) => setAttr(`${a.key}_unit`, u)} />
        );
      case 'year':
        return <YearSelect value={v} onChange={(val) => setAttr(a.key, val)} />;
      case 'bool':
        return (
          <Select value={v ?? ''} onChange={(e) => setAttr(a.key, e.target.value)}>
            <option value="">—</option><option value="Oui">{t('sa.yes')}</option><option value="Non">{t('sa.no')}</option>
          </Select>
        );
      case 'computed': {
        const txt = a.computed === 'heating_energy' ? deriveHeatingEnergy(arr(attrs.heating_systems), lang).join(', ') : (v ?? '');
        return <input className="input" value={txt} readOnly placeholder={t('pe.regionAuto')} style={{ background: 'var(--color-bg-secondary)' }} />;
      }
      case 'sync':
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" type="number" style={{ flex: 1 }} value={v ?? ''} onChange={(e) => setAttr(a.key, e.target.value)} />
            <Button variant="outline" size="sm" icon={RefreshCw} title={t('pe.sync')} onClick={() => setAttr(a.key, String((SYNC[a.sync] || (() => 0))(units)))} />
          </div>
        );
      default:
        return (
          <input className="input" type={['number', 'currency', 'percent'].includes(a.input) ? 'number' : 'text'}
            value={v ?? ''} onChange={(e) => setAttr(a.key, e.target.value)} placeholder={a.input === 'currency' ? '$' : ''} />
        );
    }
  })();

  return (
    <div className="field" style={{ margin: 0, ...(a.input === 'multiselect' ? { gridColumn: '1 / -1' } : {}) }}>
      <label>{L}</label>
      {inner}
    </div>
  );
}

export { labelOf };
