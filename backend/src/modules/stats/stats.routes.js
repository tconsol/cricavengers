const express = require('express');
const controller = require('./stats.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/leaderboard', controller.getLeaderboard);
router.get('/players/:playerId', controller.getPlayerStats);
router.get('/matches/:matchId', controller.getMatchStats);

module.exports = router;
