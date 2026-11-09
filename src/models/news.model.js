const pool = require('../config/db');
const db = pool.pool || pool;

const NewsModel = {
    async findAll({ page = 1, limit = 6, search = '', includeHidden = false } = {}) {
        const offset = (page - 1) * limit;
        const params = [];
        let where = includeHidden ? 'WHERE 1=1' : 'WHERE is_hidden = FALSE';
        let idx = 1;

        if (search) {
            where += ` AND (title ILIKE $${idx} OR content::text ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        const count = await db.query(`SELECT COUNT(*) FROM news ${where}`, params);
        const totalItems = parseInt(count.rows[0].count);

        const rows = await db.query(
            `SELECT id, title, cover_image_url, content, is_hidden, added_by, created_at
             FROM news ${where}
             ORDER BY created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, limit, offset]
        );

        return { totalItems, rows: rows.rows };
    },

    async findById(id) {
        const { rows } = await db.query('SELECT * FROM news WHERE id = $1', [id]);
        return rows[0] || null;
    },

    async create({ title, cover_image_url, content, added_by }) {
        const { rows } = await db.query(
            `INSERT INTO news (title, cover_image_url, content, added_by)
             VALUES ($1, $2, $3::jsonb, $4)
             RETURNING *`,
            [title, cover_image_url, JSON.stringify(content), added_by]
        );
        return rows[0];
    },

    async toggleVisibility(id) {
        const { rows } = await db.query(
            `UPDATE news SET is_hidden = NOT is_hidden WHERE id = $1
             RETURNING id, is_hidden`,
            [id]
        );
        return rows[0] || null;
    },

    async delete(id) {
        const { rows } = await db.query(
            'DELETE FROM news WHERE id = $1 RETURNING id', [id]
        );
        return rows[0] || null;
    },

    async getActiveMotd() {
        const { rows } = await db.query(
            `SELECT id, message, created_at FROM motd_messages
             WHERE is_active = TRUE
             ORDER BY created_at DESC LIMIT 1`
        );
        return rows[0] || null;
    },

    async setMotd({ message, created_by }) {
        // Deactivate all previous, insert new active one in a transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE motd_messages SET is_active = FALSE WHERE is_active = TRUE');
            const { rows } = await client.query(
                `INSERT INTO motd_messages (message, created_by, is_active)
                 VALUES ($1, $2, TRUE) RETURNING *`,
                [message, created_by]
            );
            await client.query('COMMIT');
            return rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },
};

module.exports = NewsModel;