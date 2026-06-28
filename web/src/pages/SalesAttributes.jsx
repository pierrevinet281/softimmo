import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Eye, Filter } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Modal, Select, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const QK = ['sales-attributes'];
const FILTERS = ['all', 'selected', 'unselected'];

export default function SalesAttributes() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [preview, setPreview] = useState(null);        // type clé pour l'aperçu du formulaire
  const [selectedType, setSelectedType] = useState('all'); // colonne(s) affichée(s)
  const [colFilter, setColFilter] = useState({});      // { type: 'all'|'selected'|'unselected' }
  const [menuFor, setMenuFor] = useState(null);        // type dont l'entonnoir est ouvert

  const { data, isLoading } = useQuery({ queryKey: QK, queryFn: () => api.get('/sales-attributes') });
  const lab = (o) => (lang === 'en' ? o.label_en : o.label_fr) || o.label_fr;

  const toggle = useMutation({
    mutationFn: ({ attr, type, value }) => api.put('/sales-attributes/cell', { attr, type, value }),
    onMutate: async ({ attr, type, value }) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData(QK);
      qc.setQueryData(QK, (d) => (d ? {
        ...d,
        attributes: d.attributes.map((a) => (a.key === attr ? { ...a, enabled: { ...a.enabled, [type]: value } } : a)),
      } : d));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); },
  });

  const reset = useMutation({
    mutationFn: () => api.post('/sales-attributes/reset', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const types = data?.types || [];
  const categories = data?.categories || [];
  const attributes = data?.attributes || [];

  const visibleTypes = selectedType === 'all' ? types : types.filter((ty) => ty.key === selectedType);
  const passes = (a) => visibleTypes.every((ty) => {
    const f = colFilter[ty.key] || 'all';
    if (f === 'all') return true;
    return f === 'selected' ? !!a.enabled[ty.key] : !a.enabled[ty.key];
  });
  const byCat = (catKey) => attributes.filter((a) => a.category === catKey && passes(a));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('sa.title')}</h1>
          <div className="page-subtitle">{t('sa.subtitle')}</div>
        </div>
        <div className="spacer" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label>{t('sa.typeFilter')}</label>
            <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              <option value="all">{t('sa.allTypes')}</option>
              {types.map((ty) => <option key={ty.key} value={ty.key}>{lab(ty)}</option>)}
            </Select>
          </div>
          <Button
            variant="outline"
            icon={RotateCcw}
            disabled={reset.isPending}
            onClick={() => { if (window.confirm(t('sa.resetConfirm'))) reset.mutate(); }}
          >
            {t('sa.reset')}
          </Button>
        </div>
      </div>

      {menuFor && <div className="sa-menu-backdrop" onClick={() => setMenuFor(null)} />}

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        {isLoading ? (
          <div className="muted" style={{ padding: 24 }}>…</div>
        ) : (
          <table className="table sa-matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>{t('sa.attribute')}</th>
                {visibleTypes.map((ty) => {
                  const f = colFilter[ty.key] || 'all';
                  return (
                    <th key={ty.key} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div className="sa-colhead">
                        <button className="sa-typehead" onClick={() => setPreview(ty.key)} title={t('sa.preview')}>
                          {lab(ty)} <Eye size={13} />
                        </button>
                        <button
                          className={`sa-funnel ${f !== 'all' ? 'active' : ''}`}
                          title={t('sa.filter')}
                          onClick={() => setMenuFor(menuFor === ty.key ? null : ty.key)}
                        >
                          <Filter size={13} />
                        </button>
                      </div>
                      {menuFor === ty.key && (
                        <div className="sa-menu">
                          {FILTERS.map((opt) => (
                            <button
                              key={opt}
                              className={f === opt ? 'active' : ''}
                              onClick={() => { setColFilter({ ...colFilter, [ty.key]: opt }); setMenuFor(null); }}
                            >
                              {t(`sa.f.${opt}`)}
                            </button>
                          ))}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const rows = byCat(c.key);
                if (!rows.length) return null;
                return (
                  <React.Fragment key={c.key}>
                    <tr className="sa-catrow">
                      <td colSpan={visibleTypes.length + 1}>{lab(c)}</td>
                    </tr>
                    {rows.map((a) => (
                      <tr key={a.key}>
                        <td>
                          {lab(a)}
                          {a.unit ? <span className="muted" style={{ fontSize: 12 }}> ({a.unit})</span> : null}
                        </td>
                        {visibleTypes.map((ty) => {
                          const on = !!a.enabled[ty.key];
                          return (
                            <td key={ty.key} style={{ textAlign: 'center' }}>
                              <button
                                className={`switch ${on ? 'on' : ''}`}
                                style={{ marginLeft: 0, display: 'inline-block', verticalAlign: 'middle' }}
                                aria-pressed={on}
                                title={on ? t('sa.yes') : t('sa.no')}
                                onClick={() => toggle.mutate({ attr: a.key, type: ty.key, value: !on })}
                              >
                                <span className="switch-knob" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {preview && <FormPreview type={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function FormPreview({ type, onClose }) {
  const { t, lang } = useI18n();
  const lab = (o) => (lang === 'en' ? o.label_en : o.label_fr) || o.label_fr;
  const { data, isLoading } = useQuery({
    queryKey: ['sa-form', type],
    queryFn: () => api.get(`/sales-attributes/form/${type}`),
  });
  const cats = data?.categories || [];
  const total = cats.reduce((s, c) => s + c.attributes.length, 0);

  return (
    <Modal title={`${t('sa.previewTitle')} — ${type}`} onClose={onClose} size="lg"
      footer={<Button variant="primary" onClick={onClose}>{t('common.close')}</Button>}>
      <div className="muted" style={{ marginBottom: 12 }}>{t('sa.previewHint')}</div>
      {isLoading ? (
        <div className="muted">…</div>
      ) : total === 0 ? (
        <EmptyState title={t('sa.formEmpty')} />
      ) : (
        cats.map((c) => (
          <div key={c.key} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{lab(c)}</div>
            <div className="sa-formgrid">
              {c.attributes.map((a) => (
                <div key={a.key} className="field" style={{ margin: 0 }}>
                  <label>{lab(a)}{a.unit ? ` (${a.unit})` : ''}</label>
                  {a.input === 'bool'
                    ? <select className="select" disabled><option>—</option></select>
                    : <input className="input" disabled placeholder={a.input === 'currency' ? '$' : (a.unit || '')} />}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
