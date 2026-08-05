import bcrypt from 'bcryptjs';
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
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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
      created_by INTEGER REFERENCES users(id),
      resolved_by INTEGER REFERENCES users(id),
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE incidents
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'docker', 'kubernetes')),
      ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200),
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS resolved_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
  `);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  const adminResult = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [adminUsername],
  );

  let adminId;
  if (adminResult.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const created = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'admin')
       RETURNING id`,
      [adminUsername, passwordHash],
    );
    adminId = created.rows[0].id;
    console.log(`Seeded admin user '${adminUsername}'. Change its password!`);
  } else {
    adminId = adminResult.rows[0].id;
  }

  await pool.query(
    'UPDATE incidents SET created_by = $1 WHERE created_by IS NULL',
    [adminId],
  );

  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM incidents');

  if (countResult.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO incidents (title, description, severity, status, source, source_ref, created_by)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7),
         ($8, $9, $10, $11, $12, $13, $14),
         ($15, $16, $17, $18, $19, $20, $21),
         ($22, $23, $24, $25, $26, $27, $28)`,
      [
        'API response time increased',
        'The checkout API is responding more slowly than normal.',
        'high',
        'investigating',
        'manual',
        null,
        adminId,
        'Nightly backup completed late',
        'The database backup completed successfully after a delay.',
        'medium',
        'resolved',
        'manual',
        null,
        adminId,
        'Container restarted in a crash loop',
        'The web-api container keeps restarting with exit code 1.',
        'high',
        'open',
        'docker',
        'web-api',
        adminId,
        'Pod stuck in CrashLoopBackOff',
        'The payments pod cannot start; the liveness probe is failing.',
        'critical',
        'open',
        'kubernetes',
        'payments/payments-7d8f6c9b55',
        adminId,
      ],
    );
  }
}
