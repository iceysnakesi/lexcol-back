const { Router } = require('express');
const router = Router();
const ChatbotController = require('../controllers/chatbot.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.post('/message', ChatbotController.sendMessage);
router.get('/chats', ChatbotController.getChats);
router.get('/chats/:id', ChatbotController.getChatMessages);

module.exports = router;