const User = require('../../models/User');
const { AppError } = require('../../middlewares/errorHandler');

const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user.toPublicJSON();
};

const updateProfile = async (userId, updates) => {
  const allowed = ['name', 'phone', 'avatar'];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  const user = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user.toPublicJSON();
};

const updateFCMToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(userId, { fcmToken });
};

const getUserById = async (id) => {
  const user = await User.findById(id).select('-refreshTokens');
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user;
};

module.exports = { getProfile, updateProfile, updateFCMToken, getUserById };
