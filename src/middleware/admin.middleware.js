const UserModel = require('../models/user.model');

const isAdmin = async (req, res, next) => {
    try {
        if (!req.user || (!req.user.id && !req.user._id)) {
            return res.status(401).json({ success: false, message: 'Unauthorized. No token provided.' });
        }

        const userId = req.user.id || req.user._id;
        const user = await UserModel.findById(userId);

        if (user && user.role === 'admin') {
            return next(); // User is an admin
        }

        return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
    } catch (err) {
        console.error('Admin verification error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = isAdmin;