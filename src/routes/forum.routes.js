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

        // Optional search query
        const search = req.query.search || '';

        // Count total visible items
        const countQuery = `
      SELECT COUNT(*) FROM posts 
      WHERE is_hidden = false AND (title ILIKE $1 OR content ILIKE $1)
    `;
        const countResult = await pool.query(countQuery, [`%${search}%`]);
        const totalItems = parseInt(countResult.rows[0].count);

        // Fetch paginated chunk
        const postsQuery = `
      SELECT id, title, content, author_name, created_at 
      FROM posts 
      WHERE is_hidden = false AND (title ILIKE $1 OR content ILIKE $1)
      ORDER BY created_at DESC 
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
 *         description: Unauthorized (missing or invalid token)
 *       500:
 *         description: Server error
 */

router.post('/', requireAuth, async (req, res) => {
    try {
        const { title, content } = req.body;
        const authorId = req.user.id; // Extracted from JWT token
        const authorName = req.user.name || 'Anonymous';

        const query = `
      INSERT INTO posts (title, content, author_id, author_name) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
        const result = await pool.query(query, [title, content, authorId, authorName]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create post' });
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
 *         description: ID of the forum post
 *     responses:
 *       200:
 *         description: Visibility toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 is_hidden:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires admin role)
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
 *         description: ID of the forum post
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
 *         description: Forbidden (requires admin role)
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

module.exports = router;