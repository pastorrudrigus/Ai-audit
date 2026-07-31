import { createDb } from "@aigate/db";

let _db: ReturnType<typeof createDb> | undefined;

/**
 * Db singleton lazy — inicializa apenas na primeira chamada. Isso evita que
 * o build do Next.js falhe ao coletar dados de rotas quando DATABASE_URL não
 * está definida no ambiente de build (Railway define no runtime).
 */
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required at runtime");
  _db = createDb(url);
  return _db;
}

// Proxy para preservar o `import { db }` usado em toda a app, mas adiando a
// leitura de DATABASE_URL até o primeiro acesso de campo (query, insert, ...).
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    return real[prop];
  },
});
