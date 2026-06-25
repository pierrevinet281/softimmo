// CLI entry: `npm run migrate` — applies schema.sql.
import { migrate } from './index.js';
migrate();
process.exit(0);
