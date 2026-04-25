const express = require('express');
const controller = require('./scoring.controller');
const { authenticate, requireMatchRole } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { scoringLimiter } = require('../../middlewares/rateLimiter');
const { addBallSchema, editBallSchema } = require('./scoring.schema');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Live summary (any authenticated user)
router.get('/matches/:matchId/live', controller.getLiveSummaryCtrl);

// Ball-by-ball log
router.get('/matches/:matchId/innings/:innings/balls', controller.getBalls);
router.get('/matches/:matchId/innings/:innings/balls/recent', controller.getRecentBalls);

// Audit log
router.get('/matches/:matchId/audit', requireMatchRole('organizer', 'scorer', 'umpire'), controller.getAuditLog);

// Scoring actions (restricted to scorer/umpire/organizer)
router.post(
  '/matches/:matchId/balls',
  scoringLimiter,
  requireMatchRole('scorer', 'umpire', 'organizer'),
  validate(addBallSchema),
  controller.addBall
);

router.post(
  '/matches/:matchId/innings/:innings/undo',
  requireMatchRole('scorer', 'umpire', 'organizer'),
  controller.undoBall
);

router.put(
  '/matches/:matchId/balls/:ballId',
  requireMatchRole('scorer', 'umpire', 'organizer'),
  validate(editBallSchema),
  controller.editBall
);

router.delete(
  '/matches/:matchId/balls/:ballId',
  requireMatchRole('scorer', 'umpire', 'organizer'),
  controller.deleteBall
);

module.exports = router;
