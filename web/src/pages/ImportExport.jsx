import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileSpreadsheet, ArrowRight } from 'lucide-react';
import api from '../api/client.js';
import { Button, Card, Field } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function ImportExport() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef();
  const [entity, setEntity] = useState('contacts');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.upload(`/import/preview?entity=${entity}`, fd);
      setPreview(res);
      setMapping(res.suggestedMapping || {});
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function doImport() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity', entity);
      fd.append('mapping', JSON.stringify(mapping));
      const res = await api.upload('/import', fd);
      toast.success(`Imported ${res.created} ${entity} (${res.skipped} skipped)`);
      qc.invalidateQueries({ queryKey: [entity] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setFile(null); setPreview(null); setMapping({});
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header"><div><h1>Import / Export</h1><div className="page-subtitle">Bring leads in from CSV / Excel, or export your database.</div></div></div>

      <div className="grid grid-2">
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Upload size={18} style={{ color: 'var(--color-accent)' }} /><h3>Import</h3></div>
          <Field label="Import as">
            <select className="select" value={entity} onChange={(e) => { setEntity(e.target.value); setPreview(null); setFile(null); }}>
              <option value="contacts">Contacts</option><option value="companies">Companies</option>
            </select>
          </Field>
          <Field label="CSV or Excel file">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onPick} className="input" style={{ paddingTop: 7 }} />
          </Field>

          {busy && <div className="muted">Working…</div>}

          {preview && (
            <>
              <div className="divider" />
              <div className="row" style={{ marginBottom: 10 }}><strong>Column mapping</strong><span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{preview.total} rows</span></div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Match your file columns to lead fields. Auto-detected matches are pre-filled.</p>
              {preview.fields.map((f) => (
                <div className="row" key={f} style={{ gap: 10, marginBottom: 8 }}>
                  <span className="badge badge-neutral" style={{ width: 120, justifyContent: 'flex-start' }}>{f.replace('_', ' ')}</span>
                  <ArrowRight size={14} className="muted" />
                  <select className="select" style={{ flex: 1 }} value={mapping[f] || ''} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}>
                    <option value="">— skip —</option>
                    {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              <Button variant="primary" icon={Upload} disabled={busy} onClick={doImport} style={{ marginTop: 14 }}>Import {preview.total} rows</Button>
            </>
          )}
        </Card>

        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><Download size={18} style={{ color: 'var(--color-info)' }} /><h3>Export</h3></div>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>Download your full database. Filtered exports are also available from the Contacts / Companies search bars.</p>
          {['contacts', 'companies'].map((ent) => (
            <div key={ent} style={{ marginBottom: 16 }}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}><FileSpreadsheet size={16} className="muted" /><strong style={{ textTransform: 'capitalize' }}>{ent}</strong></div>
              <div className="row" style={{ gap: 8 }}>
                {['csv', 'xlsx', 'json'].map((fmt) => (
                  <a key={fmt} href={api.url(`/export?entity=${ent}&format=${fmt}`)}>
                    <Button variant="outline" size="sm">{fmt.toUpperCase()}</Button>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
