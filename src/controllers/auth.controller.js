const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const bcrypt = require('bcryptjs');

const AuthController = {
    async login(req, res) {
        try {
            const { email, passwordHash } = req.body; // Matches frontend LoginRequest

            // Find user by email
            const user = await UserModel.findByEmail(email);
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            // Compare password
            const isMatch = await bcrypt.compare(passwordHash, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            // Generate JWT token
            const accessToken = jwt.sign(
                { id: user.id.toString(), role: user.role || 'user' },
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
                    username: user.name,
                    role: user.role || 'user',
                    membership_tier: user.membership_tier || 'free',
                }
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = AuthController;