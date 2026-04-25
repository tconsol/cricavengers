const User = require('../../models/User');
const Team = require('../../models/Team');
const Match = require('../../models/Match');
const { success } = require('../../utils/response');
const { AppError } = require('../../middlewares/errorHandler');

const search = async (req, res, next) => {
  try {
    const { q, type = 'all', limit = 10 } = req.query;
    if (!q || q.trim().length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400, 'VALIDATION_ERROR');
    }

    const regex = new RegExp(q.trim(), 'i');
    const lim = Math.min(parseInt(limit), 50);
    const results = {};

    if (type === 'all' || type === 'players') {
      results.players = await User.find({
        $or: [{ name: regex }, { email: regex }],
        isActive: true,
      }).select('name email avatar').limit(lim);
    }

    if (type === 'all' || type === 'teams') {
      results.teams = await Team.find({
        $or: [{ name: regex }, { shortName: regex }],
        isActive: true,
      }).select('name shortName logo color').limit(lim);
    }

    if (type === 'all' || type === 'matches') {
      results.matches = await Match.find({
        $or: [{ title: regex }, { venue: regex }],
      })
        .populate('teamA', 'name shortName')
        .populate('teamB', 'name shortName')
        .select('title venue scheduledAt state format')
        .limit(lim);
    }

    success(res, { results, query: q });
  } catch (err) { next(err); }
};

module.exports = { search };
