import { makeRepo } from './_factory.js';

export const Evaluations = makeRepo({
  table: 'evaluations',
  idPrefix: 'evl',
  writable: [
    'tenant_id', 'property_id', 'title', 'as_of', 'expected_point', 'expected_low', 'expected_high',
    'listing_price', 'sold_count', 'subject', 'ignored', 'result', 'notes',
  ],
  jsonCols: ['subject', 'ignored', 'result'],
  searchCols: ['title'],
  sortCols: ['as_of', 'expected_point', 'created_at', 'updated_at'],
  filterCols: ['property_id'],
});

export default Evaluations;
