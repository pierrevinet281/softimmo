import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plug, Check, ExternalLink, Store } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Field, Input, Modal, Badge } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const CATEGORY_LABELS = {
  lead_source: 'Lead Sources', lead_generation: 'Lead Generation', enrichment: 'Enrichment',
  email_finder: 'Email Finders', verification: 'Verification', extraction: 'Extraction / Scraping',
  data_manipulation: 'Data Manipulation', search: 'Search',
};

export default function Marketplace() {
  const { data } = useQuery({ queryKey: ['providers'], queryFn: () => api.get('/providers') });
  const [connect, setConnect] = useState(null);
  const [filter, setFilter] = useState('');

  const rows = data?.rows || [];
  const categories = data?.categories || [];
  const visible = filter ? rows.filter((p) => p.categories.includes(filter)) : rows;
  const grouped = {};
  for (const p of visible) {
    const cat = p.categories[0] || 'other';
    (grouped[cat] ||= []).push(p);
  }
  const connectedCount = rows.filter((p) => p.connection?.status === 'connected').length;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Marketplace</h1><div className="page-subtitle">Optional third-party providers. The core engine is free and owned — connect these to add extra data sources and credits. {connectedCount} connected.</div></div>
      </div>

      <div className="toolbar">
        <button className={`tab ${!filter ? 'active' : ''}`} onClick={() => setFilter('')} style={{ borderRadius: 6 }}>All</button>
        {categories.map((c) => (
          <button key={c} className={`tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)} style={{ borderRadius: 6 }}>{CATEGORY_LABELS[c] || c}</button>
        ))}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 14 }}>{CATEGORY_LABELS[cat] || cat}</h3>
          <div className="grid grid-3">
            {items.map((p) => {
              const connected = p.connection?.status === 'connected';
              return (
                <Card key={p.id} className={`provider-card ${connected ? '' : 'disconnected'}`}>
                  <div className="pc-head">
                    <div className="provider-logo">{p.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{p.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{p.pricing || (p.is_free ? 'Free' : '')}</div>
                    </div>
                    {connected && <Badge tone="success"><Check size={12} /> Connected</Badge>}
                  </div>
                  <p className="text-secondary" style={{ fontSize: 12, minHeight: 32 }}>{p.description}</p>
                  <div className="provider-cats">
                    {p.categories.map((c) => <span key={c} className="badge badge-neutral">{CATEGORY_LABELS[c] || c}</span>)}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <Button variant={connected ? 'outline' : 'primary'} size="sm" icon={Plug} onClick={() => setConnect(p)}>{connected ? 'Manage' : 'Connect'}</Button>
                    {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon"><ExternalLink size={14} /></a>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {connect && <ConnectModal provider={connect} onClose={() => setConnect(null)} />}
    </div>
  );
}

function ConnectModal({ provider, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const connected = provider.connection?.status === 'connected';
  const [apiKey, setApiKey] = useState('');

  const connect = useMutation({
    mutationFn: () => api.post(`/providers/${provider.slug}/connect`, { credentials: { apiKey } }),
    onSuccess: () => { toast.success(`${provider.name} connected`); qc.invalidateQueries({ queryKey: ['providers'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const disconnect = useMutation({
    mutationFn: () => api.post(`/providers/${provider.slug}/disconnect`, {}),
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({ queryKey: ['providers'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal title={`${connected ? 'Manage' : 'Connect'} ${provider.name}`} onClose={onClose}
      footer={connected
        ? <><Button variant="danger" onClick={() => disconnect.mutate()}>Disconnect</Button><Button variant="ghost" onClick={onClose}>Close</Button></>
        : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={connect.isPending || (provider.auth_type === 'api_key' && !apiKey)} onClick={() => connect.mutate()}>Connect</Button></>}>
      <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>{provider.description}</p>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {provider.categories.map((c) => <span key={c} className="badge badge-neutral">{CATEGORY_LABELS[c] || c}</span>)}
        {provider.is_open_source && <Badge tone="accent">Open source</Badge>}
      </div>
      {connected ? (
        <div className="badge badge-success" style={{ padding: '8px 12px' }}><Check size={14} /> Connected — results from {provider.name} will be imported into your database.</div>
      ) : provider.auth_type === 'api_key' ? (
        <Field label="API key (stored locally on this machine)"><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" /></Field>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>This provider connects manually. After subscribing on their site, you’ll paste exported data into Import, or follow their integration steps. Connecting here marks it as active in your workspace.</p>
      )}
      {provider.website && <a href={provider.website} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}><ExternalLink size={14} /> Open {provider.name}</a>}
    </Modal>
  );
}
