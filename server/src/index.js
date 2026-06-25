// Softimmo API server (Express, ESM). Single-user, localhost-only by default.
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import config from './lib/config.js';
import logger from './lib/logger.js';
import { errorMiddleware } from './lib/errors.js';
import { migrate } from './db/index.js';
import { runSeed } from './db/seed.js';
import { startQueue } from './engine/queue.js';
import mountRoutes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. DB ready (schema + reference/marketplace seed; demo only if DB empty & flagged).
migrate();
runSeed({ demo: process.env.SEED_DEMO === '1' });

// 2. App
const app = express();
app.use(cors({ origin: true }));
app.use(compression());
app.use(express.json({ limit: '20mb' }));
if (config.env !== 'test') app.use(morgan('dev'));

// 3. API
app.use('/api', mountRoutes());

// 4. Serve built frontend in production (web/dist) if present.
const webDist = path.resolve(config.root, 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorMiddleware);

// 5. Boot
app.listen(config.port, config.host, () => {
  logger.ok(`Softimmo API on http://${config.host}:${config.port}`);
  logger.info(`Env: ${config.env} · DB: ${path.relative(config.root, config.dbPath)}`);
  startQueue();
});
