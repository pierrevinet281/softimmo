import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon } from 'lucide-react';
import api from '../api/client.js';
import { Card, Badge, EmptyState } from '../components/ui.jsx';

export default function ActivityPage() {
  const { data } = useQuery({ queryKey: ['activity-full'], queryFn: () => api.get('/activity?limit=200'), refetchInterval: 5000 });
  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: () => api.get('/jobs?limit=20'), refetchInterval: 4000 });

  return (
    <div className="page">
      <div className="page-header"><div><h1>Activity</h1><div className="page-subtitle">Audit trail of everything that happens in your workspace.</div></div></div>

      <div className="grid grid-2">
        <Card>
          <div className="card-title">Recent jobs</div>
          <div className="col" style={{ marginTop: 12 }}>
            {!jobs?.rows?.length && <div className="muted">No jobs yet.</div>}
            {jobs?.rows?.map((j) => (
              <div key={j.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: 10 }}>
                <Badge tone={j.status === 'done' ? 'success' : j.status === 'error' ? 'danger' : j.status === 'running' ? 'info' : 'neutral'}>{j.status}</Badge>
                <span style={{ flex: 1, fontSize: 13 }}>{j.type}</span>
                <span className="mono muted" style={{ fontSize: 12 }}>{j.succeeded}/{j.total}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>{j.created_at?.slice(5, 16)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-title">Activity log</div>
          <div className="col" style={{ marginTop: 12, maxHeight: 560, overflow: 'auto' }}>
            {!data?.rows?.length && <EmptyState icon={ActivityIcon} title="No activity yet" />}
            {data?.rows?.map((a) => (
              <div key={a.id} className="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: 10 }}>
                <Badge tone="neutral">{a.kind}</Badge>
                <span style={{ flex: 1, fontSize: 13 }}>{a.summary}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>{a.created_at?.slice(5, 16)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
