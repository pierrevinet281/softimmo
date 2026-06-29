import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

// Champ Ville : boîte de recherche + menu déroulant des municipalités (Québec). Sélectionner une
// option renvoie aussi la région administrative (association automatique). Voir lib/quebecGeo.
export default function CityField({ value, onSelect, placeholder }) {
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { data } = useQuery({
    queryKey: ['geo-muni', q],
    queryFn: () => api.get(`/geo/municipalities?q=${encodeURIComponent(q)}`),
    enabled: open,
  });
  const rows = data?.rows || [];

  return (
    <div className="combo" ref={boxRef}>
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); onSelect(e.target.value, null, null); }}
        onFocus={() => setOpen(true)}
      />
      {open && rows.length > 0 && (
        <div className="combo-menu">
          {rows.map((m) => (
            <button
              type="button"
              key={m.name}
              className="combo-opt"
              onClick={() => { onSelect(m.name, m.region, m.mrc); setQ(m.name); setOpen(false); }}
            >
              {m.name} <span className="muted">· {m.region}{m.mrc ? ` · ${m.mrc}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
