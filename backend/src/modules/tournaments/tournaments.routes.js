const express = require('express');
const controller = require('./tournaments.controller');
const { authenticate } = require('../../middlewares/auth');
const { uploadTournamentLogo } = require('../../middlewares/upload');

const router = express.Router();

router.use(authenticate);

// CRUD
router.post('/',       controller.createTournament);
router.get('/',        controller.getTournaments);
router.get('/:id',     controller.getTournament);
router.put('/:id',     controller.updateTournament);
router.delete('/:id',  controller.deleteTournament);

// Standings (live recalc)
router.get('/:id/standings', controller.getStandings);

// Team registration
router.post('/:id/register',                          controller.registerTeam);
router.post('/:id/requests/:requestId/approve',       controller.approveRequest);
router.post('/:id/requests/:requestId/reject',        controller.rejectRequest);
router.delete('/:id/teams/:teamId',                   controller.removeTeam);

// Logo
router.post('/:id/logo', uploadTournamentLogo, controller.uploadTournamentLogo);

// Fixtures
router.post('/:id/fixtures',   controller.generateFixtures);
router.delete('/:id/fixtures', controller.deleteFixtures);

module.exports = router;
