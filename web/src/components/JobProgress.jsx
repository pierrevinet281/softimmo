import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useJob } from '../hooks/useJob.js';
import { Progress } from './ui.jsx';

// Shows live progress of a background job; calls onDone once when it finishes.
export default function JobProgress({ jobId, label = 'Job', onDone }) {
  const { data: job } = useJob(jobId);
  const qc = useQueryClient();
  const done = job && ['done', 'error', 'canceled'].includes(job.status);

  React.useEffect(() => {
    if (done) {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onDone?.(job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (!job) return null;
  const pct = Math.round((job.progress || 0) * 100);
  const Icon = job.status === 'done' ? CheckCircle2 : job.status === 'error' ? AlertCircle : Loader2;
  const color = job.status === 'done' ? 'var(--color-success)' : job.status === 'error' ? 'var(--color-danger)' : 'var(--color-accent)';

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <Icon size={16} style={{ color }} className={job.status === 'running' || job.status === 'queued' ? 'spin' : ''} />
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <span className="badge badge-neutral">{job.status}</span>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="mono muted" style={{ fontSize: 12 }}>{job.processed}/{job.total}</span>
      </div>
      <Progress value={job.progress || 0} />
      <div className="row muted" style={{ fontSize: 12, marginTop: 8, gap: 14 }}>
        <span>{pct}%</span>
        <span style={{ color: 'var(--color-success)' }}>{job.succeeded} ok</span>
        {job.failed > 0 && <span style={{ color: 'var(--color-danger)' }}>{job.failed} failed</span>}
      </div>
    </div>
  );
}
