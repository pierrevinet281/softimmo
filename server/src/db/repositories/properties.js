import { makeRepo } from './_factory.js';

export const Properties = makeRepo({
  table: 'properties',
  idPrefix: 'prop',
  writable: [
    'tenant_id', 'client_id', 'name', 'genre', 'address', 'city', 'region', 'province',
    'postal_code', 'country', 'zoning', 'num_buildings', 'lot_number', 'area_unit',
    'mls_number', 'brochure_qr_url', 'municipal_assessment', 'assessment_year', 'status', 'summary', 'notes',
    'attributes', 'transaction_type', 'zoning_detail',
  ],
  jsonCols: ['attributes'],
  searchCols: ['name', 'address', 'city', 'mls_number', 'lot_number'],
  sortCols: ['name', 'city', 'genre', 'status', 'created_at', 'updated_at'],
  filterCols: ['genre', 'status', 'client_id', 'city'],
  defaults: { genre: 'unifamilial', province: 'QC', country: 'Canada', num_buildings: 1, area_unit: 'pi2', status: 'prospect' },
});

export default Properties;
