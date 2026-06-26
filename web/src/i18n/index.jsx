// Minimal bilingual (FR/EN) i18n — no external dependency. Default FR (Québec).
// Usage: const { t, lang, setLang } = useI18n();  then t('nav.properties').
import React, { createContext, useContext, useEffect, useState } from 'react';

const DICT = {
  fr: {
    'app.tagline': 'Assistant de courtage immobilier',
    'nav.overview': "Vue d'ensemble",
    'sec.mandates': 'Mandats',
    'nav.properties': 'Propriétés',
    'nav.clients': 'Clients',
    'sec.analysis': 'Analyse & Évaluation',
    'nav.evaluation': 'Évaluation',
    'sec.promo': 'Mise en marché',
    'nav.brokerAssets': 'Assets courtier',
    'nav.offers': 'Offre de services',
    'nav.startKit': 'Trousse démarrage',
    'nav.marketingKit': 'Trousse marketing',
    'sec.crm': 'Contacts (CRM)',
    'nav.contacts': 'Contacts',
    'nav.companies': 'Entreprises',
    'nav.lists': 'Listes',
    'nav.generate': 'Générer',
    'nav.verify': 'Vérifier',
    'nav.io': 'Import / Export',
    'sec.platform': 'Plateforme',
    'nav.marketplace': 'Marketplace',
    'nav.activity': 'Activité',
    'nav.settings': 'Réglages',
    'common.new': 'Nouveau',
    'common.cancel': 'Annuler',
    'common.create': 'Créer',
    'common.delete': 'Supprimer',
    'common.search': 'Rechercher',
    'common.name': 'Nom',
    'common.city': 'Ville',
    'common.type': 'Type',
    'common.status': 'Statut',
    'common.actions': 'Actions',
    'common.soon': 'Bientôt disponible',
    'common.soon.hint': "Ce module fait partie de la feuille de route Softimmo. L'infrastructure est en place ; les fonctions arrivent dans une prochaine session.",
    'prop.title': 'Propriétés',
    'prop.subtitle': 'Les biens (sujets de vos mandats) — tout genre.',
    'prop.new': 'Nouvelle propriété',
    'prop.empty': 'Aucune propriété pour le moment.',
    'prop.genre': 'Genre',
    'theme.toggle': 'Changer le thème',
  },
  en: {
    'app.tagline': 'Real-estate brokerage assistant',
    'nav.overview': 'Overview',
    'sec.mandates': 'Mandates',
    'nav.properties': 'Properties',
    'nav.clients': 'Clients',
    'sec.analysis': 'Analysis & Valuation',
    'nav.evaluation': 'Valuation',
    'sec.promo': 'Marketing',
    'nav.brokerAssets': 'Broker assets',
    'nav.offers': 'Service offer',
    'nav.startKit': 'Start-up kit',
    'nav.marketingKit': 'Marketing kit',
    'sec.crm': 'Contacts (CRM)',
    'nav.contacts': 'Contacts',
    'nav.companies': 'Companies',
    'nav.lists': 'Lists',
    'nav.generate': 'Generate',
    'nav.verify': 'Verify',
    'nav.io': 'Import / Export',
    'sec.platform': 'Platform',
    'nav.marketplace': 'Marketplace',
    'nav.activity': 'Activity',
    'nav.settings': 'Settings',
    'common.new': 'New',
    'common.cancel': 'Cancel',
    'common.create': 'Create',
    'common.delete': 'Delete',
    'common.search': 'Search',
    'common.name': 'Name',
    'common.city': 'City',
    'common.type': 'Type',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.soon': 'Coming soon',
    'common.soon.hint': 'This module is on the Softimmo roadmap. The infrastructure is in place; features arrive in an upcoming session.',
    'prop.title': 'Properties',
    'prop.subtitle': 'The assets (subjects of your mandates) — any genre.',
    'prop.new': 'New property',
    'prop.empty': 'No properties yet.',
    'prop.genre': 'Genre',
    'theme.toggle': 'Toggle theme',
  },
};

const I18nContext = createContext({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('softimmo-lang') || 'fr');
  useEffect(() => {
    localStorage.setItem('softimmo-lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);
  const t = (key) => (DICT[lang] && DICT[lang][key]) || DICT.fr[key] || key;
  return <I18nContext.Provider value={{ lang, setLang: setLangState, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
export default useI18n;
