import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

async function waitForDatabase(pool: Pool) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1); // 3s, 6s, 12s, 24s, 48s
      console.log(
        `数据库未就绪 (尝试 ${attempt}/${MAX_RETRIES})，${delay / 1000}s 后重试...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function runMigrations(
  connectionString: string,
  migrationsFolder: string,
) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await waitForDatabase(pool);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
