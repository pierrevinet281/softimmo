import { Router } from 'express';
import meta from './meta.js';
import companies from './companies.js';
import contacts from './contacts.js';
import jobs from './jobs.js';
import engine from './engine.js';
import lists from './lists.js';
import marketplace from './marketplace.js';
import settings from './settings.js';
import io from './io.js';
import mountBusiness from './business.js';

export default function mountRoutes() {
  const r = Router();
  r.use('/', meta);
  r.use('/companies', companies);
  r.use('/contacts', contacts);
  r.use('/jobs', jobs);
  r.use('/', engine);          // /enrich /verify /discover
  r.use('/lists', lists);
  r.use('/providers', marketplace);
  r.use('/settings', settings);
  r.use('/', io);              // /import /export
  r.use('/', mountBusiness()); // Softimmo: /properties /buildings /units /expenses
                               // /transactions /comparables /reports /documents /clients
  return r;
}
