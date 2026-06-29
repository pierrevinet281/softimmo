import { makeRepo } from './_factory.js';

export const Buildings = makeRepo({
  table: 'buildings',
  idPrefix: 'bld',
  writable: [
    'tenant_id', 'property_id', 'label', 'building_type', 'land_area', 'building_area',
    'livable_area', 'floors_basement', 'floors_above', 'floors_total', 'year_built',
    'structure', 'foundation', 'exterior_cladding', 'fenestration', 'roofing', 'flooring', 'notes',
    'address', 'width', 'width_unit', 'length', 'length_unit', 'area_unit',
  ],
  searchCols: ['label', 'building_type'],
  sortCols: ['label', 'building_type', 'year_built', 'created_at', 'updated_at'],
  filterCols: ['property_id'],
});

export default Buildings;
