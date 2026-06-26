import { makeRepo } from './_factory.js';

export const Documents = makeRepo({
  table: 'documents',
  idPrefix: 'doc',
  writable: [
    'tenant_id', 'property_id', 'client_id', 'doc_type', 'title', 'template', 'lang',
    'format', 'status', 'version', 'data', 'pdf_path', 'pptx_path', 'notes',
  ],
  jsonCols: ['data'],
  searchCols: ['title', 'doc_type', 'template'],
  sortCols: ['title', 'doc_type', 'status', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'client_id', 'doc_type', 'status'],
  defaults: { lang: 'fr', status: 'draft', version: 1 },
});

export default Documents;
