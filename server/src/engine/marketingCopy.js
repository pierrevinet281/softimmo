// Module 4 — Générateur d'annonces texte DÉTERMINISTE (sans IA au runtime, CLAUDE.md §3).
// Produit, à partir des données de la propriété, les formats courts/moyens (Kijiji, Facebook,
// Marketplace, Instagram, X, LinkedIn) en respectant les limites de caractères (docs/07).
// Conformité (docs/06) : mention agence + courtier + désignation injectée automatiquement ;
// FR prééminent (Loi 96) ; emojis optionnels ; jamais de titre « spécialiste » ni « VENDU ».
//
// Moteur PUR : prend un bundle de données, retourne des chaînes. Aucune persistance.

const GENRE = {
  fr: {
    unifamilial: 'Maison unifamiliale', condo: 'Condo', plex: 'Plex', multi: 'Immeuble à logements',
    commercial: 'Local commercial', industriel: 'Bâtiment industriel', terrain: 'Terrain',
    rpa: 'Logement en résidence pour aînés', autre: 'Propriété',
  },
  en: {
    unifamilial: 'Single-family home', condo: 'Condo', plex: 'Plex', multi: 'Multi-unit building',
    commercial: 'Commercial space', industriel: 'Industrial building', terrain: 'Land',
    rpa: 'Seniors residence unit', autre: 'Property',
  },
};

const EMO = { spark: '✨', pin: '📍', cal: '🗓', key: '🗝', phone: '📲', home: '🏡', check: '✅' };

function fmtPrice(p) {
  if (p == null || p === '') return null;
  return `${Math.round(Number(p)).toLocaleString('fr-CA').replace(/ /g, ' ')} $`;
}
function fmtArea(a) {
  if (a == null || a === '') return null;
  return `${Math.round(Number(a)).toLocaleString('fr-CA').replace(/ /g, ' ')} pi²`;
}
function clamp(s, max) {
  s = (s || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
function e(on, sym) { return on ? `${sym} ` : ''; }

// ── Faits dérivés communs ──
function facts(bundle, lang) {
  const p = bundle.property || {};
  const b = (bundle.buildings || [])[0] || {};
  const units = bundle.units || [];
  const beds = units.reduce((s, u) => s + (Number(u.bedrooms) || 0), 0) || null;
  const baths = units.reduce((s, u) => s + (Number(u.bathrooms) || 0), 0) || null;
  const tx = (bundle.transactions || []).find((t) => ['inscription', 'en_vigueur'].includes(t.status) && t.price);
  const genre = GENRE[lang][p.genre] || GENRE[lang].autre;
  const cityProv = [p.city, p.province].filter(Boolean).join(', ');
  return {
    genre, city: p.city || '', cityProv, beds, baths,
    area: fmtArea(b.livable_area), areaRaw: b.livable_area,
    land: fmtArea(b.land_area), yearBuilt: b.year_built,
    price: fmtPrice(tx ? tx.price : null), priceRaw: tx ? tx.price : null,
    address: [p.address, p.city].filter(Boolean).join(', '),
    mls: p.mls_number || '', genreKey: p.genre || 'autre',
    summary: (p.summary || '').trim(),
    url: p.brochure_qr_url || (bundle.broker && bundle.broker.web) || '',
  };
}

function bedsBaths(f, lang) {
  const parts = [];
  if (f.beds) parts.push(lang === 'en' ? `${f.beds} bed` : `${f.beds} ch.`);
  if (f.baths) parts.push(lang === 'en' ? `${f.baths} bath` : `${f.baths} sdb`);
  if (f.area) parts.push(f.area);
  return parts.join(' · ');
}

// Mention de conformité OACIQ (agence + courtier + désignation).
function mention(broker, lang) {
  const name = broker.name || 'Courtier';
  const title = [broker.title, broker.subtitle].filter(Boolean).join(' ');
  const agency = broker.agency || '';
  const phone = broker.phone ? (lang === 'en' ? `Tel: ${broker.phone}` : `Tél : ${broker.phone}`) : '';
  return [`${name}${title ? `, ${title}` : ''}`, agency, phone].filter(Boolean).join(' — ');
}

function hook(f, lang, emoji) {
  const E = emoji ? `${EMO.home} ` : '';
  if (lang === 'en') {
    return `${E}Discover this ${f.genre.toLowerCase()}${f.city ? ` in ${f.city}` : ''} — your next address awaits.`;
  }
  return `${E}Découvrez ${f.genre.toLowerCase()}${f.city ? ` à ${f.city}` : ''} — votre prochaine adresse vous attend.`;
}

function bullets(f, lang, emoji) {
  const ck = emoji ? `${EMO.check} ` : '• ';
  const out = [];
  if (f.beds || f.baths) out.push(`${ck}${[f.beds && (lang === 'en' ? `${f.beds} bedrooms` : `${f.beds} chambres`), f.baths && (lang === 'en' ? `${f.baths} bathrooms` : `${f.baths} salles de bain`)].filter(Boolean).join(', ')}`);
  if (f.area) out.push(`${ck}${lang === 'en' ? 'Living area' : 'Surface habitable'} : ${f.area}`);
  if (f.land) out.push(`${ck}${lang === 'en' ? 'Lot' : 'Terrain'} : ${f.land}`);
  if (f.yearBuilt) out.push(`${ck}${lang === 'en' ? 'Built in' : 'Construite en'} ${f.yearBuilt}`);
  if (f.price) out.push(`${ck}${lang === 'en' ? 'Price' : 'Prix'} : ${f.price}`);
  return out;
}

function cta(f, lang, emoji, withUrl = true) {
  const cal = emoji ? `${EMO.cal} ` : '';
  const base = lang === 'en' ? `${cal}Book your visit today.` : `${cal}Réservez votre visite dès aujourd'hui.`;
  return withUrl && f.url ? `${base} ${f.url}` : base;
}

// ── Formats ──
function oneLang(f, broker, lang, emoji) {
  const men = mention(broker, lang);
  const bb = bedsBaths(f, lang);
  const desc = f.summary || (lang === 'en'
    ? `${f.genre}${f.city ? ` in ${f.city}` : ''}. ${bb}.`
    : `${f.genre}${f.city ? ` à ${f.city}` : ''}. ${bb}.`);

  // Kijiji / classée
  const kijTitle = clamp([f.genre, f.city, f.price].filter(Boolean).join(' · '), 70);
  const kijBody = [
    hook(f, lang, emoji), '',
    ...bullets(f, lang, emoji), '',
    desc, '',
    cta(f, lang, emoji), '',
    men,
  ].join('\n');

  // Facebook (hook visible ~125)
  const fbHook = clamp(hook(f, lang, emoji), 125);
  const fb = [fbHook, '', desc, '', cta(f, lang, emoji), '', men].join('\n');

  // Marketplace (PAS d'URL ; champs structurés)
  const mpDesc = [bullets(f, lang, emoji).join('\n'), '', desc, '', cta(f, lang, emoji, false), '', men].join('\n');

  // Instagram (légende + 3-5 hashtags)
  const tags = ['#immobilier', f.city && `#${String(f.city).replace(/\s+/g, '')}`, '#àvendre', '#courtierimmobilier', '#Québec']
    .filter(Boolean).slice(0, 5);
  const ig = [clamp(hook(f, lang, emoji), 125), '', bb, '', cta(f, lang, emoji), '', men, '', tags.join(' ')].join('\n');

  // X / Twitter (fil de posts ≤ 280)
  const t1 = clamp(`1/ ${hook(f, lang, emoji)}`, 280);
  const t2 = clamp(`2/ ${bullets(f, lang, false).join(' · ').replace(/•\s?/g, '')}`, 280);
  const t3 = clamp(`3/ ${cta(f, lang, emoji)} — ${men}`, 280);

  // LinkedIn (ton pro ; 3-5 hashtags en fin)
  const li = [
    clamp(lang === 'en'
      ? `New listing${f.city ? ` in ${f.city}` : ''} — ${f.genre}.`
      : `Nouvelle inscription${f.city ? ` à ${f.city}` : ''} — ${f.genre}.`, 140),
    '', desc, '', bullets(f, lang, false).join('\n'), '', cta(f, lang, emoji), '', men, '',
    ['#immobilier', '#Québec', '#courtage'].join(' '),
  ].join('\n');

  return {
    kijiji: { title: kijTitle, body: kijBody },
    facebook: { text: fb, hook: fbHook },
    marketplace: {
      title: clamp([f.genre, f.city].filter(Boolean).join(' · '), 70),
      description: mpDesc,
      fields: { price: f.price, area: f.area, beds: f.beds, baths: f.baths, type: f.genre, location: f.cityProv },
    },
    instagram: { caption: ig, hashtags: tags },
    twitter: { thread: [t1, t2, t3] },
    linkedin: { text: li },
  };
}

function merge(fr, en) {
  // Bilingue : FR prééminent (Loi 96) puis EN, séparés par un filet.
  const sep = '\n\n— — —\n\n';
  const j = (a, b) => `${a}${sep}${b}`;
  return {
    kijiji: { title: clamp(`${fr.kijiji.title} | ${en.kijiji.title}`, 70), body: j(fr.kijiji.body, en.kijiji.body) },
    facebook: { text: j(fr.facebook.text, en.facebook.text), hook: fr.facebook.hook },
    marketplace: { title: clamp(`${fr.marketplace.title} | ${en.marketplace.title}`, 70), description: j(fr.marketplace.description, en.marketplace.description), fields: fr.marketplace.fields },
    instagram: { caption: j(fr.instagram.caption, en.instagram.caption), hashtags: fr.instagram.hashtags },
    twitter: { thread: [...fr.twitter.thread, ...en.twitter.thread] },
    linkedin: { text: j(fr.linkedin.text, en.linkedin.text) },
  };
}

export function buildMarketingCopy(bundle, opts = {}) {
  const lang = ['fr', 'en', 'bi'].includes(opts.lang) ? opts.lang : 'fr';
  const emoji = !!opts.emoji;
  const broker = bundle.broker || {};
  let formats;
  if (lang === 'bi') {
    formats = merge(oneLang(facts(bundle, 'fr'), broker, 'fr', emoji), oneLang(facts(bundle, 'en'), broker, 'en', emoji));
  } else {
    formats = oneLang(facts(bundle, lang), broker, lang, emoji);
  }
  return {
    lang, emoji, formats,
    disclaimers: [
      'Contenu généré par gabarit déterministe — relire avant publication.',
      'Mentions OACIQ (agence + courtier) incluses. Ne pas employer de titre « spécialiste » prohibé.',
      'Ne pas publier « VENDU » sans le consentement écrit du vendeur.',
    ],
  };
}

export default buildMarketingCopy;
