const scoringService = require('./scoring.service');
const { getLiveSummary } = require('./scoreSummary.service');
const { success } = require('../../utils/response');

const addBall = async (req, res, next) => {
  try {
    const { ball, summary } = await scoringService.addBall(req.params.matchId, req.body, req.userId);
    success(res, { ball, summary }, 'Ball recorded', 201);
  } catch (err) { next(err); }
};

const undoBall = async (req, res, next) => {
  try {
    const innings = parseInt(req.params.innings);
    const { ball, summary } = await scoringService.undoBall(req.params.matchId, innings, req.userId);
    success(res, { ball, summary }, 'Last ball undone');
  } catch (err) { next(err); }
};

const editBall = async (req, res, next) => {
  try {
    const { ball, summary } = await scoringService.editBall(
      req.params.matchId, req.params.ballId, req.body, req.userId
    );
    success(res, { ball, summary }, 'Ball edited');
  } catch (err) { next(err); }
};

const deleteBall = async (req, res, next) => {
  try {
    const { summary } = await scoringService.deleteBall(
      req.params.matchId, req.params.ballId, req.userId
    );
    success(res, { summary }, 'Ball deleted');
  } catch (err) { next(err); }
};

const getBalls = async (req, res, next) => {
  try {
    const innings = parseInt(req.params.innings);
    const balls = await scoringService.getBalls(req.params.matchId, innings);
    success(res, { balls });
  } catch (err) { next(err); }
};

const getRecentBalls = async (req, res, next) => {
  try {
    const count = parseInt(req.query.count) || 6;
    const innings = parseInt(req.params.innings);
    const balls = await scoringService.getRecentBalls(req.params.matchId, innings, count);
    success(res, { balls });
  } catch (err) { next(err); }
};

const getLiveSummaryCtrl = async (req, res, next) => {
  try {
    const summary = await getLiveSummary(req.params.matchId);
    success(res, { summary });
  } catch (err) { next(err); }
};

const getAuditLog = async (req, res, next) => {
  try {
    const logs = await scoringService.getAuditLog(req.params.matchId);
    success(res, { logs });
  } catch (err) { next(err); }
};

module.exports = { addBall, undoBall, editBall, deleteBall, getBalls, getRecentBalls, getLiveSummaryCtrl, getAuditLog };
