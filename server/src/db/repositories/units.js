import { makeRepo } from './_factory.js';

export const Units = makeRepo({
  table: 'units',
  idPrefix: 'unit',
  writable: [
    'tenant_id', 'property_id', 'building_id', 'label', 'unit_type', 'area', 'bedrooms',
    'bathrooms', 'rent_monthly', 'lease_type', 'lease_end', 'is_vacant', 'occupant',
    'other_income', 'notes',
  ],
  searchCols: ['label', 'unit_type', 'occupant'],
  sortCols: ['label', 'unit_type', 'rent_monthly', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'building_id', 'is_vacant'],
  defaults: { is_vacant: 0 },
});

export default Units;
