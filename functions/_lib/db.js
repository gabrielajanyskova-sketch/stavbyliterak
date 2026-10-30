// Obsah webu v D1. Tabulky se vytvoří a naplní výchozím obsahem samy při
// prvním požadavku — žádné ruční SQL není potřeba.
import seed from './seed.json';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS site (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS pages (slug TEXT PRIMARY KEY, position INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS images (key TEXT PRIMARY KEY, name TEXT, content_type TEXT, size INTEGER, created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, attempt_count INTEGER NOT NULL, window_start TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_codes (login_id TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`,
];

let ready = false;

export async function ensureDb(env) {
  if (ready || !env.DB) return;
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM site').first();
  if (!row || row.n === 0) {
    const now = new Date().toISOString();
    const stmts = [env.DB.prepare('INSERT OR IGNORE INTO site (id, data, updated_at) VALUES (1, ?, ?)').bind(JSON.stringify(seed.site), now)];
    seed.pages.forEach((p, i) => {
      stmts.push(
        env.DB.prepare('INSERT OR IGNORE INTO pages (slug, position, data, updated_at) VALUES (?, ?, ?, ?)').bind(p.slug, i, JSON.stringify(p), now)
      );
    });
    await env.DB.batch(stmts);
  }
  ready = true;
}

// Bez napojené databáze (např. náhled bez bindingu) web pořád běží z výchozího obsahu.
export async function getSite(env) {
  if (!env.DB) return seed.site;
  const row = await env.DB.prepare('SELECT data, updated_at FROM site WHERE id = 1').first();
  return row ? Object.assign(JSON.parse(row.data), { updated_at: row.updated_at }) : seed.site;
}

export async function getPages(env, { includeDrafts = false } = {}) {
  const list = env.DB
    ? (await env.DB.prepare('SELECT slug, position, data, updated_at FROM pages ORDER BY position, slug').all()).results.map((r) =>
        Object.assign(JSON.parse(r.data), { slug: r.slug, position: r.position, updated_at: r.updated_at })
      )
    : seed.pages.map((p, i) => Object.assign({}, p, { position: i }));
  return includeDrafts ? list : list.filter((p) => p.published);
}

export async function saveSite(env, data) {
  await env.DB.prepare('UPDATE site SET data = ?, updated_at = ? WHERE id = 1').bind(JSON.stringify(data), new Date().toISOString()).run();
}

export async function savePage(env, slug, data, position) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO pages (slug, position, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(slug, position, JSON.stringify(data), now)
    .run();
}

export async function renameAndSavePage(env, oldSlug, newSlug, data) {
  // One statement preserves the old row if the new slug already exists.
  await env.DB.prepare('UPDATE pages SET slug = ?, data = ?, updated_at = ? WHERE slug = ?')
    .bind(newSlug, JSON.stringify(data), new Date().toISOString(), oldSlug).run();
}

export async function deletePage(env, slug) {
  await env.DB.prepare('DELETE FROM pages WHERE slug = ?').bind(slug).run();
}

export async function reorderPages(env, slugs) {
  await env.DB.batch(slugs.map((s, i) => env.DB.prepare('UPDATE pages SET position = ? WHERE slug = ?').bind(i, s)));
}
