const express = require('express');
const { search } = require('./search.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', search);

module.exports = router;
