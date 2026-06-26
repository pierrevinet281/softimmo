// Tableau + formulaire CRUD génériques, pilotés par une config de champs/colonnes.
// DRY : miroir des fabriques repo/route côté serveur. Réutilisé par le détail de propriété
// (Module 1) et l'évaluation/ACM (Module 2).
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import api from '../api/client.js';
import { Button, Modal, Select, Textarea, EmptyState } from './ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Modale d'ajout / édition d'une entité.
export function EntityForm({ cfg, propertyId, row, onClose, onSaved }) {
  const { t } = useI18n();
  const isEdit = !!row;
  const [form, setForm] = useState(() => ({ ...(cfg.defaults || {}), ...(row || {}) }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.patch(`/${cfg.path}/${row.id}`, body) : api.post(`/${cfg.path}`, body)),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const submit = () => {
    const body = { ...form, property_id: propertyId };
    for (const fld of cfg.fields) {
      if (fld.type === 'number' && body[fld.key] != null && body[fld.key] !== '') body[fld.key] = Number(body[fld.key]);
      if (fld.type === 'checkbox') body[fld.key] = body[fld.key] ? 1 : 0;
    }
    save.mutate(body);
  };

  return (
    <Modal
      title={isEdit ? t('common.edit') : t('common.new')}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={save.isPending} onClick={submit}>{isEdit ? t('common.save') : t('common.create')}</Button>
        </>
      )}
    >
      {save.isError && <div className="notice notice-warn"><AlertTriangle size={16} />{String(save.error?.message || 'Erreur')}</div>}
      <div className="field-row">
        {cfg.fields.map((fld) => {
          const full = !fld.half;
          const el = fld.type === 'select' ? (
            <Select value={form[fld.key] ?? ''} onChange={(e) => set(fld.key, e.target.value)}>
              {fld.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : fld.type === 'textarea' ? (
            <Textarea rows={2} value={form[fld.key] ?? ''} onChange={(e) => set(fld.key, e.target.value)} />
          ) : fld.type === 'checkbox' ? (
            <input type="checkbox" className="checkbox" checked={!!Number(form[fld.key])} onChange={(e) => set(fld.key, e.target.checked ? 1 : 0)} />
          ) : fld.type === 'inclusions' ? (
            <InclusionsField value={form[fld.key]} options={fld.options} onChange={(v) => set(fld.key, v)} />
          ) : (
            <input className="input" type={fld.type === 'number' ? 'number' : 'text'} value={form[fld.key] ?? ''} placeholder={fld.placeholder} onChange={(e) => set(fld.key, e.target.value)} />
          );
          return (
            <div className="field" key={fld.key} style={full ? { gridColumn: '1 / -1' } : undefined}>
              <label>{fld.label}{fld.required ? ' *' : ''}</label>
              {el}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// Champ d'inclusions : cases à cocher → tableau de clés (stocké en JSON côté DB).
export function InclusionsField({ value, options, onChange }) {
  const arr = Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.keys(value).filter((k) => value[k]) : []);
  const toggle = (key) => {
    const set = new Set(arr);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange([...set]);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" className="checkbox" checked={arr.includes(o.value)} onChange={() => toggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

// Tableau d'entités avec ajout/édition/suppression. `extraInvalidate` : queryKeys à rafraîchir.
export function EntityTable({ cfg, propertyId, items, onChanged, extraInvalidate = [] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const remove = useMutation({
    mutationFn: (id) => api.del(`/${cfg.path}/${id}`),
    onSuccess: () => { onChanged(); extraInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); },
  });
  const Icon = cfg.icon;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="spacer" />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing('new')}>{cfg.addLabel || t('common.add')}</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Icon} title={t('d.empty')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {cfg.columns.map((c) => <th key={c.key} className={c.align === 'num' ? 'num' : undefined}>{c.label}</th>)}
                <th style={{ width: 76 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)}>
                  {cfg.columns.map((c) => (
                    <td key={c.key} className={c.align === 'num' ? 'num' : undefined}>
                      {c.render ? c.render(r) : (r[c.key] ?? <span className="muted">—</span>)}
                    </td>
                  ))}
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(r)} title={t('common.edit')} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) remove.mutate(r.id); }} title={t('common.delete')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EntityForm
          cfg={cfg}
          propertyId={propertyId}
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { onChanged(); extraInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); }}
        />
      )}
    </>
  );
}

export default EntityTable;
