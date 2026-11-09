const { Router } = require('express');
const multer = require('multer');
const router = Router();
const NewsController = require('../controllers/news.controller');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth.middleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new Error('Only JPEG/PNG/WebP images allowed'), ok);
    },
});

// Public
router.get('/', optionalAuth, NewsController.list);
router.get('/motd', NewsController.getMotd);
router.get('/:id', optionalAuth, NewsController.getOne);

// Admin
router.post('/', requireAuth, requireAdmin, NewsController.create);
router.post('/upload-image', requireAuth, requireAdmin, upload.single('image'), NewsController.uploadImage);
router.post('/motd', requireAuth, requireAdmin, NewsController.setMotd);
router.patch('/:id/visibility', requireAuth, requireAdmin, NewsController.toggleVisibility);
router.delete('/:id', requireAuth, requireAdmin, NewsController.remove);

module.exports = router;