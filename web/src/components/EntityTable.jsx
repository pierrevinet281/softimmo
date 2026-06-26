// Tableau + formulaire CRUD génériques, pilotés par une config de champs/colonnes.
// DRY : miroir des fabriques repo/route côté serveur. Réutilisé par le détail de propriété
// (Module 1) et l'évaluation/ACM (Module 2).
import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, AlertTriangle, Upload } from 'lucide-react';
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

// Convertit une valeur d'inclusions (tableau de clés OU objet {clé:qté}) en map {clé:qté}.
export function inclusionsToMap(value) {
  if (!value) return {};
  if (Array.isArray(value)) return Object.fromEntries(value.map((k) => [k, 1]));
  const out = {};
  for (const [k, v] of Object.entries(value)) { const q = v === true ? 1 : Number(v) || 0; if (q) out[k] = q; }
  return out;
}

// Champ d'inclusions avec QUANTITÉ par élément (ex. 4 foyers, 2 piscines). Stocké {clé:qté}.
// Les options marquées `boolean` (ex. sous-sol fini) sont des cases à cocher (0/1).
export function InclusionsField({ value, options, onChange }) {
  const map = inclusionsToMap(value);
  const setQty = (key, q) => {
    const next = { ...map };
    if (q > 0) next[key] = q; else delete next[key];
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {options.map((o) => (
        <label key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {o.boolean ? (
            <input type="checkbox" className="checkbox" checked={(map[o.value] ?? 0) > 0} onChange={(e) => setQty(o.value, e.target.checked ? 1 : 0)} />
          ) : (
            <input type="number" min={0} className="input" style={{ width: 56, padding: '4px 6px' }}
              value={map[o.value] ?? 0} onChange={(e) => setQty(o.value, Math.max(0, parseInt(e.target.value, 10) || 0))} />
          )}
          {o.label}
        </label>
      ))}
    </div>
  );
}

// Tableau d'entités avec ajout/édition/suppression. `extraInvalidate` : queryKeys à rafraîchir.
export function EntityTable({ cfg, propertyId, items, onChanged, extraInvalidate = [], headerActions = null }) {
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
        {headerActions}
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

// ─────────────────────────── Cellule éditable (édition en ligne) ───────────────────────────
function EditableCell({ field, value, onCommit }) {
  const common = { className: `cell-input ${field.type === 'number' ? 'num' : ''}` };
  if (field.type === 'select') {
    return (
      <select {...common} value={value ?? ''} onChange={(e) => onCommit(e.target.value)}>
        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'checkbox') {
    return <input type="checkbox" className="checkbox" checked={!!Number(value)} onChange={(e) => onCommit(e.target.checked ? 1 : 0)} />;
  }
  // texte / nombre / textarea (rendu en ligne sur une ligne) : non contrôlé, commit au blur.
  return (
    <input
      {...common}
      type={field.type === 'number' ? 'number' : 'text'}
      defaultValue={value ?? ''}
      placeholder={field.placeholder}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

const normVal = (field, raw) => {
  if (field.type === 'number') return raw === '' || raw == null ? null : Number(raw);
  if (field.type === 'checkbox') return raw ? 1 : 0;
  return raw;
};

/**
 * Tableau à édition en ligne : modifie les cellules directement, ajoute une rangée via la
 * ligne vierge du bas (saisie rapide sans boîte de dialogue). Garde la même config que EntityTable.
 * Champs affichés : cfg.inlineFields ?? cfg.fields.
 */
export function InlineTable({ cfg, propertyId, items, onChanged, extraInvalidate = [] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fields = cfg.inlineFields || cfg.fields;
  const [draft, setDraft] = useState({});

  const after = () => { onChanged(); extraInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); };
  const patch = useMutation({ mutationFn: ({ id, body }) => api.patch(`/${cfg.path}/${id}`, body), onSuccess: after });
  const create = useMutation({ mutationFn: (body) => api.post(`/${cfg.path}`, body), onSuccess: () => { setDraft({}); after(); } });
  const remove = useMutation({ mutationFn: (id) => api.del(`/${cfg.path}/${id}`), onSuccess: after });

  const saveCell = (row, field, raw) => {
    const val = normVal(field, raw);
    if (String(row[field.key] ?? '') === String(val ?? '')) return; // inchangé → pas d'appel
    patch.mutate({ id: row.id, body: { [field.key]: val } });
  };

  const draftDirty = fields.some((f) => {
    const v = draft[f.key];
    return v !== '' && v != null && v !== (cfg.defaults?.[f.key]);
  });
  const commitDraft = () => {
    if (!draftDirty || create.isPending) return;
    const body = { property_id: propertyId };
    for (const f of fields) {
      const v = draft[f.key] !== undefined ? draft[f.key] : cfg.defaults?.[f.key];
      if (v !== undefined && v !== '') body[f.key] = normVal(f, v);
    }
    create.mutate(body);
  };

  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            {fields.map((f) => <th key={f.key} className={f.type === 'number' ? 'num' : undefined}>{f.label}</th>)}
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              {fields.map((f) => (
                <td key={f.key} className="cell">
                  <EditableCell field={f} value={row[f.key]} onCommit={(raw) => saveCell(row, f, raw)} />
                </td>
              ))}
              <td onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { if (confirm(t('common.confirmDelete'))) remove.mutate(row.id); }} title={t('common.delete')} />
              </td>
            </tr>
          ))}
          {/* Rangée d'ajout direct */}
          <tr className="inline-newrow" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commitDraft(); }}>
            {fields.map((f) => (
              <td key={f.key} className="cell">
                {f.type === 'select' ? (
                  <select className="cell-input" value={draft[f.key] ?? cfg.defaults?.[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" className="checkbox" checked={!!Number(draft[f.key])} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked ? 1 : 0 })} />
                ) : (
                  <input
                    className={`cell-input ${f.type === 'number' ? 'num' : ''}`}
                    type={f.type === 'number' ? 'number' : 'text'}
                    placeholder={f.label}
                    value={draft[f.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(); }}
                  />
                )}
              </td>
            ))}
            <td>
              <Button variant="ghost" size="sm" icon={Plus} onClick={commitDraft} disabled={!draftDirty || create.isPending} title={t('common.add')} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Parsing copier-coller (TSV/CSV) ───────────────────────────
function parseTable(raw) {
  const text = (raw || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!text.trim()) return { rows: [], cols: 0 };
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const delim = lines.some((l) => l.includes('\t')) ? '\t' : (lines.some((l) => l.includes(';')) ? ';' : ',');
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
  const cols = Math.max(...rows.map((r) => r.length));
  return { rows, cols, delim };
}

// Normalise un texte pour le rapprochement d'en-têtes (minuscules, sans accents).
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function toNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[\s $]/g, '');
  if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.'); // virgule décimale
  else s = s.replace(/,/g, '');                      // séparateurs de milliers
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}
const truthy = (raw) => /^(1|oui|yes|true|vrai|x)$/i.test(String(raw || '').trim());

/**
 * Import par copier-coller avec mapping de colonnes (rent roll volumineux, etc.).
 * Colle un tableau (Excel/Sheets = TSV), mappe chaque colonne vers un champ, aperçu, importe.
 */
export function PasteImportModal({ cfg, propertyId, onClose, onDone }) {
  const { t } = useI18n();
  const fields = (cfg.importFields || cfg.fields).filter((f) => f.type !== 'textarea' && f.type !== 'inclusions');
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const parsed = useMemo(() => parseTable(raw), [raw]);
  const [mapping, setMapping] = useState({}); // colIndex -> fieldKey | ''

  // Auto-mapping par rapprochement des en-têtes dès qu'on colle des données.
  const headerRow = hasHeader && parsed.rows.length ? parsed.rows[0] : null;
  React.useEffect(() => {
    if (!parsed.cols) return;
    const next = {};
    for (let i = 0; i < parsed.cols; i++) {
      const h = headerRow ? slug(headerRow[i]) : '';
      const match = fields.find((f) => h && (slug(f.label) === h || slug(f.key) === h || slug(f.label).includes(h) || h.includes(slug(f.key))));
      next[i] = match ? match.key : '';
    }
    setMapping(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, hasHeader]);

  const dataRows = hasHeader ? parsed.rows.slice(1) : parsed.rows;
  const fieldByKey = (k) => fields.find((f) => f.key === k);

  const buildRows = () => dataRows.map((cells) => {
    const obj = { property_id: propertyId };
    for (let i = 0; i < parsed.cols; i++) {
      const key = mapping[i];
      if (!key) continue;
      const f = fieldByKey(key);
      const cell = cells[i];
      if (cell === undefined || cell === '') continue;
      obj[key] = f.type === 'number' ? toNumber(cell) : f.type === 'checkbox' ? (truthy(cell) ? 1 : 0) : cell;
    }
    return obj;
  });

  const doImport = useMutation({
    mutationFn: () => api.post(`/${cfg.path}/bulk`, { rows: buildRows() }),
    onSuccess: (res) => { onDone(res); onClose(); },
  });

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <Modal
      title={t('imp.title')}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" icon={Upload} disabled={!dataRows.length || !mappedCount || doImport.isPending}
            onClick={() => doImport.mutate()}>
            {t('imp.import')}{dataRows.length ? ` (${dataRows.length})` : ''}
          </Button>
        </>
      )}
    >
      {doImport.isError && <div className="notice notice-warn"><AlertTriangle size={16} />{String(doImport.error?.message)}</div>}
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t('imp.hint')}</div>
      <Textarea rows={6} value={raw} placeholder={t('imp.placeholder')} onChange={(e) => setRaw(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      {parsed.cols > 0 && (
        <>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, margin: '12px 0' }}>
            <input type="checkbox" className="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            {t('imp.hasHeader')}
          </label>
          <div className="section-label">{t('imp.mapping')} · {mappedCount}/{parsed.cols}</div>
          <div className="paste-preview">
            <table className="table">
              <thead>
                <tr>
                  {Array.from({ length: parsed.cols }).map((_, i) => (
                    <th key={i}>
                      <Select value={mapping[i] ?? ''} onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}>
                        <option value="">{t('imp.ignore')}</option>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </Select>
                      {headerRow && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{headerRow[i]}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 8).map((cells, r) => (
                  <tr key={r}>{Array.from({ length: parsed.cols }).map((_, i) => <td key={i}>{cells[i] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {dataRows.length > 8 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('imp.more').replace('{n}', dataRows.length - 8)}</div>}
        </>
      )}
    </Modal>
  );
}

export default EntityTable;
