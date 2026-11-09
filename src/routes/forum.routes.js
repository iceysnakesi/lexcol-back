const { Router } = require('express');
const router = Router();
const { pool } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Forum
 *   description: Forum discussions, posts management, and administration
 */

/**
 * @swagger
 * /api/forum:
 *   get:
 *     summary: Retrieve paginated forum posts
 *     tags: [Forum]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword search term for post titles or content
 *     responses:
 *       200:
 *         description: A paginated list of visible forum posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       author_name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const sortDirection = req.query.sort === 'oldest' ? 'ASC' : 'DESC';


        const countQuery = `
      SELECT COUNT(*) FROM posts 
      WHERE is_hidden = false AND (title ILIKE $1 OR content ILIKE $1)
    `;
        const countResult = await pool.query(countQuery, [`%${search}%`]);
        const totalItems = parseInt(countResult.rows[0].count);

        const postsQuery = `
      SELECT p.id, p.title, p.content, p.author_name, p.created_at,
             u.avatar_url AS author_avatar_url
      FROM posts p
      LEFT JOIN users u ON u.id::text = p.author_id::text
      WHERE p.is_hidden = false AND (p.title ILIKE $1 OR p.content ILIKE $1)
      ORDER BY p.created_at ${sortDirection}
      LIMIT $2 OFFSET $3
    `;
        const postsResult = await pool.query(postsQuery, [`%${search}%`, limit, offset]);

        res.json({
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            posts: postsResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching posts' });
    }
});

/**
 * @swagger
 * /api/forum:
 *   post:
 *     summary: Create a new forum post
 *     tags: [Forum]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { title, content } = req.body;
        const authorId = req.user.id;
        const authorName = req.user.name || 'Anonymous';

        if (!title || !title.trim() || !content || !content.trim()) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const query = `
      INSERT INTO posts (title, content, author_id, author_name, is_hidden, created_at)
      VALUES ($1, $2, $3, $4, FALSE, NOW())
      RETURNING *
    `;
        const result = await pool.query(query, [
            title.trim(),
            content.trim(),
            authorId,
            authorName,
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create post error:', err);
        res.status(500).json({
            error: 'Failed to create post',
            ...(process.env.NODE_ENV !== 'production' && {
                code: err.code,
                detail: err.detail,
                message: err.message,
            }),
        });
    }
});

/**
 * @swagger
 * /api/forum/{id}/visibility:
 *   patch:
 *     summary: Toggle show/hide status of a post (Admin only)
 *     tags: [Forum]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Visibility toggled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/visibility', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
      UPDATE posts 
      SET is_hidden = NOT is_hidden 
      WHERE id = $1 
      RETURNING id, is_hidden
    `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update visibility' });
    }
});

/**
 * @swagger
 * /api/forum/{id}:
 *   put:
 *     summary: Edit an existing forum post content (Admin only)
 *     tags: [Forum]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const query = `
      UPDATE posts 
      SET title = $1, content = $2 
      WHERE id = $3 
      RETURNING *
    `;
        const result = await pool.query(query, [title, content, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

/**
 * @swagger
 * /api/forum/admin/all:
 *   get:
 *     summary: Fetch all posts (visible and hidden) for admin management
 *     description: Retrieves a paginated list of all forum posts. Restricted to users with the 'admin' role.
 *     tags:
 *       - Forum
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Successfully retrieved all posts.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Access denied. Admins only.
 *       500:
 *         description: Internal server error.
 */
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM posts');
        const totalItems = parseInt(countResult.rows[0].count);

        const query = `
      SELECT p.*, u.avatar_url AS author_avatar_url
      FROM posts p
      LEFT JOIN users u ON u.id::text = p.author_id::text
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
        const { rows } = await pool.query(query, [limit, offset]);

        res.json({
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            posts: rows,
        });
    } catch (err) {
        console.error('Error fetching admin posts:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT p.*, u.avatar_url AS author_avatar_url
            FROM posts p
            LEFT JOIN users u ON u.id::text = p.author_id::text
            WHERE p.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching admin post:', err);
        res.status(500).json({ error: 'Server error fetching post' });
    }
});

// GET /api/forum/:id - Fetch individual post + replies
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch the post
        const postQuery = `
    SELECT p.*, u.avatar_url AS author_avatar_url
    FROM posts p
    LEFT JOIN users u ON u.id::text = p.author_id::text
    WHERE p.id = $1 AND p.is_hidden = false
`;
        const postResult = await pool.query(postQuery, [id]);

        if (postResult.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // 2. Fetch replies (Wrapped in try/catch or checked so it doesn't 500 if table is missing)
        let repliesRows = [];
        try {
            const repliesQuery = `
    SELECT r.*, u.avatar_url AS author_avatar_url
    FROM replies r
    LEFT JOIN users u ON u.id::text = r.author_id::text
    WHERE r.post_id = $1
    ORDER BY r.created_at ASC
`;
            const repliesResult = await pool.query(repliesQuery, [id]);
            repliesRows = repliesResult.rows;
        } catch (replyErr) {
            console.warn('Replies table might not exist yet:', replyErr.message);
        }

        res.json({
            post: postResult.rows[0],
            replies: repliesRows
        });
    } catch (err) {
        console.error('Error fetching post detail:', err);
        res.status(500).json({ error: 'Server error fetching post' });
    }
});

/**
 * @swagger
 * /api/forum/{id}/replies:
 *   post:
 *     summary: Post a reply to a forum thread
 *     tags: [Forum]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the forum post
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               parent_reply_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Reply created successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.post('/:id/replies', requireAuth, async (req, res) => {
    try {
        const { id: postId } = req.params;
        const { content, parent_reply_id } = req.body;
        const authorId = req.user.id;
        const authorName = req.user.name || 'Anonymous';

        // 1. Verify the post exists
        const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // 2. Insert the reply and join the author's current avatar
        const query = `
            WITH inserted AS (
                INSERT INTO replies (post_id, parent_reply_id, author_id, author_name, content)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            )
            SELECT i.*, u.avatar_url AS author_avatar_url
            FROM inserted i
            LEFT JOIN users u ON u.id::text = i.author_id::text
        `;
        const result = await pool.query(query, [
            postId,
            parent_reply_id || null,
            authorId,
            authorName,
            content
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error posting reply:', err);
        res.status(500).json({ error: 'Failed to post reply' });
    }
});

router.put('/:postId/replies/:replyId', requireAuth, async (req, res) => {
    try {
        const { postId, replyId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const check = await pool.query(
            'SELECT id, author_id FROM replies WHERE id = $1 AND post_id = $2',
            [replyId, postId]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        const isOwner = check.rows[0].author_id?.toString() === String(userId);
        if (!isOwner) {
            return res.status(403).json({ error: 'Not allowed to edit this reply' });
        }

        const result = await pool.query(
            `WITH updated AS (
                UPDATE replies SET content = $1
                WHERE id = $2 AND post_id = $3
                RETURNING *
            )
            SELECT upd.*, usr.avatar_url AS author_avatar_url
            FROM updated upd
            LEFT JOIN users usr ON usr.id::text = upd.author_id::text`,
            [content.trim(), replyId, postId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating reply:', err);
        res.status(500).json({ error: 'Failed to update reply' });
    }
});

router.delete('/:postId/replies/:replyId', requireAuth, async (req, res) => {
    try {
        const { postId, replyId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const check = await pool.query(
            'SELECT id, author_id FROM replies WHERE id = $1 AND post_id = $2',
            [replyId, postId]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        const isOwner = check.rows[0].author_id?.toString() === String(userId);
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Not allowed to delete this reply' });
        }

        await pool.query('DELETE FROM replies WHERE id = $1', [replyId]);

        res.json({ success: true, message: 'Reply deleted successfully' });
    } catch (err) {
        console.error('Error deleting reply:', err);
        res.status(500).json({ error: 'Failed to delete reply' });
    }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({ message: 'Post deleted successfully', post: result.rows[0] });
    } catch (err) {
        console.error('Error deleting post:', err);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

module.exports = router;