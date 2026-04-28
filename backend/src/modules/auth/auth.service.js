const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../../models/User');
const { AppError } = require('../../middlewares/errorHandler');

// SHA-256 hash for refresh tokens stored in DB.
// Tokens are already long random JWT strings so SHA-256 is appropriate here
// (bcrypt is unnecessary and slow for high-entropy inputs).
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

const register = async ({ name, email, password, phone }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409, 'DUPLICATE_ERROR');

  const user = await User.create({ name, email, password, phone });
  const tokens = generateTokens(user._id);

  user.refreshTokens = [hashToken(tokens.refreshToken)];
  await user.save();

  return { user: user.toPublicJSON(), ...tokens };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +refreshTokens +isActive');
  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await user.comparePassword(password);
  if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const tokens = generateTokens(user._id);

  // Keep only last 5 refresh token hashes (multi-device)
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), hashToken(tokens.refreshToken)];
  user.lastLogin = new Date();
  await user.save();

  return { user: user.toPublicJSON(), ...tokens };
};

const refreshTokens = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  if (decoded.type !== 'refresh') throw new AppError('Invalid token type', 401, 'INVALID_TOKEN');

  const user = await User.findById(decoded.userId).select('+refreshTokens +isActive');
  if (!user || !user.isActive) throw new AppError('User not found', 401, 'USER_INACTIVE');

  const tokenHash = hashToken(token);
  if (!user.refreshTokens?.includes(tokenHash)) {
    // Token reuse detected — invalidate all tokens
    user.refreshTokens = [];
    await user.save();
    throw new AppError('Refresh token reuse detected', 401, 'TOKEN_REUSE');
  }

  const newTokens = generateTokens(user._id);

  // Rotate: remove old hash, add new hash
  user.refreshTokens = user.refreshTokens
    .filter((h) => h !== tokenHash)
    .concat(hashToken(newTokens.refreshToken))
    .slice(-5);

  await user.save();
  return { ...newTokens, user: user.toPublicJSON() };
};

const logout = async (userId, refreshToken) => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  const tokenHash = hashToken(refreshToken);
  user.refreshTokens = (user.refreshTokens || []).filter((h) => h !== tokenHash);
  await user.save();
};

const updateProfile = async (userId, { name, phone }) => {
  const updates = {};
  if (name?.trim()) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone?.trim() || null;

  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user.toPublicJSON();
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');

  user.password = newPassword;
  await user.save();
};

const updateAvatar = async (userId, avatarUrl) => {
  const user = await User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user.toPublicJSON();
};

const saveFcmToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(userId, { fcmToken });
};

module.exports = { register, login, refreshTokens, logout, generateTokens, updateProfile, changePassword, updateAvatar, saveFcmToken };
