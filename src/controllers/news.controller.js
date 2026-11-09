const NewsModel = require('../models/news.model');
const { processAndUpload } = require('../config/newsImage');

const PAGE_SIZE = 6;
const MAX_LIMIT = 24;

function resolveLimit(raw) {
    const n = parseInt(raw);
    if (!n || n < 1) return PAGE_SIZE;
    return Math.min(n, MAX_LIMIT);
}

const NewsController = {
    async list(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = resolveLimit(req.query.limit);
            const search = (req.query.search || '').trim();
            const includeHidden = req.user?.role === 'admin';

            const { totalItems, rows } = await NewsModel.findAll({
                page, limit, search, includeHidden,
            });

            res.json({
                totalItems,
                totalPages: Math.ceil(totalItems / limit) || 1,
                currentPage: page,
                news: rows.map((n) => ({
                    id: n.id,
                    title: n.title,
                    cover_image_url: n.cover_image_url,
                    content: n.content,
                    is_hidden: n.is_hidden,
                    created_at: n.created_at,
                })),
            });
        } catch (err) {
            console.error('List news error:', err);
            res.status(500).json({ error: 'Failed to fetch news' });
        }
    },

    async getOne(req, res) {
        try {
            const article = await NewsModel.findById(req.params.id);
            if (!article || (article.is_hidden && req.user?.role !== 'admin')) {
                return res.status(404).json({ error: 'Article not found' });
            }
            res.json(article);
        } catch (err) {
            console.error('Get news error:', err);
            res.status(500).json({ error: 'Failed to fetch article' });
        }
    },

    async create(req, res) {
        try {
            const { title, cover_image_url, content } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({ error: 'Title is required' });
            }
            if (!cover_image_url) {
                return res.status(400).json({ error: 'Cover image is required' });
            }
            if (!Array.isArray(content) || content.length === 0) {
                return res.status(400).json({ error: 'Content cannot be empty' });
            }

            const created = await NewsModel.create({
                title: title.trim(),
                cover_image_url,
                content,
                added_by: req.user.id,
            });

            res.status(201).json(created);
        } catch (err) {
            console.error('Create news error:', err);
            res.status(500).json({
                error: 'Failed to create article',
                ...(process.env.NODE_ENV !== 'production' && { message: err.message }),
            });
        }
    },

    async toggleVisibility(req, res) {
        try {
            const updated = await NewsModel.toggleVisibility(req.params.id);
            if (!updated) return res.status(404).json({ error: 'Article not found' });
            res.json(updated);
        } catch (err) {
            console.error('Toggle news error:', err);
            res.status(500).json({ error: 'Failed to toggle visibility' });
        }
    },

    async remove(req, res) {
        try {
            const deleted = await NewsModel.delete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Article not found' });
            res.json({ success: true, message: 'Article deleted' });
        } catch (err) {
            console.error('Delete news error:', err);
            res.status(500).json({ error: 'Failed to delete article' });
        }
    },

    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No image uploaded' });
            }
            const url = await processAndUpload(req.file.buffer);
            res.json({ url });
        } catch (err) {
            console.error('News image upload error:', err);
            res.status(500).json({ error: 'Failed to upload image', message: err.message });
        }
    },

    async getMotd(req, res) {
        try {
            const motd = await NewsModel.getActiveMotd();
            res.json(motd || null);
        } catch (err) {
            console.error('Get MOTD error:', err);
            res.status(500).json({ error: 'Failed to fetch message' });
        }
    },

    async setMotd(req, res) {
        try {
            const { message } = req.body;
            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }
            const created = await NewsModel.setMotd({
                message: message.trim(),
                created_by: req.user.id,
            });
            res.status(201).json(created);
        } catch (err) {
            console.error('Set MOTD error:', err);
            res.status(500).json({ error: 'Failed to set message' });
        }
    },
};

module.exports = NewsController;