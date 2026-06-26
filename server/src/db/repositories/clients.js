import { makeRepo } from './_factory.js';

export const Clients = makeRepo({
  table: 'clients',
  idPrefix: 'cli',
  writable: [
    'tenant_id', 'kind', 'full_name', 'org_name', 'email', 'phone', 'contact_id',
    'consent_given', 'consent_at', 'consent_scope', 'notes',
  ],
  searchCols: ['full_name', 'org_name', 'email'],
  sortCols: ['full_name', 'kind', 'created_at', 'updated_at'],
  filterCols: ['kind', 'contact_id'],
  defaults: { kind: 'seller', consent_given: 0 },
});

export default Clients;
