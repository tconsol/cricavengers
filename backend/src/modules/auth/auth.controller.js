const authService = require('./auth.service');
const { success } = require('../../utils/response');

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

module.exports = { register, login, refresh, logout, me };
