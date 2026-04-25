const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
  },
  skip: (req) => req.path === '/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many auth attempts, please try again in 15 minutes',
  },
});

const scoringLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Scoring too fast, slow down',
  },
});

module.exports = rateLimiter;
module.exports.authLimiter = authLimiter;
module.exports.scoringLimiter = scoringLimiter;
