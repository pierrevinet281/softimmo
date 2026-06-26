// Mounts CRUD routes for all Softimmo business entities + a property "bundle" endpoint
// that returns a property with all its children (for the Module 1 analysis view).
import { Router } from 'express';
import { z } from 'zod';
import { wrap, notFound } from '../lib/errors.js';
import { makeCrudRouter } from './_crud.js';
import {
  Clients, Properties, Buildings, Units, Expenses, Transactions, Comparables, Reports, Documents,
} from '../db/repositories/index.js';

// Permissive schemas: every field optional + passthrough. Required-on-create is enforced
// by the factory. Enum/type tightening can be layered later without breaking inputs.
const anyObj = z.object({}).passthrough();

const ENTITIES = [
  { path: 'clients',      repo: Clients,      type: 'client',      labelField: 'full_name', required: ['full_name'] },
  { path: 'properties',   repo: Properties,   type: 'property',    labelField: 'name',      required: [] },
  { path: 'buildings',    repo: Buildings,    type: 'building',    labelField: 'label',     required: ['property_id'] },
  { path: 'units',        repo: Units,        type: 'unit',        labelField: 'label',     required: ['property_id'] },
  { path: 'expenses',     repo: Expenses,     type: 'expense',     labelField: 'label',     required: ['property_id', 'category'] },
  { path: 'transactions', repo: Transactions, type: 'transaction', labelField: 'status',    required: ['property_id'] },
  { path: 'comparables',  repo: Comparables,  type: 'comparable',  labelField: 'address',   required: ['property_id'] },
  { path: 'reports',      repo: Reports,      type: 'report',      labelField: 'title',     required: ['property_id'] },
  { path: 'documents',    repo: Documents,    type: 'document',    labelField: 'title',     required: ['doc_type'] },
];

export default function mountBusiness(parent = Router()) {
  for (const e of ENTITIES) {
    parent.use(`/${e.path}`, makeCrudRouter({
      repo: e.repo, entityType: e.type, schema: anyObj,
      requiredOnCreate: e.required, labelField: e.labelField,
    }));
  }

  // Aggregate: a property with all its related records (Module 1 — Analyse de propriété).
  parent.get('/properties/:id/bundle', wrap(async (req, res) => {
    const property = Properties.get(req.params.id);
    if (!property) throw notFound('property introuvable');
    const pid = property.id;
    res.json({
      property,
      client: property.client_id ? Clients.get(property.client_id) : null,
      buildings: Buildings.listBy('property_id', pid),
      units: Units.listBy('property_id', pid),
      expenses: Expenses.listBy('property_id', pid),
      transactions: Transactions.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      comparables: Comparables.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      reports: Reports.listBy('property_id', pid, { sort: 'date', dir: 'desc' }),
      documents: Documents.listBy('property_id', pid, { sort: 'updated_at', dir: 'desc' }),
    });
  }));

  return parent;
}
