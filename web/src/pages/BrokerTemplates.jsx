import React, { useState } from 'react';
import { FileText, Download, Eye, LayoutTemplate } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Gabarits de brochure existants (moteurs render_brochure / render_brochure_pptx).
const BROCHURE_TEMPLATES = [
  { key: 'unifamilial', label: 'Unifamiliale', pptx: true },
  { key: 'luxe', label: 'Luxury', pptx: true },
  { key: 'rpa', label: 'RPA · Location', note: 'Format éditorial 6 pages', pptx: false },
  { key: 'commercial', label: 'Commercial', pptx: true },
  { key: 'industriel', label: 'Industriel', pptx: true },
];

const TABS = ['brochures', 'posts', 'presentations'];

function BrochuresTab() {
  const { t } = useI18n();
  return (
    <div className="tpl-grid">
      {BROCHURE_TEMPLATES.map((tpl) => (
        <Card key={tpl.key}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutTemplate size={16} /> {tpl.label}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '2px 0 12px' }}>{tpl.note || tpl.key}</p>
          <div className="toolbar" style={{ marginBottom: 0, gap: 8 }}>
            <Button variant="outline" size="sm" icon={Eye}
              onClick={() => window.open(api.url(`/brochure/templates/${tpl.key}/sample.pdf`), '_blank')}>
              {t('ba.tpl.previewPdf')}
            </Button>
            {tpl.pptx && (
              <a className="file-chip" href={api.url(`/brochure/templates/${tpl.key}/sample.pptx`)}>
                <Download size={14} /> {t('ba.tpl.downloadPptx')}
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function BrokerTemplates() {
  const { t } = useI18n();
  const [tab, setTab] = useState('brochures');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t('nav.ba.templates')}</h1>
          <p className="page-subtitle">{t('ba.intro')}</p>
        </div>
      </div>

      <div className="tpl-tabs">
        {TABS.map((k) => (
          <button key={k} className={`tpl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {t(`ba.tpl.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'brochures' && <BrochuresTab />}
      {tab === 'posts' && (
        <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>
      )}
      {tab === 'presentations' && (
        <Card><EmptyState icon={FileText} title={t('ba.tpl.soon')} hint={t('ba.tpl.soonHint')} /></Card>
      )}
    </div>
  );
}
