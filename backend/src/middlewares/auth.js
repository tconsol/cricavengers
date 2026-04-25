const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select('+isActive');
    if (!user || !user.isActive) {
      throw new AppError('User not found or deactivated', 401, 'USER_INACTIVE');
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
  }
  next();
};

const requireMatchRole = (...roles) => async (req, res, next) => {
  try {
    const Match = require('../models/Match');
    const matchId = req.params.matchId || req.params.id;
    const match = await Match.findById(matchId);

    if (!match) {
      return next(new AppError('Match not found', 404, 'NOT_FOUND'));
    }

    const isCreator = match.createdBy.toString() === req.userId;
    const matchRole = match.roles?.find((r) => r.userId.toString() === req.userId);
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin && !roles.includes(matchRole?.role)) {
      return next(new AppError('Insufficient match permissions', 403, 'FORBIDDEN'));
    }

    req.match = match;
    req.matchRole = isCreator ? 'organizer' : matchRole?.role;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireRole, requireMatchRole };
