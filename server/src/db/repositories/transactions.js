import { makeRepo } from './_factory.js';

export const Transactions = makeRepo({
  table: 'transactions',
  idPrefix: 'txn',
  writable: ['tenant_id', 'property_id', 'date', 'status', 'price', 'party_seller', 'party_buyer', 'source', 'notes'],
  searchCols: ['party_seller', 'party_buyer', 'source'],
  sortCols: ['date', 'price', 'status', 'created_at', 'updated_at'],
  filterCols: ['property_id', 'status'],
});

export default Transactions;
