import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserSearch, Building2, Sparkles, Info } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Field, Input } from '../components/ui.jsx';
import JobProgress from '../components/JobProgress.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Generate() {
  const [mode, setMode] = useState('contact');
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Generate Leads</h1><div className="page-subtitle">Find new contacts and companies from the public web — the engine searches, crawls, extracts and verifies.</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${mode === 'contact' ? 'active' : ''}`} onClick={() => setMode('contact')}>Find a contact</button>
        <button className={`tab ${mode === 'company' ? 'active' : ''}`} onClick={() => setMode('company')}>Discover companies</button>
      </div>

      <div className="grid grid-2">
        {mode === 'contact' ? <FindContact /> : <DiscoverCompanies />}
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}><Info size={16} style={{ color: 'var(--color-info)' }} /><strong>How it works</strong></div>
          <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {mode === 'contact'
              ? 'Give a company and a target title (e.g. "VP of Sales"). The engine generates search queries, crawls the company site and top results, then extracts and verifies the best email, phone and LinkedIn — exactly the original "company + title → coordinates" workflow, rebuilt and owned.'
              : 'Describe the kind of companies you want (e.g. "boat dealers in Ontario"). The engine searches the public web, opens each distinct site, and creates a company record with website, description and socials.'}
          </p>
          <div className="divider" />
          <p className="muted" style={{ fontSize: 12 }}>
            Free web search can be rate-limited from some networks. For maximum reliability, add a Google Programmable Search key in <Link to="/settings">Settings</Link>, or connect a search provider in the <Link to="/marketplace">Marketplace</Link>. Direct crawling, email-pattern generation and verification always work without search.
          </p>
        </Card>
      </div>
    </div>
  );
}

function FindContact() {
  const toast = useToast();
  const [form, setForm] = useState({ company_name: '', domain: '', title: '', location: '', count: 1 });
  const [jobId, setJobId] = useState(null);
  const run = useMutation({
    mutationFn: () => api.post('/discover/contact', { ...form, count: Number(form.count) || 1 }),
    onSuccess: (job) => { setJobId(job.id); toast.info('Searching…'); },
    onError: (e) => toast.error(e.message),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Card>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}><UserSearch size={18} style={{ color: 'var(--color-accent)' }} /><h3>Find a contact</h3></div>
      <Field label="Company name"><Input value={form.company_name} onChange={set('company_name')} placeholder="Northwind Marine" /></Field>
      <Field label="Company domain (optional, improves accuracy)"><Input value={form.domain} onChange={set('domain')} placeholder="northwindmarine.com" /></Field>
      <div className="field-row">
        <Field label="Target title"><Input value={form.title} onChange={set('title')} placeholder="VP of Sales" /></Field>
        <Field label="Location (optional)"><Input value={form.location} onChange={set('location')} placeholder="Toronto, ON" /></Field>
      </div>
      <Button variant="primary" icon={Sparkles} disabled={run.isPending || (!form.company_name && !form.domain)} onClick={() => run.mutate()}>Find contact</Button>
      {jobId && <div style={{ marginTop: 16 }}><JobProgress jobId={jobId} label="Contact discovery" onDone={() => toast.success('Done — check Contacts')} /><Link to="/contacts" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>View contacts</Link></div>}
    </Card>
  );
}

function DiscoverCompanies() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [jobId, setJobId] = useState(null);
  const run = useMutation({
    mutationFn: () => api.post('/discover/companies', { query, limit: Number(limit) || 10 }),
    onSuccess: (job) => { setJobId(job.id); toast.info('Searching…'); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}><Building2 size={18} style={{ color: 'var(--color-accent)' }} /><h3>Discover companies</h3></div>
      <Field label="What companies are you looking for?"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="boat dealers in Ontario" /></Field>
      <Field label="Max companies"><Input type="number" min="1" max="30" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
      <Button variant="primary" icon={Sparkles} disabled={run.isPending || query.length < 2} onClick={() => run.mutate()}>Discover</Button>
      {jobId && <div style={{ marginTop: 16 }}><JobProgress jobId={jobId} label="Company discovery" onDone={() => toast.success('Done — check Companies')} /><Link to="/companies" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>View companies</Link></div>}
    </Card>
  );
}
