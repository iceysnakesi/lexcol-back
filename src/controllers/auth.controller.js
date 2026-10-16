// src/controllers/auth.controller.js
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

            // Success response
            return res.status(200).json({
                accessToken: 'mock-jwt-token-from-backend', // Replaceable with a real JWT library for later
                refreshToken: 'mock-refresh-token',
                user: {
                    id: user.id.toString(),
                    email: user.email,
                    username: user.name,
                    roles: ['User'],
                }
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = AuthController;