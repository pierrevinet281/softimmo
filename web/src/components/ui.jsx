import React from 'react';
import { X, Inbox } from 'lucide-react';

export function Button({ variant = 'outline', size, icon: Icon, children, className = '', ...props }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', !children ? 'btn-icon' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...props}>
      {Icon && <Icon size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...props }) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function Input(props) { return <input className="input" {...props} />; }

// Stable, module-level labeled input — safe to use many times in a form without
// remounting (defining a field component inside render would steal focus).
export function FormField({ label, value, onChange, placeholder, disabled, type }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <input className="input" type={type || 'text'} value={value ?? ''} onChange={onChange} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}
export function Textarea(props) { return <textarea className="textarea" {...props} />; }
export function Select({ children, ...props }) { return <select className="select" {...props}>{children}</select>; }

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const EMAIL_TONE = { valid: 'success', invalid: 'danger', risky: 'warning', catch_all: 'warning', unknown: 'neutral', none: 'neutral' };
export function EmailStatusBadge({ status }) {
  if (!status) return <span className="muted">—</span>;
  return <Badge tone={EMAIL_TONE[status] || 'neutral'}>{status.replace('_', ' ')}</Badge>;
}

const STATUS_TONE = { new: 'neutral', enriched: 'info', verified: 'success', archived: 'neutral' };
export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge>;
}

export function Grade({ grade }) {
  if (!grade) return <span className="muted">—</span>;
  return <span className={`grade grade-${grade}`}>{grade}</span>;
}

export function Modal({ title, onClose, children, footer, size }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div className="empty">
      <Icon size={40} />
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {hint && <div className="muted" style={{ marginBottom: 16 }}>{hint}</div>}
      {action}
    </div>
  );
}

export function Spinner() { return <span className="spinner" />; }

export function Progress({ value = 0 }) {
  return <div className="progress"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}
