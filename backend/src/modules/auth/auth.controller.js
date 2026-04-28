const authService = require('./auth.service');
const { success } = require('../../utils/response');
const { fileUrl } = require('../../middlewares/upload');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    success(res, result, 'Registration successful', 201);
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    success(res, result, 'Login successful');
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshTokens(req.body.refreshToken);
    success(res, result, 'Tokens refreshed');
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.userId, req.body.refreshToken);
    success(res, {}, 'Logged out successfully');
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    success(res, { user: req.user.toPublicJSON() });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.userId, req.body);
    success(res, { user }, 'Profile updated');
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.userId, req.body);
    success(res, {}, 'Password changed');
  } catch (err) { next(err); }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(new (require('../../middlewares/errorHandler').AppError)('No file uploaded', 400, 'NO_FILE'));
    const url = fileUrl(req, 'avatars', req.file.filename);
    const user = await authService.updateAvatar(req.userId, url);
    success(res, { user }, 'Avatar updated');
  } catch (err) { next(err); }
};

const saveFcmToken = async (req, res, next) => {
  try {
    await authService.saveFcmToken(req.userId, req.body.fcmToken);
    success(res, {}, 'FCM token saved');
  } catch (err) { next(err); }
};

module.exports = { register, login, refresh, logout, me, updateProfile, changePassword, uploadAvatar, saveFcmToken };
