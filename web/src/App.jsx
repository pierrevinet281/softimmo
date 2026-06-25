import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Sparkles, ShieldCheck, ListChecks,
  Upload, Store, Activity as ActivityIcon, Settings as SettingsIcon, Moon, Sun, Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from './api/client.js';

import Dashboard from './pages/Dashboard.jsx';
import Contacts from './pages/Contacts.jsx';
import Companies from './pages/Companies.jsx';
import Generate from './pages/Generate.jsx';
import Verify from './pages/Verify.jsx';
import Lists from './pages/Lists.jsx';
import ImportExport from './pages/ImportExport.jsx';
import Marketplace from './pages/Marketplace.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { section: 'Leads' },
  { to: '/contacts', label: 'Contact Leads', icon: Users, key: 'contacts' },
  { to: '/companies', label: 'Company Leads', icon: Building2, key: 'companies' },
  { to: '/lists', label: 'Leads Lists', icon: ListChecks },
  { section: 'Engine' },
  { to: '/generate', label: 'Generate', icon: Sparkles },
  { to: '/verify', label: 'Verify', icon: ShieldCheck },
  { to: '/import', label: 'Import / Export', icon: Upload },
  { section: 'Platform' },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES = {
  '/': 'Overview', '/contacts': 'Contact Leads', '/companies': 'Company Leads',
  '/lists': 'Leads Lists', '/generate': 'Generate Leads', '/verify': 'Verify', '/import': 'Import / Export',
  '/marketplace': 'Marketplace', '/activity': 'Activity', '/settings': 'Settings',
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
  const location = useLocation();
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats'), refetchInterval: 8000 });
  const counts = { contacts: stats?.contacts, companies: stats?.companies };

  const title = TITLES[location.pathname]
    || (location.pathname.startsWith('/contacts') ? 'Contact Leads' : location.pathname.startsWith('/companies') ? 'Company Leads' : 'Softimmo');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo"><Zap size={18} /></span>
          Softimmo
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) => (
            item.section
              ? <div className="nav-section" key={`s${i}`}>{item.section}</div>
              : (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
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
            <span className="badge badge-accent"><span className="spinner" /> {stats.activeJobs} job{stats.activeJobs > 1 ? 's' : ''} running</span>
          )}
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
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
