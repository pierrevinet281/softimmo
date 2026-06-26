import { makeRepo } from './_factory.js';

export const Comparables = makeRepo({
  table: 'comparables',
  idPrefix: 'cmp',
  writable: [
    'tenant_id', 'property_id', 'address', 'city', 'kind', 'centris_no', 'date', 'sale_date',
    'price', 'list_price', 'sold_price', 'area', 'livable_area', 'price_per_area', 'bedrooms',
    'bathrooms', 'year_built', 'municipal_assessment', 'days_on_market', 'inclusions', 'rating',
    'foundation', 'cladding', 'windows_type', 'flooring', 'windows_age', 'roof_age',
    'weight', 'adjustments', 'seller_redacted', 'source', 'notes',
  ],
  jsonCols: ['adjustments', 'inclusions'],
  searchCols: ['address', 'city', 'source'],
  sortCols: ['date', 'price', 'price_per_area', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'kind'],
  defaults: { kind: 'sold', seller_redacted: 1 },
});

export default Comparables;
