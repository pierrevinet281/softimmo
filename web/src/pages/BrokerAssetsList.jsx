import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Select, Badge, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

export const ASSET_TYPES = ['logo', 'portrait', 'buste', 'carte', 'bio', 'signature', 'accroche', 'certificat', 'hero', 'autre'];

const TONE = { logo: 'info', portrait: 'accent', buste: 'accent', carte: 'neutral', bio: 'neutral', signature: 'neutral', accroche: 'warning', certificat: 'success', hero: 'info', autre: 'neutral' };

export default function BrokerAssetsList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');

  const params = new URLSearchParams({ limit: '500', sort: 'updated_at', dir: 'desc' });
  if (q) params.set('q', q);
  if (type) params.set('asset_type', type);
  const { data } = useQuery({ queryKey: ['broker-assets', q, type], queryFn: () => api.get(`/broker-assets?${params.toString()}`) });
  const rows = data?.rows || [];

  const del = useMutation({
    mutationFn: (id) => api.del(`/broker-assets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broker-assets'] }),
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.brokerAssets')}</h1>
          <p className="page-subtitle">{t('ba.intro')}</p>
        </div>
        <span className="spacer" />
        <Button variant="primary" icon={Plus} onClick={() => navigate('/assets-courtier/edit')}>{t('ba.add')}</Button>
      </div>

      <div className="toolbar">
        <div className="input-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={16} />
          <Input placeholder={t('ba.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">{t('ba.allTypes')}</option>
          {ASSET_TYPES.map((ty) => <option key={ty} value={ty}>{t(`ba.t.${ty}`)}</option>)}
        </Select>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={ImageIcon} title={t('ba.empty')} hint={t('ba.emptyHint')} /></Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 56 }} />
                <th>{t('ba.col.name')}</th>
                <th>{t('ba.col.type')}</th>
                <th>{t('ba.col.category')}</th>
                <th>{t('ba.col.lang')}</th>
                <th>{t('ba.col.updated')}</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/assets-courtier/edit/${a.id}`)}>
                  <td>
                    {a.file_path && (a.mime || '').startsWith('image/')
                      ? <img src={api.url(`/broker-assets/${a.id}/raw`)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
                      : a.file_path
                        ? <span className="thumb-icon"><FileText size={18} /></span>
                        : <span className="thumb-icon muted"><ImageIcon size={16} /></span>}
                  </td>
                  <td className="cell-strong">{a.name}</td>
                  <td><Badge tone={TONE[a.asset_type] || 'neutral'}>{t(`ba.t.${a.asset_type}`) || a.asset_type}</Badge></td>
                  <td>{a.category || <span className="muted">—</span>}</td>
                  <td>{a.lang ? a.lang.toUpperCase() : <span className="muted">—</span>}</td>
                  <td className="muted">{(a.updated_at || '').slice(0, 10)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon={Trash2}
                      onClick={() => { if (window.confirm(t('ba.confirmDelete'))) del.mutate(a.id); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
