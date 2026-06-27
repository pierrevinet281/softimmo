import { makeRepo } from './_factory.js';

// Photos de propriété (téléversées) — alimentent les brochures et le marketing.
export const PropertyMedia = makeRepo({
  table: 'property_media',
  idPrefix: 'media',
  writable: ['tenant_id', 'property_id', 'role', 'position', 'file_path', 'filename', 'mime'],
  searchCols: ['filename', 'role'],
  sortCols: ['position', 'role', 'created_at'],
  filterCols: ['property_id', 'role'],
  defaults: { role: 'gallery', position: 0 },
});

export default PropertyMedia;
