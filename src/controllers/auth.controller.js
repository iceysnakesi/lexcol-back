const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../config/email');

const AuthController = {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Find user by email
            const user = await UserModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            // 1. INCLUDE 'name' IN THE JWT PAYLOAD
            const accessToken = jwt.sign(
                {
                    id: user.id.toString(),
                    role: user.role || 'user',
                    name: user.name || 'Unnamed User',
                    membership_tier: user.membership_tier || 'free',
                },
                process.env.JWT_SECRET || 'fallback_secret_key',
                { expiresIn: '1d' }
            );

            // Success response
            return res.status(200).json({
                accessToken: accessToken,
                refreshToken: 'mock-refresh-token',
                user: {
                    id: user.id.toString(),
                    email: user.email,
                    name: user.name || 'Unnamed User',     // <-- Provided for frontend expecting .name
                    role: user.role || 'user',
                    membership_tier: user.membership_tier || 'free',
                    avatar_url: user.avatar_url || null,
                }
            });

        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        };
    },
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await UserModel.findByEmail(email);

            // Always return 200 to prevent email enumeration attacks
            if (!user) {
                return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
            }

            // Generate a secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await UserModel.saveResetToken(user.email, resetToken, expiresAt);
            await sendPasswordResetEmail(user.email, resetToken);

            return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword || newPassword.length < 6) {
                return res.status(400).json({ message: 'Valid token and password (min 6 chars) required.' });
            }

            const user = await UserModel.findByResetToken(token);
            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired reset token.' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await UserModel.updatePasswordAndClearToken(user.id, hashedPassword);

            return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },
};

module.exports = AuthController;