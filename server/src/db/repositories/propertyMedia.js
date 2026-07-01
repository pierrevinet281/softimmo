import { makeRepo } from './_factory.js';

// Photos de propriété (téléversées) — alimentent les brochures et le marketing.
export const PropertyMedia = makeRepo({
  table: 'property_media',
  idPrefix: 'media',
  writable: ['tenant_id', 'property_id', 'role', 'kind', 'position', 'file_path', 'filename', 'mime'],
  searchCols: ['filename', 'role'],
  sortCols: ['position', 'role', 'created_at'],
  filterCols: ['property_id', 'role', 'kind'],
  defaults: { role: 'gallery', kind: 'photo', position: 0 },
});

export default PropertyMedia;
