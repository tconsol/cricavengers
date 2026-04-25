const express = require('express');
const controller = require('./matches.controller');
const { authenticate, requireMatchRole } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createMatchSchema, tossSchema, setPlayersSchema, addRoleSchema } = require('./matches.schema');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createMatchSchema), controller.createMatch);
router.get('/', controller.getMatches);
router.get('/live', controller.getLiveMatches);
router.get('/:id', controller.getMatch);
router.get('/:id/scorecard', controller.getMatchScorecard);

router.post('/:id/toss', requireMatchRole('organizer', 'scorer', 'umpire'), validate(tossSchema), controller.setToss);
router.post('/:id/innings/start', requireMatchRole('organizer', 'scorer', 'umpire'), validate(setPlayersSchema), controller.startInnings);
router.post('/:id/innings/end', requireMatchRole('organizer', 'scorer', 'umpire'), controller.endInnings);
router.post('/:id/roles', controller.addRole);
router.post('/:id/abandon', requireMatchRole('organizer'), controller.abandonMatch);

module.exports = router;
