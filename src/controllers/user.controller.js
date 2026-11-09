const UserModel = require('../models/user.model');
const jwt = require('jsonwebtoken');

const supabase = require('../config/supabase');
const sharp = require('sharp');

const UserController = {
  async getAll(req, res) {
    try {
      const users = await UserModel.findAll();
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'name, email y password son requeridos' });
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, message: 'El email ya está registrado' });
      }

      const user = await UserModel.create({ name, email, password });
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'name y email son requeridos' });
      }

      const user = await UserModel.update(req.params.id, { name, email });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        });
      }

      const updatedUser = await UserModel.updateProfile(userId, {
        name: name.trim()
      });

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: { ...updatedUser, id: updatedUser.id.toString() }
      });
    } catch (err) {
      console.error('Update profile error:', err);

      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  async changeMembership(req, res) {
    try {
      const { membership_tier } = req.body;
      const allowed = ['free', 'pro', 'enterprise'];

      if (!allowed.includes(membership_tier)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid membership tier',
        });
      }

      const updatedUser = await UserModel.update(req.user.id, { membership_tier });

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Re-sign a JWT so the new tier takes effect immediately server-side
      const accessToken = jwt.sign(
        {
          id: updatedUser.id.toString(),
          role: updatedUser.role || 'user',
          name: updatedUser.name || 'Unnamed User',
          membership_tier: updatedUser.membership_tier || 'free',
        },
        process.env.JWT_SECRET || 'fallback_secret_key',
        { expiresIn: '1d' }
      );

      return res.json({ success: true, user: updatedUser, accessToken });
    } catch (err) {
      console.error('Change membership error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  async processAvatar(req, res) {
    try {
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image was uploaded.'
        });
      }

      // 1. Process the image
      const processedImage = await sharp(req.file.buffer)
        .rotate()
        .resize(400, 400, {
          fit: 'cover',
          position: 'centre'
        })
        .webp({ quality: 80 })
        .toBuffer();

      // 2. Define the storage path
      const filePath = `${userId}/profile.webp`;

      // 3. Upload the image to Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('avatar')
        .upload(filePath, processedImage, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);

        return res.status(500).json({
          success: false,
          message: 'Failed to upload avatar.'
        });
      }

      // 4. Obtain the public URL
      const { data } = supabase
        .storage
        .from('avatar')
        .getPublicUrl(filePath);

      const avatarUrl = data.publicUrl;

      // 5. Update the user's database record
      const updatedUser = await UserModel.updateAvatar(
        userId,
        avatarUrl
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully.',
        user: { ...updatedUser, id: updatedUser.id.toString() }
      });

    } catch (err) {
      console.error('Avatar processing error:', err);

      return res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  },

  async remove(req, res) {
    try {
      const user = await UserModel.delete(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateRoleOrTier(req, res) {
    try {
      const { id } = req.params;
      const { role, membership_tier } = req.body;

      if (role === undefined && membership_tier === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Expected at least one of: role, membership_tier',
        });
      }

      // UserModel.update uses COALESCE — undefined fields are left untouched
      const updatedUser = await UserModel.update(id, { role, membership_tier });

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser,
      });
    } catch (err) {
      console.error('Update error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
};



module.exports = UserController;
