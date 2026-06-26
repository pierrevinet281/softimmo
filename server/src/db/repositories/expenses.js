import { makeRepo } from './_factory.js';

export const Expenses = makeRepo({
  table: 'expenses',
  idPrefix: 'exp',
  writable: ['tenant_id', 'property_id', 'category', 'label', 'amount', 'period', 'notes'],
  searchCols: ['category', 'label'],
  sortCols: ['category', 'amount', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'category'],
  defaults: { period: 'annuel' },
});

export default Expenses;
