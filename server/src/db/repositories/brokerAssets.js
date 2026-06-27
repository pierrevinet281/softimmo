import { makeRepo } from './_factory.js';

// Assets du courtier (matériel marketing du courtier lui-même) — voir docs/01.
// Réutilisables dans les offres, brochures et le marketing.
export const BrokerAssets = makeRepo({
  table: 'broker_assets',
  idPrefix: 'asset',
  writable: ['tenant_id', 'name', 'asset_type', 'category', 'lang', 'text', 'file_path', 'filename', 'mime', 'tags', 'notes', 'position'],
  jsonCols: ['tags'],
  searchCols: ['name', 'category', 'notes', 'text'],
  sortCols: ['name', 'asset_type', 'category', 'position', 'created_at', 'updated_at'],
  filterCols: ['asset_type', 'category', 'lang'],
  defaults: { asset_type: 'autre', position: 0 },
});

export default BrokerAssets;
