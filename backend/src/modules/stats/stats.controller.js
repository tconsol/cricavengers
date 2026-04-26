const statsService = require('./stats.service');
const User = require('../../models/User');
const { success } = require('../../utils/response');

const getPlayerStats = async (req, res, next) => {
  try {
    const [player, batting, bowling, fielding] = await Promise.all([
      User.findById(req.params.playerId).select('name role avatar').lean(),
      statsService.getPlayerBattingStats(req.params.playerId),
      statsService.getPlayerBowlingStats(req.params.playerId),
      statsService.getPlayerFieldingStats(req.params.playerId),
    ]);
    success(res, { name: player?.name, role: player?.role, avatar: player?.avatar, batting, bowling, fielding });
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
