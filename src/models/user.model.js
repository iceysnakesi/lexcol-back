const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const UserModel = {
  async findAll() {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, membership_tier, avatar_url, created_at FROM users ORDER BY id'
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, membership_tier, avatar_url, created_at
     FROM users
     WHERE id = $1`,
      [id]
    );

    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  },

  async create({ name, email, password, role = 'user', membership_tier = 'free' }) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role, membership_tier) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, membership_tier, created_at',
      [name, email, hashed, role, membership_tier]
    );
    return rows[0];
  },

  async update(id, { name, email, role, membership_tier }) {
    const { rows } = await pool.query(
      `UPDATE users 
     SET name = COALESCE($1, name), 
         email = COALESCE($2, email), 
         role = COALESCE($3, role), 
         membership_tier = COALESCE($4, membership_tier) 
     WHERE id = $5 
     RETURNING id, name, email, role, membership_tier, avatar_url, created_at`,
      [name, email, role, membership_tier, id]
    );
    return rows[0] || null;
  },

  async updateProfile(id, { name }) {
    const { rows } = await pool.query(
      `UPDATE users
     SET name = $1
     WHERE id = $2
     RETURNING id, name, email, role, membership_tier, avatar_url`,
      [name, id]
    );

    return rows[0] || null;
  },

  async updateAvatar(id, avatar_url) {
    const { rows } = await pool.query(
      `UPDATE users
     SET avatar_url = $1
     WHERE id = $2
     RETURNING id, name, email, role, membership_tier, avatar_url`,
      [avatar_url, id]
    );

    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
  async saveResetToken(email, token, expiresAt) {
    await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
      [token, expiresAt, email]
    );
  },

  async findByResetToken(token) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [token]
    );
    return rows[0] || null;
  },

  async updatePasswordAndClearToken(userId, hashedPassword) {
    await pool.query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hashedPassword, userId]
    );
  },
};

module.exports = UserModel;