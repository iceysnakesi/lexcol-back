const VideoModel = require('../models/video.model');
const { extractVideoId, fetchVideoMetadata } = require('../config/youtube');

const PAGE_SIZE_WEB = 9;
const PAGE_SIZE_MOBILE = 8;
// The frontend sends `limit`; backend only enforces a sane cap.
const MAX_LIMIT = 24;

function resolveLimit(raw, fallback) {
    const n = parseInt(raw);
    if (!n || n < 1) return fallback;
    return Math.min(n, MAX_LIMIT);
}

const VideoController = {
        async list(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = resolveLimit(req.query.limit, PAGE_SIZE_WEB);
            const channelId = req.query.channel || null;
            const includeHidden = req.user?.role === 'admin';

            const { totalItems, rows } = await VideoModel.findAll({
                page, limit, channelId, includeHidden,
            });

            res.json({
                totalItems,
                totalPages: Math.ceil(totalItems / limit) || 1,
                currentPage: page,
                videos: rows.map((v) => ({
                    id: v.id,
                    channel_id: v.channel_id,
                    channel_name: v.channel_name,
                    title: v.title,
                    thumbnail_url: v.thumbnail_url,
                    duration_seconds: v.duration_seconds,
                    published_at: v.published_at,
                    preview_youtube_id: v.preview_youtube_id,
                    is_hidden: v.is_hidden,
                    created_at: v.created_at,
                })),
            });
        } catch (err) {
            console.error('List videos error:', err);
            res.status(500).json({ error: 'Failed to fetch videos' });
        }
    },

    async listAdmin(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = resolveLimit(req.query.limit, PAGE_SIZE_WEB);
            const { totalItems, rows } = await VideoModel.findAllAdmin({ page, limit });

            res.json({
                totalItems,
                totalPages: Math.ceil(totalItems / limit) || 1,
                currentPage: page,
                videos: rows,
            });
        } catch (err) {
            console.error('Admin list videos error:', err);
            res.status(500).json({ error: 'Failed to fetch videos' });
        }
    },

    async listChannels(req, res) {
        try {
            const rows = await VideoModel.getChannels();
            res.json({ channels: rows });
        } catch (err) {
            console.error('List channels error:', err);
            res.status(500).json({ error: 'Failed to fetch channels' });
        }
    },

    async create(req, res) {
        try {
            const { youtube_url, preview_youtube_url } = req.body;

            const youtubeId = extractVideoId(youtube_url);
            if (!youtubeId) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }

            const existing = await VideoModel.findByYoutubeId(youtubeId);
            if (existing) {
                return res.status(409).json({ error: 'This video has already been added' });
            }

            const meta = await fetchVideoMetadata(youtubeId);

            let previewId = null;
            if (preview_youtube_url) {
                previewId = extractVideoId(preview_youtube_url);
                if (!previewId) {
                    return res.status(400).json({ error: 'Invalid preview YouTube URL' });
                }
                if (previewId === youtubeId) {
                    return res.status(400).json({
                        error: 'Preview URL must be a different video than the full video',
                    });
                }
            }

                        const created = await VideoModel.create({
                ...meta,
                preview_youtube_id: previewId,
                added_by: req.user.id,
            });

            res.status(201).json(created);
        } catch (err) {
            console.error('Create video error:', err);
            res.status(500).json({
                error: 'Failed to add video',
                ...(process.env.NODE_ENV !== 'production' && {
                    message: err.message,
                }),
            });
        }
    },

    async toggleVisibility(req, res) {
        try {
            const updated = await VideoModel.toggleVisibility(req.params.id);
            if (!updated) return res.status(404).json({ error: 'Video not found' });
            res.json(updated);
        } catch (err) {
            console.error('Toggle video error:', err);
            res.status(500).json({ error: 'Failed to toggle visibility' });
        }
    },

    async remove(req, res) {
        try {
            const deleted = await VideoModel.delete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Video not found' });
            res.json({ success: true, message: 'Video deleted' });
        } catch (err) {
            console.error('Delete video error:', err);
            res.status(500).json({ error: 'Failed to delete video' });
        }
    },

    // Returns what the player is allowed to see. This is the ONLY place
    // the full youtube_id ever leaves the server for non-privileged users.
        async playInfo(req, res) {
        try {
            const video = await VideoModel.findById(req.params.id);
            if (!video || video.is_hidden) {
                return res.status(404).json({ error: 'Video not found' });
            }

            // req.user is undefined for guests (optionalAuth)
            const user = req.user;
            const isPrivileged =
                !!user &&
                (user.role === 'admin' ||
                 user.membership_tier === 'pro' ||
                 user.membership_tier === 'enterprise');

            if (isPrivileged) {
                return res.json({ mode: 'full', youtube_id: video.youtube_id });
            }

            // Guest and free share the same preview access. The frontend
            // decides which CTA to show based on auth state.
            if (video.preview_youtube_id) {
                return res.json({
                    mode: 'preview',
                    youtube_id: video.preview_youtube_id,
                });
            }

            return res.json({ mode: 'locked' });
        } catch (err) {
            console.error('Play info error:', err);
            res.status(500).json({ error: 'Failed to load video' });
        }
    },
};

module.exports = VideoController;