const statsService = require('./stats.service');
const { success } = require('../../utils/response');

const getPlayerStats = async (req, res, next) => {
  try {
    const [batting, bowling] = await Promise.all([
      statsService.getPlayerBattingStats(req.params.playerId),
      statsService.getPlayerBowlingStats(req.params.playerId),
    ]);
    success(res, { batting, bowling });
  } catch (err) { next(err); }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'batting', limit = 20 } = req.query;
    const data = await statsService.getLeaderboard(type, limit);
    success(res, { leaderboard: data });
  } catch (err) { next(err); }
};

const getMatchStats = async (req, res, next) => {
  try {
    const data = await statsService.getMatchStats(req.params.matchId);
    success(res, data);
  } catch (err) { next(err); }
};

module.exports = { getPlayerStats, getLeaderboard, getMatchStats };
