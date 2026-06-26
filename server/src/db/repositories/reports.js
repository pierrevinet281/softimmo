import { makeRepo } from './_factory.js';

export const Reports = makeRepo({
  table: 'reports',
  idPrefix: 'rpt',
  writable: ['tenant_id', 'property_id', 'report_type', 'title', 'date', 'url', 'file_path', 'results', 'notes'],
  jsonCols: ['results'],
  searchCols: ['title', 'report_type'],
  sortCols: ['date', 'report_type', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'report_type'],
});

export default Reports;
