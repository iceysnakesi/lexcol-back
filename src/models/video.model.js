const pool = require('../config/db');
const db = pool.pool || pool; // supports either export shape

const VideoModel = {
    async findAll({ page = 1, limit = 9, channelId = null, includeHidden = false } = {}) {
        const offset = (page - 1) * limit;
        const params = [];
        let where = includeHidden ? 'WHERE 1=1' : 'WHERE is_hidden = FALSE';
        let idx = 1;

        if (channelId) {
            where += ` AND channel_id = $${idx++}`;
            params.push(channelId);
        }

        const count = await db.query(
            `SELECT COUNT(*) FROM videos ${where}`, params
        );
        const totalItems = parseInt(count.rows[0].count);

        const rows = await db.query(
            `SELECT id, youtube_id, preview_youtube_id, channel_id, channel_name,
                    title, thumbnail_url, duration_seconds, published_at,
                    is_hidden, created_at
             FROM videos ${where}
             ORDER BY published_at DESC NULLS LAST, created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, limit, offset]
        );

        return { totalItems, rows: rows.rows };
    },

    async findAllAdmin({ page = 1, limit = 9 } = {}) {
        const offset = (page - 1) * limit;
        const count = await db.query('SELECT COUNT(*) FROM videos');
        const totalItems = parseInt(count.rows[0].count);
        const rows = await db.query(
            `SELECT * FROM videos
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return { totalItems, rows: rows.rows };
    },

    async findById(id) {
        const { rows } = await db.query(
            'SELECT * FROM videos WHERE id = $1', [id]
        );
        return rows[0] || null;
    },

    async findByYoutubeId(youtubeId) {
        const { rows } = await db.query(
            'SELECT * FROM videos WHERE youtube_id = $1', [youtubeId]
        );
        return rows[0] || null;
    },

    async create(data) {
        const { rows } = await db.query(
            `INSERT INTO videos
                (youtube_id, preview_youtube_id, channel_id, channel_name,
                 title, thumbnail_url, duration_seconds, published_at,
                 added_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [
                data.youtube_id,
                data.preview_youtube_id || null,
                data.channel_id,
                data.channel_name,
                data.title,
                data.thumbnail_url,
                data.duration_seconds,
                data.published_at,
                data.added_by || null,
            ]
        );
        return rows[0];
    },

    async toggleVisibility(id) {
        const { rows } = await db.query(
            `UPDATE videos SET is_hidden = NOT is_hidden
             WHERE id = $1 RETURNING id, is_hidden`,
            [id]
        );
        return rows[0] || null;
    },

    async delete(id) {
        const { rows } = await db.query(
            'DELETE FROM videos WHERE id = $1 RETURNING id', [id]
        );
        return rows[0] || null;
    },

    async getChannels() {
        const { rows } = await db.query(
            `SELECT DISTINCT channel_id, channel_name
             FROM videos WHERE is_hidden = FALSE AND channel_id IS NOT NULL
             ORDER BY channel_name ASC`
        );
        return rows;
    },
};

module.exports = VideoModel;