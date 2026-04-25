const Ball = require('../../models/Ball');
const Match = require('../../models/Match');
const User = require('../../models/User');
const mongoose = require('mongoose');

/**
 * Aggregate career batting stats for a player across all matches.
 */
const getPlayerBattingStats = async (playerId) => {
  const pid = new mongoose.Types.ObjectId(playerId);

  const result = await Ball.aggregate([
    { $match: { batsman: pid, isDeleted: false } },
    {
      $group: {
        _id: '$matchId',
        totalRuns: { $sum: '$runs' },
        totalBalls: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$extras.type', 'wide'] },
                { $ne: ['$extras.type', 'no_ball'] },
              ]},
              1, 0,
            ],
          },
        },
        fours: { $sum: { $cond: [{ $eq: ['$runs', 4] }, 1, 0] } },
        sixes: { $sum: { $cond: [{ $eq: ['$runs', 6] }, 1, 0] } },
        isOut: { $max: { $cond: ['$wicket', 1, 0] } },
      },
    },
    {
      $group: {
        _id: null,
        matches: { $sum: 1 },
        innings: { $sum: 1 },
        totalRuns: { $sum: '$totalRuns' },
        totalBalls: { $sum: '$totalBalls' },
        fours: { $sum: '$fours' },
        sixes: { $sum: '$sixes' },
        dismissals: { $sum: '$isOut' },
        highScore: { $max: '$totalRuns' },
      },
    },
    {
      $project: {
        _id: 0,
        matches: 1,
        innings: 1,
        totalRuns: 1,
        totalBalls: 1,
        fours: 1,
        sixes: 1,
        dismissals: 1,
        highScore: 1,
        average: {
          $cond: [
            { $eq: ['$dismissals', 0] },
            '$totalRuns',
            { $divide: ['$totalRuns', '$dismissals'] },
          ],
        },
        strikeRate: {
          $cond: [
            { $eq: ['$totalBalls', 0] },
            0,
            { $multiply: [{ $divide: ['$totalRuns', '$totalBalls'] }, 100] },
          ],
        },
      },
    },
  ]);

  return result[0] || {
    matches: 0, innings: 0, totalRuns: 0, totalBalls: 0,
    fours: 0, sixes: 0, dismissals: 0, highScore: 0, average: 0, strikeRate: 0,
  };
};

/**
 * Aggregate career bowling stats for a player.
 */
const getPlayerBowlingStats = async (playerId) => {
  const pid = new mongoose.Types.ObjectId(playerId);

  const result = await Ball.aggregate([
    { $match: { bowler: pid, isDeleted: false } },
    {
      $group: {
        _id: '$matchId',
        legalBalls: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$extras.type', 'wide'] },
                { $ne: ['$extras.type', 'no_ball'] },
              ]},
              1, 0,
            ],
          },
        },
        runs: {
          $sum: {
            $add: [
              '$runs',
              { $cond: [{ $eq: ['$extras.type', 'wide'] }, { $ifNull: ['$extras.runs', 1] }, 0] },
              { $cond: [{ $eq: ['$extras.type', 'no_ball'] }, 1, 0] },
            ],
          },
        },
        wickets: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$wicket', null] },
                { $not: { $in: ['$wicket.type', ['run_out', 'obstructing_field', 'handled_ball', 'timed_out', 'hit_twice']] } },
              ]},
              1, 0,
            ],
          },
        },
        wides: { $sum: { $cond: [{ $eq: ['$extras.type', 'wide'] }, 1, 0] } },
        noBalls: { $sum: { $cond: [{ $eq: ['$extras.type', 'no_ball'] }, 1, 0] } },
      },
    },
    {
      $group: {
        _id: null,
        matches: { $sum: 1 },
        totalBalls: { $sum: '$legalBalls' },
        totalRuns: { $sum: '$runs' },
        totalWickets: { $sum: '$wickets' },
        wides: { $sum: '$wides' },
        noBalls: { $sum: '$noBalls' },
        bestWickets: { $max: '$wickets' },
      },
    },
    {
      $project: {
        _id: 0,
        matches: 1,
        totalBalls: 1,
        totalRuns: 1,
        totalWickets: 1,
        wides: 1,
        noBalls: 1,
        bestWickets: 1,
        economy: {
          $cond: [
            { $eq: ['$totalBalls', 0] }, 0,
            { $multiply: [{ $divide: ['$totalRuns', '$totalBalls'] }, 6] },
          ],
        },
        average: {
          $cond: [
            { $eq: ['$totalWickets', 0] }, null,
            { $divide: ['$totalRuns', '$totalWickets'] },
          ],
        },
      },
    },
  ]);

  return result[0] || {
    matches: 0, totalBalls: 0, totalRuns: 0, totalWickets: 0,
    wides: 0, noBalls: 0, bestWickets: 0, economy: 0, average: null,
  };
};

/**
 * Leaderboard: top batsmen or bowlers.
 */
const getLeaderboard = async (type = 'batting', limit = 20) => {
  const groupField = type === 'batting' ? '$batsman' : '$bowler';

  if (type === 'batting') {
    return Ball.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: groupField,
          totalRuns: { $sum: '$runs' },
          matches: { $addToSet: '$matchId' },
        },
      },
      { $sort: { totalRuns: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'player',
        },
      },
      { $unwind: { path: '$player', preserveNullAndEmpty: true } },
      {
        $project: {
          player: { name: 1, avatar: 1 },
          totalRuns: 1,
          matches: { $size: '$matches' },
        },
      },
    ]);
  }

  return Ball.aggregate([
    {
      $match: {
        isDeleted: false,
        wicket: { $ne: null },
        'wicket.type': { $nin: ['run_out', 'obstructing_field', 'handled_ball', 'timed_out', 'hit_twice'] },
      },
    },
    {
      $group: {
        _id: groupField,
        totalWickets: { $sum: 1 },
        matches: { $addToSet: '$matchId' },
      },
    },
    { $sort: { totalWickets: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' },
    },
    { $unwind: { path: '$player', preserveNullAndEmpty: true } },
    {
      $project: {
        player: { name: 1, avatar: 1 },
        totalWickets: 1,
        matches: { $size: '$matches' },
      },
    },
  ]);
};

const getMatchStats = async (matchId) => {
  const mid = new mongoose.Types.ObjectId(matchId);

  const [topScorer, topBowler, highestPartnership] = await Promise.all([
    Ball.aggregate([
      { $match: { matchId: mid, isDeleted: false } },
      { $group: { _id: '$batsman', runs: { $sum: '$runs' } } },
      { $sort: { runs: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' } },
      { $unwind: '$player' },
    ]),
    Ball.aggregate([
      {
        $match: {
          matchId: mid, isDeleted: false,
          wicket: { $ne: null },
          'wicket.type': { $nin: ['run_out', 'obstructing_field'] },
        },
      },
      { $group: { _id: '$bowler', wickets: { $sum: 1 } } },
      { $sort: { wickets: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' } },
      { $unwind: '$player' },
    ]),
  ]);

  return {
    topScorer: topScorer[0] || null,
    topBowler: topBowler[0] || null,
  };
};

module.exports = { getPlayerBattingStats, getPlayerBowlingStats, getLeaderboard, getMatchStats };
