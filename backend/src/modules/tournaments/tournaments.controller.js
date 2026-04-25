const service = require('./tournaments.service');
const { success, paginated } = require('../../utils/response');

const createTournament = async (req, res, next) => {
  try {
    const t = await service.createTournament(req.body, req.userId);
    success(res, { tournament: t }, 'Tournament created', 201);
  } catch (err) { next(err); }
};

const getTournaments = async (req, res, next) => {
  try {
    const { tournaments, total, page, limit } = await service.getTournaments(req.query, req.userId);
    paginated(res, tournaments, total, page, limit);
  } catch (err) { next(err); }
};

const getTournament = async (req, res, next) => {
  try {
    const t = await service.getTournamentById(req.params.id);
    success(res, { tournament: t });
  } catch (err) { next(err); }
};

const updateTournament = async (req, res, next) => {
  try {
    const t = await service.updateTournament(req.params.id, req.body, req.userId);
    success(res, { tournament: t }, 'Tournament updated');
  } catch (err) { next(err); }
};

const deleteTournament = async (req, res, next) => {
  try {
    await service.deleteTournament(req.params.id, req.userId);
    success(res, {}, 'Tournament deleted');
  } catch (err) { next(err); }
};

const registerTeam = async (req, res, next) => {
  try {
    const { teamId } = req.body;
    const t = await service.registerTeam(req.params.id, teamId, req.userId);
    success(res, { tournament: t }, 'Team registered');
  } catch (err) { next(err); }
};

const approveRequest = async (req, res, next) => {
  try {
    const t = await service.approveTeamRequest(req.params.id, req.params.requestId, req.userId);
    success(res, { tournament: t }, 'Request approved');
  } catch (err) { next(err); }
};

const rejectRequest = async (req, res, next) => {
  try {
    const t = await service.rejectTeamRequest(req.params.id, req.params.requestId, req.userId);
    success(res, { tournament: t }, 'Request rejected');
  } catch (err) { next(err); }
};

const removeTeam = async (req, res, next) => {
  try {
    const t = await service.removeTeam(req.params.id, req.params.teamId, req.userId);
    success(res, { tournament: t }, 'Team removed');
  } catch (err) { next(err); }
};

const generateFixtures = async (req, res, next) => {
  try {
    const t = await service.generateFixtures(req.params.id, req.userId);
    success(res, { tournament: t }, 'Fixtures generated');
  } catch (err) { next(err); }
};

const deleteFixtures = async (req, res, next) => {
  try {
    const t = await service.deleteFixtures(req.params.id, req.userId);
    success(res, { tournament: t }, 'Fixtures deleted');
  } catch (err) { next(err); }
};

const getStandings = async (req, res, next) => {
  try {
    const standings = await service.recalcStandings(req.params.id);
    success(res, { standings });
  } catch (err) { next(err); }
};

module.exports = {
  createTournament, getTournaments, getTournament, updateTournament, deleteTournament,
  registerTeam, approveRequest, rejectRequest, removeTeam,
  generateFixtures, deleteFixtures, getStandings,
};
