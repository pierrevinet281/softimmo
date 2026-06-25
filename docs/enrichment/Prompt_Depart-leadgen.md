# Prompt de départ — Intégration du module Lead Gen dans Netritious

**Objectif de la session** — Intégrer dans le SaaS Netritious le nouveau module **Lead Gen** que nous avons développé (code complet et autonome dans `lead-gen-code/`). Commence par lire `docs/integration/INTEGRATION-GUIDE.md`, puis `README.md` et `docs/TECHNICAL.md`.

**Mission du module Lead Gen** — Générer, enrichir, vérifier et gérer des leads (entreprises et contacts) à partir du web public, sans frais récurrents.

**Fonctionnalités** — Génération (recherche → crawl → extraction), enrichissement en cascade (email, téléphone, réseaux sociaux, firmographie), vérification (syntaxe/MX/SMTP, téléphone E.164, scoring A–D), gestion (tables, listes, import/export, provenance), Marketplace de connecteurs tiers et couche IA Claude — toutes deux optionnelles.

**Licences** — Tout le code nous appartient à 100 %. Dépendances uniquement permissives (MIT/BSD/Apache/ISC) : aucune restriction commerciale, aucune redevance.

**Architecture et technologies** — Frontend React + Vite (ESM), backend Express + `node:sqlite`, workers Python. Schéma déjà prêt pour le multi-tenant (`tenant_id`) et l'i18n.

**Style** — Déjà basé sur le design system Netritious (tokens, light/dark, Lucide). Adaptations visuelles très minimes.

**Modifications à apporter** — Intégrer la totalité du module sous « Tree View » dans le bloc **CRM** du menu de gauche. Lead Gen devient une **section** (au même titre que Companies); ses sous-sections : Overview, Contact Leads, Company Leads, Leads Lists, Generate, Verify, Import/Export, Marketplace, Activity, Settings.

Après avoir tout lu, présente-moi tes questions; ensuite, nous développerons **en mode non-stop**.
