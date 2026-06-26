import React from 'react';
import { Construction } from 'lucide-react';
import { EmptyState } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Generic "coming soon" page for Softimmo modules whose UI isn't built yet.
// The backend infrastructure (DB, routes) already exists for several of these.
export default function Placeholder({ titleKey }) {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{t(titleKey)}</h1>
          <div className="page-subtitle">{t('common.soon')}</div>
        </div>
      </div>
      <EmptyState icon={Construction} title={t('common.soon')} hint={t('common.soon.hint')} />
    </div>
  );
}
