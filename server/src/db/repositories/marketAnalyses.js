import { makeRepo } from './_factory.js';

export const MarketAnalyses = makeRepo({
  table: 'market_analyses',
  idPrefix: 'mka',
  writable: ['tenant_id', 'property_id', 'title', 'municipality', 'mrc', 'region', 'report', 'notes'],
  jsonCols: ['report'],
  searchCols: ['title', 'municipality', 'mrc', 'region'],
  sortCols: ['created_at', 'updated_at'],
  filterCols: ['property_id'],
});

export default MarketAnalyses;
