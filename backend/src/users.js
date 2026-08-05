import bcrypt from 'bcryptjs';
import express from 'express';
import { requireAdmin } from './auth.js';
import { pool } from './db.js';

export const usersRouter = express.Router();

usersRouter.use(requireAdmin);

usersRouter.get('/', async (_request, response, next) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY id',
    );
    return response.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

usersRouter.post('/', async (request, response, next) => {
  try {
    const { username, password, role = 'user' } = request.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return response.status(400).json({
        message: 'username must be at least 3 characters',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return response.status(400).json({
        message: 'password must be at least 6 characters',
      });
    }

    if (role !== 'admin' && role !== 'user') {
      return response.status(400).json({ message: 'invalid role' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role, created_at`,
        [username.trim(), passwordHash, role],
      );
      return response.status(201).json(result.rows[0]);
    } catch (insertError) {
      if (insertError.code === '23505') {
        return response.status(409).json({ message: 'username already exists' });
      }
      throw insertError;
    }
  } catch (error) {
    return next(error);
  }
});

usersRouter.delete('/:id', async (request, response, next) => {
  try {
    const userId = Number(request.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.status(400).json({ message: 'invalid user id' });
    }

    if (userId === request.session.userId) {
      return response.status(400).json({ message: 'cannot remove your own account' });
    }

    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      if (result.rowCount === 0) {
        return response.status(404).json({ message: 'user not found' });
      }

      return response.status(204).send();
    } catch (deleteError) {
      if (deleteError.code === '23503') {
        return response.status(409).json({
          message: 'user has incidents and cannot be removed',
        });
      }
      throw deleteError;
    }
  } catch (error) {
    return next(error);
  }
});
