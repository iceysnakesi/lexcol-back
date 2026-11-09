const { Router } = require('express');
const router = Router();
const VideoController = require('../controllers/video.controller');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth.middleware');

router.get('/', optionalAuth, VideoController.list);
router.get('/channels', VideoController.listChannels);

router.get('/admin/all', requireAuth, requireAdmin, VideoController.listAdmin);
router.post('/', requireAuth, requireAdmin, VideoController.create);
router.patch('/:id/visibility', requireAuth, requireAdmin, VideoController.toggleVisibility);
router.delete('/:id', requireAuth, requireAdmin, VideoController.remove);

router.get('/:id/play', optionalAuth, VideoController.playInfo);

module.exports = router;