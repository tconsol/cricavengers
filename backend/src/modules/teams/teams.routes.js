const express = require('express');
const controller = require('./teams.controller');
const { authenticate } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createTeamSchema, updateTeamSchema, addPlayerSchema } = require('./teams.schema');
const { uploadTeamLogo } = require('../../middlewares/upload');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createTeamSchema), controller.createTeam);
router.get('/', controller.getTeams);
router.get('/:id', controller.getTeam);
router.put('/:id', validate(updateTeamSchema), controller.updateTeam);
router.delete('/:id', controller.deleteTeam);
router.get('/search/players', controller.searchPlayers);
router.post('/:id/players', validate(addPlayerSchema), controller.addPlayer);
router.delete('/:id/players/:playerId', controller.removePlayer);
router.post('/:id/logo', uploadTeamLogo, controller.uploadTeamLogo);

module.exports = router;
