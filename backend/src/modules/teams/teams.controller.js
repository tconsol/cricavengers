const teamsService = require('./teams.service');
const { success, paginated } = require('../../utils/response');

const createTeam = async (req, res, next) => {
  try {
    const team = await teamsService.createTeam(req.body, req.userId);
    success(res, { team }, 'Team created', 201);
  } catch (err) { next(err); }
};

const getTeams = async (req, res, next) => {
  try {
    const { teams, total, page, limit } = await teamsService.getTeams(req.query, req.userId);
    paginated(res, teams, total, page, limit);
  } catch (err) { next(err); }
};

const getTeam = async (req, res, next) => {
  try {
    const team = await teamsService.getTeamById(req.params.id);
    success(res, { team });
  } catch (err) { next(err); }
};

const updateTeam = async (req, res, next) => {
  try {
    const team = await teamsService.updateTeam(req.params.id, req.body, req.userId);
    success(res, { team }, 'Team updated');
  } catch (err) { next(err); }
};

const addPlayer = async (req, res, next) => {
  try {
    const team = await teamsService.addPlayer(req.params.id, req.body, req.userId);
    success(res, { team }, 'Player added');
  } catch (err) { next(err); }
};

const removePlayer = async (req, res, next) => {
  try {
    const team = await teamsService.removePlayer(req.params.id, req.params.playerId, req.userId);
    success(res, { team }, 'Player removed');
  } catch (err) { next(err); }
};

const deleteTeam = async (req, res, next) => {
  try {
    await teamsService.deleteTeam(req.params.id, req.userId);
    success(res, {}, 'Team deleted');
  } catch (err) { next(err); }
};

module.exports = { createTeam, getTeams, getTeam, updateTeam, addPlayer, removePlayer, deleteTeam };
