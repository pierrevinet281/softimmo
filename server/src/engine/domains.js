// Domain helpers: canonicalize, guess a company domain from its name, and build
// the high-value page URLs worth crawling for contact details.
const STOPWORDS = ['inc', 'llc', 'ltd', 'corp', 'co', 'company', 'group', 'the', 'and', 'services', 'solutions'];

export function canonicalDomain(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (s.includes('@')) s = s.split('@')[1];
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return s || null;
}

// Cheap candidate domains from a company name (no network) — e.g. "Acme Boats" -> acmeboats.com
export function guessDomains(name) {
  if (!name) return [];
  const words = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.includes(w));
  if (!words.length) return [];
  const joined = words.join('');
  const hyphen = words.join('-');
  const first = words[0];
  const tlds = ['com', 'ca', 'net', 'co', 'io'];
  const bases = [...new Set([joined, hyphen, first])];
  const out = [];
  for (const b of bases) for (const t of tlds) out.push(`${b}.${t}`);
  return out.slice(0, 12);
}

// Pages most likely to carry contact info.
export function contactPages(domain) {
  if (!domain) return [];
  const d = canonicalDomain(domain);
  const paths = ['', '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team', '/staff', '/people', '/leadership'];
  return paths.map((p) => `https://${d}${p}`);
}

export default { canonicalDomain, guessDomains, contactPages };
