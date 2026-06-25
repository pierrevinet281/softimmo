import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Building2, Mail, Phone, Sparkles, Upload, ShieldCheck } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Badge } from '../components/ui.jsx';

function Stat({ label, value, sub, icon: Icon }) {
  return (
    <Card>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="label" style={{ color: 'var(--color-text-tertiary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
        {Icon && <Icon size={18} style={{ color: 'var(--color-accent)' }} />}
      </div>
      <div className="stat"><div className="value">{value ?? '—'}</div>{sub && <div className="sub">{sub}</div>}</div>
    </Card>
  );
}

function Bar({ data, colors }) {
  const total = data.reduce((s, d) => s + d.n, 0) || 1;
  return (
    <div>
      <div className="row" style={{ height: 10, borderRadius: 6, overflow: 'hidden', gap: 0 }}>
        {data.map((d, i) => <div key={d.key} style={{ width: `${(d.n / total) * 100}%`, background: colors[i % colors.length] }} title={`${d.key}: ${d.n}`} />)}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {data.map((d, i) => (
          <span key={d.key} className="row muted" style={{ fontSize: 12, gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i % colors.length] }} />
            {d.key} <strong style={{ color: 'var(--color-text-primary)' }}>{d.n}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats'), refetchInterval: 6000 });
  const { data: activity } = useQuery({ queryKey: ['activity'], queryFn: () => api.get('/activity?limit=8') });

  const emailData = (stats?.contactsByEmail || []).map((d) => ({ key: d.s, n: d.n }));
  const gradeData = (stats?.contactsByGrade || []).map((d) => ({ key: d.g, n: d.n }));
  const emailColors = ['var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-neutral)', 'var(--color-info)'];
  const gradeColors = ['var(--color-success)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-neutral)'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Overview</h1>
          <div className="page-subtitle">Your lead database at a glance.</div>
        </div>
        <div className="spacer" />
        <Link to="/generate"><Button variant="primary" icon={Sparkles}>Generate leads</Button></Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Contacts" value={stats?.contacts} icon={Users} />
        <Stat label="Companies" value={stats?.companies} icon={Building2} />
        <Stat label="With email" value={stats?.withEmail} sub={stats?.contacts ? `${Math.round((stats.withEmail / stats.contacts) * 100)}% of contacts` : ''} icon={Mail} />
        <Stat label="With phone" value={stats?.withPhone} sub={stats?.contacts ? `${Math.round((stats.withPhone / stats.contacts) * 100)}% of contacts` : ''} icon={Phone} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <div className="card-title">Email quality</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>Verification status across all contacts</div>
          {emailData.length ? <Bar data={emailData} colors={emailColors} /> : <div className="muted">No data yet</div>}
        </Card>
        <Card>
          <div className="card-title">Lead grades</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>A = complete & verified, D = sparse</div>
          {gradeData.length ? <Bar data={gradeData} colors={gradeColors} /> : <div className="muted">No data yet</div>}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="card-title">Quick actions</div>
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            <Link to="/generate"><Button variant="outline" icon={Sparkles} className="full">Find a contact (company + title)</Button></Link>
            <Link to="/import"><Button variant="outline" icon={Upload} className="full">Import a CSV / Excel list</Button></Link>
            <Link to="/verify"><Button variant="outline" icon={ShieldCheck} className="full">Verify emails & phones</Button></Link>
          </div>
        </Card>
        <Card>
          <div className="card-title">Recent activity</div>
          <div className="col" style={{ marginTop: 12 }}>
            {!activity?.rows?.length && <div className="muted">Nothing yet.</div>}
            {activity?.rows?.map((a) => (
              <div key={a.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', gap: 10 }}>
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
