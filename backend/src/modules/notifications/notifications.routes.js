const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { success } = require('../../utils/response');

const router = express.Router();

router.use(authenticate);

// Placeholder: basic in-app notification endpoints
router.get('/', (req, res) => {
  success(res, { notifications: [] });
});

module.exports = router;
