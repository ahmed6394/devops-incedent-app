import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'incidentdb',
  user: process.env.DB_USER || 'incident_user',
  password: process.env.DB_PASSWORD || 'incident_password',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForDatabase(maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Database connection established.');
      return;
    } catch (error) {
      console.error(
        `Database connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`,
      );

      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(3_000);
    }
  }
}

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved')),
      source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'docker', 'kubernetes')),
      source_ref VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE incidents
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'docker', 'kubernetes')),
      ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
  `);

  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM incidents');

  if (countResult.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO incidents (title, description, severity, status, source, source_ref)
       VALUES
         ($1, $2, $3, $4, $5, $6),
         ($7, $8, $9, $10, $11, $12),
         ($13, $14, $15, $16, $17, $18),
         ($19, $20, $21, $22, $23, $24)`,
      [
        'API response time increased',
        'The checkout API is responding more slowly than normal.',
        'high',
        'investigating',
        'manual',
        null,
        'Nightly backup completed late',
        'The database backup completed successfully after a delay.',
        'medium',
        'resolved',
        'manual',
        null,
        'Container restarted in a crash loop',
        'The web-api container keeps restarting with exit code 1.',
        'high',
        'open',
        'docker',
        'web-api',
        'Pod stuck in CrashLoopBackOff',
        'The payments pod cannot start; the liveness probe is failing.',
        'critical',
        'open',
        'kubernetes',
        'payments/payments-7d8f6c9b55',
      ],
    );
  }
}
