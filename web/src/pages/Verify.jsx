import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShieldCheck, Mail } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, EmailStatusBadge } from '../components/ui.jsx';
import JobProgress from '../components/JobProgress.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Verify() {
  const toast = useToast();
  const [jobId, setJobId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('unknown');

  // Fetch contacts with an email matching the filter to verify in bulk.
  const { data } = useQuery({ queryKey: ['verify-candidates', statusFilter], queryFn: () => api.get(`/contacts?limit=500&email_status=${statusFilter}`) });
  const candidates = (data?.rows || []).filter((c) => c.email);

  const run = useMutation({
    mutationFn: () => api.post('/verify', { ids: candidates.map((c) => c.id) }),
    onSuccess: (job) => { setJobId(job.id); toast.info(`Verifying ${candidates.length} contacts`); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Verify</h1><div className="page-subtitle">Validate emails (syntax · MX · optional SMTP) and normalize phone numbers.</div></div>
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} /><h3>Bulk verify</h3></div>
          <div className="field">
            <label>Verify contacts whose email status is</label>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="unknown">Unknown</option>
              <option value="risky">Risky</option>
              <option value="">Any (re-verify all)</option>
            </select>
          </div>
          <p className="text-secondary" style={{ fontSize: 13 }}>{candidates.length} contact{candidates.length !== 1 ? 's' : ''} with an email match this filter.</p>
          <Button variant="primary" icon={ShieldCheck} disabled={!candidates.length || run.isPending} onClick={() => run.mutate()}>Verify {candidates.length || ''} contacts</Button>
          <div className="divider" />
          <p className="muted" style={{ fontSize: 12 }}>Tip: enable the SMTP deliverability probe in Settings for stronger validation (off by default to protect your IP reputation). Without it, results are syntax + MX based.</p>
          {jobId && <div style={{ marginTop: 14 }}><JobProgress jobId={jobId} label="Verification" onDone={() => toast.success('Verification complete')} /></div>}
        </Card>

        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Mail size={18} style={{ color: 'var(--color-info)' }} /><h3>Candidates</h3></div>
          {!candidates.length && <div className="muted">No contacts match.</div>}
          <div className="col" style={{ maxHeight: 420, overflow: 'auto' }}>
            {candidates.slice(0, 100).map((c) => (
              <div key={c.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-strong" style={{ fontSize: 13 }}>{c.full_name || c.email}</div>
                  <div className="mono muted" style={{ fontSize: 11 }}>{c.email}</div>
                </div>
                <EmailStatusBadge status={c.email_status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
