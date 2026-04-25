const express = require('express');
const controller = require('./users.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/profile', controller.getProfile);
router.put('/profile', controller.updateProfile);
router.put('/fcm-token', controller.updateFCMToken);
router.get('/:id', controller.getUser);

module.exports = router;
