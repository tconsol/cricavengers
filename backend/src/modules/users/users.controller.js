const usersService = require('./users.service');
const { success } = require('../../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const user = await usersService.getProfile(req.userId);
    success(res, { user });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await usersService.updateProfile(req.userId, req.body);
    success(res, { user }, 'Profile updated');
  } catch (err) { next(err); }
};

const updateFCMToken = async (req, res, next) => {
  try {
    await usersService.updateFCMToken(req.userId, req.body.fcmToken);
    success(res, {}, 'FCM token updated');
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    success(res, { user });
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, updateFCMToken, getUser };
