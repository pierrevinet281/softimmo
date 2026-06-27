import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Sparkles, ShieldCheck, ListChecks,
  Upload, Store, Activity as ActivityIcon, Settings as SettingsIcon, Moon, Sun, Zap,
  Home, FileBarChart, Megaphone, FileText, LifeBuoy, Contact, Briefcase,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from './api/client.js';
import { useI18n } from './i18n/index.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Evaluation from './pages/Evaluation.jsx';
import Offres from './pages/Offres.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import Placeholder from './pages/Placeholder.jsx';
import Contacts from './pages/Contacts.jsx';
import Companies from './pages/Companies.jsx';
import Generate from './pages/Generate.jsx';
import Verify from './pages/Verify.jsx';
import Lists from './pages/Lists.jsx';
import ImportExport from './pages/ImportExport.jsx';
import Marketplace from './pages/Marketplace.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import Settings from './pages/Settings.jsx';

// Navigation grouped by Softimmo module. `key` shows a live count from /stats.
const NAV = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard, end: true },
  { sectionKey: 'sec.mandates' },
  { to: '/properties', labelKey: 'nav.properties', icon: Building2 },
  { to: '/clients', labelKey: 'nav.clients', icon: Home },
  { sectionKey: 'sec.analysis' },
  { to: '/evaluation', labelKey: 'nav.evaluation', icon: FileBarChart },
  { sectionKey: 'sec.promo' },
  { to: '/assets-courtier', labelKey: 'nav.brokerAssets', icon: Briefcase },
  { to: '/offres', labelKey: 'nav.offers', icon: FileText },
  { to: '/trousse-demarrage', labelKey: 'nav.startKit', icon: LifeBuoy },
  { to: '/trousse-marketing', labelKey: 'nav.marketingKit', icon: Megaphone },
  { sectionKey: 'sec.crm' },
  { to: '/contacts', labelKey: 'nav.contacts', icon: Users, key: 'contacts' },
  { to: '/companies', labelKey: 'nav.companies', icon: Contact, key: 'companies' },
  { to: '/lists', labelKey: 'nav.lists', icon: ListChecks },
  { to: '/generate', labelKey: 'nav.generate', icon: Sparkles },
  { to: '/verify', labelKey: 'nav.verify', icon: ShieldCheck },
  { to: '/import', labelKey: 'nav.io', icon: Upload },
  { sectionKey: 'sec.platform' },
  { to: '/marketplace', labelKey: 'nav.marketplace', icon: Store },
  { to: '/activity', labelKey: 'nav.activity', icon: ActivityIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

// path -> label key, for the topbar title.
const TITLE_KEY = {
  '/': 'nav.overview', '/properties': 'nav.properties', '/clients': 'nav.clients',
  '/evaluation': 'nav.evaluation', '/assets-courtier': 'nav.brokerAssets', '/offres': 'nav.offers',
  '/trousse-demarrage': 'nav.startKit', '/trousse-marketing': 'nav.marketingKit',
  '/contacts': 'nav.contacts', '/companies': 'nav.companies',
  '/lists': 'nav.lists', '/generate': 'nav.generate', '/verify': 'nav.verify',
  '/import': 'nav.io', '/marketplace': 'nav.marketplace', '/activity': 'nav.activity',
  '/settings': 'nav.settings',
};

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('softimmo-theme') || localStorage.getItem('leadgen-theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('softimmo-theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats'), refetchInterval: 8000 });
  const counts = { contacts: stats?.contacts, companies: stats?.companies };

  const title = t(TITLE_KEY[location.pathname] || 'app.tagline');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo"><Zap size={18} /></span>
          Softimmo
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) => (
            item.sectionKey
              ? <div className="nav-section" key={`s${i}`}>{t(item.sectionKey)}</div>
              : (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <item.icon size={18} />
                  <span>{t(item.labelKey)}</span>
                  {item.key && counts[item.key] != null && <span className="count">{counts[item.key]}</span>}
                </NavLink>
              )
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="spacer" />
          {stats?.activeJobs > 0 && (
            <span className="badge badge-accent"><span className="spinner" /> {stats.activeJobs} job{stats.activeJobs > 1 ? 's' : ''}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} title="FR / EN">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={t('theme.toggle')}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/assets-courtier" element={<Placeholder titleKey="nav.brokerAssets" />} />
          <Route path="/offres" element={<Offres />} />
          <Route path="/trousse-demarrage" element={<Placeholder titleKey="nav.startKit" />} />
          <Route path="/trousse-marketing" element={<Placeholder titleKey="nav.marketingKit" />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/lists/:id" element={<Lists />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/import" element={<ImportExport />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
