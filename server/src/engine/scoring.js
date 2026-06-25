// Completeness (0..1) and lead grade (A-D) for contacts and companies.
const CONTACT_WEIGHTS = {
  full_name: 0.15, title: 0.1, company_name: 0.1,
  email: 0.3, phone: 0.15, linkedin: 0.1, location: 0.05, role: 0.05,
};
const COMPANY_WEIGHTS = {
  name: 0.15, domain: 0.2, website: 0.1, industry: 0.1,
  description: 0.1, location: 0.1, phone: 0.1, size: 0.05,
};

function score(entity, weights) {
  let sum = 0;
  let got = 0;
  for (const [field, w] of Object.entries(weights)) {
    sum += w;
    if (entity[field]) got += w;
  }
  return sum ? Math.round((got / sum) * 100) / 100 : 0;
}

// Treat any discrete address part as satisfying "location" (the address can be
// stored as discrete city/address fields instead of the free-text `location`).
const withLocation = (e) => ({ ...e, location: e.location || e.city || e.address || e.postal_code || null });

export function contactCompleteness(c) { return score(withLocation(c), CONTACT_WEIGHTS); }
export function companyCompleteness(c) { return score(withLocation(c), COMPANY_WEIGHTS); }

// Grade combines completeness with the trust of the email (verified > risky > none).
export function gradeContact(c) {
  const comp = contactCompleteness(c);
  const emailGood = c.email && (c.email_status === 'valid');
  const emailRisky = c.email && ['risky', 'catch_all', 'unknown'].includes(c.email_status);
  let pts = comp;
  if (emailGood) pts += 0.15;
  else if (emailRisky) pts += 0.05;
  if (c.phone) pts += 0.05;
  if (pts >= 0.85) return 'A';
  if (pts >= 0.6) return 'B';
  if (pts >= 0.35) return 'C';
  return 'D';
}

export function gradeCompany(c) {
  const comp = companyCompleteness(c);
  if (comp >= 0.8) return 'A';
  if (comp >= 0.55) return 'B';
  if (comp >= 0.3) return 'C';
  return 'D';
}

export default { contactCompleteness, companyCompleteness, gradeContact, gradeCompany };
