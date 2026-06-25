import { getDb } from '../index.js';
import { newId, now } from '../helpers.js';

export const Provenance = {
  record({ entity_type, entity_id, field, value, source, method, confidence = null, verified = 0, tenant_id = null }) {
    const db = getDb();
    const id = newId('prov');
    db.prepare(`INSERT INTO field_provenance
      (id,tenant_id,entity_type,entity_id,field,value,source,method,confidence,verified,observed_at)
      VALUES (@id,@tenant_id,@entity_type,@entity_id,@field,@value,@source,@method,@confidence,@verified,@observed_at)`)
      .run({ id, tenant_id, entity_type, entity_id, field, value: value == null ? null : String(value), source: source ?? null, method: method ?? null, confidence, verified: verified ? 1 : 0, observed_at: now() });
    return id;
  },

  forEntity(entity_type, entity_id) {
    return getDb().prepare('SELECT * FROM field_provenance WHERE entity_type = ? AND entity_id = ? ORDER BY observed_at DESC')
      .all(entity_type, entity_id);
  },
};

export default Provenance;
