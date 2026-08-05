import bcrypt from 'bcryptjs';
import express from 'express';
import session from 'express-session';
import { pool } from './db.js';

export const sessionMiddleware = session({
  name: 'sessionId',
  secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
});

export function requireAuth(request, response, next) {
  if (!request.session?.userId) {
    return response.status(401).json({ message: 'authentication required' });
  }
  return next();
}

export async function requireAdmin(request, response, next) {
  if (!request.session?.userId) {
    return response.status(401).json({ message: 'authentication required' });
  }

  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [request.session.userId],
    );

    if (result.rows.length === 0) {
      request.session.destroy(() => {});
      return response.status(401).json({ message: 'authentication required' });
    }

    if (result.rows[0].role !== 'admin') {
      return response.status(403).json({ message: 'admin access required' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

export const authRouter = express.Router();

authRouter.post('/login', async (request, response, next) => {
  try {
    const { username, password } = request.body;

    if (!username || typeof username !== 'string' || typeof password !== 'string') {
      return response.status(400).json({
        message: 'username and password are required',
      });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1',
      [username.trim()],
    );

    const user = result.rows[0];
    if (!user) {
      return response.status(401).json({ message: 'invalid username or password' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return response.status(401).json({ message: 'invalid username or password' });
    }

    request.session.userId = user.id;
    request.session.role = user.role;

    return response.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    response.clearCookie('sessionId');
    return response.status(204).send();
  });
});

authRouter.get('/me', async (request, response, next) => {
  try {
    if (!request.session?.userId) {
      return response.status(401).json({ message: 'authentication required' });
    }

    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [request.session.userId],
    );

    if (result.rows.length === 0) {
      return response.status(401).json({ message: 'authentication required' });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});
