const matchesService = require('./matches.service');
const scoreSummaryService = require('../scoring/scoreSummary.service');
const { success, paginated } = require('../../utils/response');

const createMatch = async (req, res, next) => {
  try {
    const match = await matchesService.createMatch(req.body, req.userId);
    success(res, { match }, 'Match created', 201);
  } catch (err) { next(err); }
};

const getMatches = async (req, res, next) => {
  try {
    const { matches, total, page, limit } = await matchesService.getMatches(req.query, req.userId);
    paginated(res, matches, total, page, limit);
  } catch (err) { next(err); }
};

const getLiveMatches = async (req, res, next) => {
  try {
    const matches = await matchesService.getLiveMatches();
    success(res, { matches });
  } catch (err) { next(err); }
};

const getMatch = async (req, res, next) => {
  try {
    const match = await matchesService.getMatchById(req.params.id);
    success(res, { match });
  } catch (err) { next(err); }
};

const getMatchScorecard = async (req, res, next) => {
  try {
    const scorecard = await scoreSummaryService.getFullScorecard(req.params.id);
    success(res, { scorecard });
  } catch (err) { next(err); }
};

const getMatchGraphs = async (req, res, next) => {
  try {
    const graphData = await scoreSummaryService.getMatchGraphData(req.params.id);
    success(res, { graphData });
  } catch (err) { next(err); }
};

const setToss = async (req, res, next) => {
  try {
    const match = await matchesService.setToss(req.params.id, req.body, req.userId);
    success(res, { match }, 'Toss set');
  } catch (err) { next(err); }
};

const startInnings = async (req, res, next) => {
  try {
    const match = await matchesService.startInnings(req.params.id, req.body, req.userId);
    success(res, { match }, 'Innings started');
  } catch (err) { next(err); }
};

const endInnings = async (req, res, next) => {
  try {
    const match = await matchesService.endInnings(req.params.id, req.userId);
    success(res, { match }, 'Innings ended');
  } catch (err) { next(err); }
};

const addRole = async (req, res, next) => {
  try {
    const match = await matchesService.addRole(req.params.id, req.body, req.userId);
    success(res, { match }, 'Role assigned');
  } catch (err) { next(err); }
};

const removeRole = async (req, res, next) => {
  try {
    const match = await matchesService.removeRole(req.params.id, req.params.targetUserId, req.userId);
    success(res, { match }, 'Role removed');
  } catch (err) { next(err); }
};

const updateSquad = async (req, res, next) => {
  try {
    const match = await matchesService.updateSquad(req.params.id, req.body, req.userId);
    success(res, { match }, 'Squad updated');
  } catch (err) { next(err); }
};

const abandonMatch = async (req, res, next) => {
  try {
    const match = await matchesService.abandonMatch(req.params.id, req.userId);
    success(res, { match }, 'Match abandoned');
  } catch (err) { next(err); }
};

const endMatchAsTie = async (req, res, next) => {
  try {
    const match = await matchesService.endMatchAsTie(req.params.id, req.userId);
    success(res, { match }, 'Match ended as tie');
  } catch (err) { next(err); }
};

module.exports = {
  createMatch, getMatches, getLiveMatches, getMatch, getMatchScorecard, getMatchGraphs,
  setToss, startInnings, endInnings, endMatchAsTie, addRole, removeRole, updateSquad, abandonMatch,
};
