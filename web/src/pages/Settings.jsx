import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Globe, Search, Save, CheckCircle2, XCircle } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Field, Input, Badge } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Settings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: () => api.get('/health'), refetchInterval: 10000 });

  const [ai, setAi] = useState({});
  const [crawl, setCrawl] = useState({});
  const [search, setSearch] = useState({});
  useEffect(() => { if (settings) { setAi(settings.ai); setCrawl(settings.crawl); setSearch(settings.search); } }, [settings]);

  // settings uses PUT
  const put = async (body) => {
    try {
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['health'] });
    } catch (e) { toast.error(e.message); }
  };

  if (!settings) return <div className="page"><Card><div className="muted">Loading…</div></Card></div>;

  return (
    <div className="page">
      <div className="page-header"><div><h1>Settings</h1><div className="page-subtitle">Configure the engine. All keys are stored locally on this machine.</div></div></div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* AI */}
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Sparkles size={18} style={{ color: 'var(--color-accent)' }} /><h3>AI layer (Claude)</h3>{ai.enabled && health?.ai ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Off</Badge>}</div>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 14 }}>Enables smart query generation, entity resolution (homonym handling), confidence scoring and title normalization. Optional — the engine works without it.</p>
          <label className="row" style={{ gap: 8, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" className="checkbox" checked={!!ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
            <span>Enable AI features</span>
          </label>
          <Field label="Anthropic API key">
            <Input type="password" placeholder={ai.apiKeySet ? ai.apiKeyMasked : 'sk-ant-…'} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} />
          </Field>
          <Field label="Model"><Input value={ai.model || ''} onChange={(e) => setAi({ ...ai, model: e.target.value })} placeholder="claude-opus-4-8" /></Field>
          <Button variant="primary" icon={Save} onClick={() => put({ ai })}>Save AI settings</Button>
        </Card>

        {/* System health */}
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Globe size={18} style={{ color: 'var(--color-info)' }} /><h3>System status</h3></div>
          <dl className="kv">
            <dt>Python engine</dt>
            <dd>{health?.python?.ok ? <span className="row" style={{ gap: 6 }}><CheckCircle2 size={15} style={{ color: 'var(--color-success)' }} /> Ready</span> : <span className="row" style={{ gap: 6 }}><XCircle size={15} style={{ color: 'var(--color-danger)' }} /> {health?.python?.error || 'Not available'}</span>}</dd>
            <dt>AI layer</dt><dd>{health?.ai ? 'Enabled' : 'Disabled'}</dd>
          </dl>
          <div className="divider" />
          <div className="row" style={{ gap: 8, marginBottom: 12 }}><Search size={16} className="muted" /><strong style={{ fontSize: 14 }}>Search provider (optional)</strong></div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Free web search can be rate-limited from some networks. Add a Google Programmable Search key for reliable results, or point to a self-hosted SearXNG instance.</p>
          <Field label="Google CSE API key"><Input type="password" placeholder={search.cseKeySet ? search.cseKeyMasked : 'AIza…'} onChange={(e) => setSearch({ ...search, cseKey: e.target.value })} /></Field>
          <Field label="Google CSE engine ID (cx)"><Input value={search.cseCx || ''} onChange={(e) => setSearch({ ...search, cseCx: e.target.value })} /></Field>
          <Field label="SearXNG instance URL"><Input value={search.searxUrl || ''} onChange={(e) => setSearch({ ...search, searxUrl: e.target.value })} placeholder="https://searx.example.com" /></Field>
          <Button variant="primary" icon={Save} onClick={() => put({ search })}>Save search settings</Button>
        </Card>

        {/* Crawl politeness */}
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Globe size={18} style={{ color: 'var(--color-accent)' }} /><h3>Crawling & verification</h3></div>
          <Field label={`Per-domain delay (ms): ${crawl.perDomainDelayMs ?? 1500}`}>
            <input type="range" min="500" max="5000" step="250" value={crawl.perDomainDelayMs ?? 1500} onChange={(e) => setCrawl({ ...crawl, perDomainDelayMs: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Concurrency: ${crawl.concurrency ?? 4}`}>
            <input type="range" min="1" max="10" value={crawl.concurrency ?? 4} onChange={(e) => setCrawl({ ...crawl, concurrency: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" className="checkbox" checked={!!crawl.respectRobots} onChange={(e) => setCrawl({ ...crawl, respectRobots: e.target.checked })} />
            <span>Respect robots.txt</span>
          </label>
          <label className="row" style={{ gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" className="checkbox" checked={!!crawl.smtpProbe} onChange={(e) => setCrawl({ ...crawl, smtpProbe: e.target.checked })} />
            <span>Enable SMTP deliverability probe</span>
          </label>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>The SMTP probe gives stronger email validation but may affect your IP reputation if overused. Off by default.</p>
          <Button variant="primary" icon={Save} onClick={() => put({ crawl })}>Save crawl settings</Button>
        </Card>
      </div>
    </div>
  );
}
