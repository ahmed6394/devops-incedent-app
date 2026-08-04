import cors from 'cors';
import express from 'express';
import { initializeDatabase, pool, waitForDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT || 5000);
const validSeverities = new Set(['low', 'medium', 'high', 'critical']);
const validStatuses = new Set(['open', 'investigating', 'resolved']);
const validSources = new Set(['manual', 'docker', 'kubernetes']);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.status(200).json({
      service: 'incident-backend',
      status: 'healthy',
      database: 'connected',
    });
  } catch (error) {
    response.status(503).json({
      service: 'incident-backend',
      status: 'unhealthy',
      database: 'disconnected',
      message: error.message,
    });
  }
});

app.get('/api/incidents', async (request, response, next) => {
  try {
    const { source } = request.query;

    if (source !== undefined && !validSources.has(source)) {
      return response.status(400).json({ message: 'invalid source' });
    }

    const columns =
      'id, title, description, severity, status, source, source_ref, created_at, updated_at';

    const result =
      source === undefined
        ? await pool.query(
            `SELECT ${columns} FROM incidents ORDER BY created_at DESC`,
          )
        : await pool.query(
            `SELECT ${columns} FROM incidents WHERE source = $1 ORDER BY created_at DESC`,
            [source],
          );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/incidents', async (request, response, next) => {
  try {
    const {
      title,
      description = '',
      severity = 'medium',
      status = 'open',
      source = 'manual',
      source_ref,
    } = request.body;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return response.status(400).json({
        message: 'title is required and must contain at least 3 characters',
      });
    }

    if (!validSeverities.has(severity)) {
      return response.status(400).json({ message: 'invalid severity' });
    }

    if (!validStatuses.has(status)) {
      return response.status(400).json({ message: 'invalid status' });
    }

    if (!validSources.has(source)) {
      return response.status(400).json({ message: 'invalid source' });
    }

    let normalizedSourceRef = null;
    if (source_ref !== undefined && source_ref !== '') {
      if (typeof source_ref !== 'string') {
        return response.status(400).json({
          message: 'source_ref must be a string',
        });
      }
      const trimmed = source_ref.trim();
      if (trimmed.length > 200) {
        return response.status(400).json({
          message: 'source_ref must be at most 200 characters',
        });
      }
      normalizedSourceRef = trimmed;
    }

    const result = await pool.query(
      `INSERT INTO incidents (title, description, severity, status, source, source_ref)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, severity, status, source, source_ref, created_at, updated_at`,
      [
        title.trim(),
        String(description).trim(),
        severity,
        status,
        source,
        normalizedSourceRef,
      ],
    );

    return response.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/incidents/:id/status', async (request, response, next) => {
  try {
    const incidentId = Number(request.params.id);
    const { status } = request.body;

    if (!Number.isInteger(incidentId) || incidentId <= 0) {
      return response.status(400).json({ message: 'invalid incident id' });
    }

    if (!validStatuses.has(status)) {
      return response.status(400).json({ message: 'invalid status' });
    }

    const result = await pool.query(
      `UPDATE incidents
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, title, description, severity, status, source, source_ref, created_at, updated_at`,
      [status, incidentId],
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ message: 'incident not found' });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/incidents/:id', async (request, response, next) => {
  try {
    const incidentId = Number(request.params.id);

    if (!Number.isInteger(incidentId) || incidentId <= 0) {
      return response.status(400).json({ message: 'invalid incident id' });
    }

    const result = await pool.query('DELETE FROM incidents WHERE id = $1', [
      incidentId,
    ]);

    if (result.rowCount === 0) {
      return response.status(404).json({ message: 'incident not found' });
    }

    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'internal server error' });
});

async function start() {
  try {
    await waitForDatabase();
    await initializeDatabase();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Incident backend listening on port ${port}`);
    });
  } catch (error) {
    console.error('Backend startup failed:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing database connections.`);
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
