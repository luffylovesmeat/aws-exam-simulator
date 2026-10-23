// Local server: serves the React app and persists exam attempts to a JSON file.
//
//   npm run dev     -> Vite dev server (HMR) + API, one process
//   npm run build && npm start -> serves the built app + API
//
// The database is a plain JSON file (default: data/db.json). Override with DB_PATH.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(root, 'data', 'db.json');
const PORT = Number(process.env.PORT) || 5173;
const HOST = '127.0.0.1'; // local only
const prod = process.argv.includes('--prod');

// ---- tiny JSON "database" -------------------------------------------------

// Serialize read-modify-write cycles so concurrent requests can't clobber each other.
let chain = Promise.resolve();
const locked = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

async function readDb() {
  let raw;
  try {
    raw = await fs.readFile(DB_PATH, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { version: 1, attempts: [] };
    throw e;
  }
  // JSON.parse throws on a corrupt file; we then refuse to write rather than overwrite it.
  const db = JSON.parse(raw);
  if (!db || !Array.isArray(db.attempts)) throw new Error('db.json has an unexpected shape');
  return db;
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_PATH); // atomic replace
}

function validateAttempt(a) {
  if (!a || typeof a !== 'object') return 'body must be an object';
  if (typeof a.seed !== 'string' || !a.seed) return 'seed is required';
  if (typeof a.certId !== 'string' || !a.certId) return 'certId is required';
  if (!Array.isArray(a.answers)) return 'answers must be an array';
  if (!Number.isFinite(a.scaledScore)) return 'scaledScore must be a number';
  return null;
}

// ---- API -------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '10mb' }));

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'server error' });
  });

app.get('/api/attempts', wrap(async (_req, res) => {
  const db = await readDb();
  res.json({ attempts: db.attempts });
}));

app.post('/api/attempts', wrap(async (req, res) => {
  const problem = validateAttempt(req.body);
  if (problem) return res.status(400).json({ error: problem });
  const saved = await locked(async () => {
    const db = await readDb();
    const id = typeof req.body.id === 'string' && req.body.id ? req.body.id : crypto.randomUUID();
    const existing = db.attempts.find((a) => a.id === id);
    if (existing) return existing; // idempotent: the same attempt saved twice is stored once
    const attempt = { ...req.body, id, savedAt: new Date().toISOString() };
    db.attempts.push(attempt);
    await writeDb(db);
    return attempt;
  });
  res.status(201).json({ attempt: saved });
}));

app.delete('/api/attempts/:id', wrap(async (req, res) => {
  const removed = await locked(async () => {
    const db = await readDb();
    const before = db.attempts.length;
    db.attempts = db.attempts.filter((a) => a.id !== req.params.id);
    if (db.attempts.length === before) return false;
    await writeDb(db);
    return true;
  });
  if (!removed) return res.status(404).json({ error: 'attempt not found' });
  res.json({ ok: true });
}));

app.get('/api/export', wrap(async (_req, res) => {
  const db = await readDb();
  res.setHeader('Content-Disposition', 'attachment; filename="aws-exam-db.json"');
  res.json(db);
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// ---- front end -------------------------------------------------------------

if (prod) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, HOST, () => {
  console.log(`AWS Exam Simulator: http://localhost:${PORT}  (${prod ? 'production' : 'dev'})`);
  console.log(`Results database:   ${DB_PATH}`);
});
