const { Router } = require('express');
const AuthController = require('../controllers/auth.controller');

const router = Router();

router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;