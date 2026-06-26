import { makeRepo } from './_factory.js';

export const Comparables = makeRepo({
  table: 'comparables',
  idPrefix: 'cmp',
  writable: [
    'tenant_id', 'property_id', 'address', 'city', 'kind', 'date', 'price', 'area',
    'price_per_area', 'bedrooms', 'bathrooms', 'year_built', 'rating', 'weight',
    'adjustments', 'seller_redacted', 'source', 'notes',
  ],
  jsonCols: ['adjustments'],
  searchCols: ['address', 'city', 'source'],
  sortCols: ['date', 'price', 'price_per_area', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'kind'],
  defaults: { kind: 'sold', seller_redacted: 1 },
});

export default Comparables;
