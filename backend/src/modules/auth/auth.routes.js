const express = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimiter');
const { registerSchema, loginSchema, refreshSchema } = require('./auth.schema');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;
