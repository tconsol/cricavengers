const Ball = require('../../models/Ball');
const Match = require('../../models/Match');
const mongoose = require('mongoose');

const NOT_BOWLER_WICKETS = ['run_out', 'obstructing_field', 'handled_ball', 'timed_out', 'hit_twice'];

// ─── Batting ────────────────────────────────────────────────────────────────

const getPlayerBattingStats = async (playerId) => {
  const pid = new mongoose.Types.ObjectId(playerId);

  const balls = await Ball.find({ batsman: pid, isDeleted: false })
    .select('matchId innings runs extras wicket')
    .lean();

  if (!balls.length) return emptyBatting();

  // Per-innings accumulator keyed by "matchId-innings"
  const inningsMap = new Map();

  for (const ball of balls) {
    const key = `${ball.matchId}-${ball.innings}`;
    if (!inningsMap.has(key)) {
      inningsMap.set(key, {
        matchId: ball.matchId.toString(),
        inningsNum: ball.innings,
        runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, isOut: false,
      });
    }
    const inn = inningsMap.get(key);
    const extraType = ball.extras?.type;
    const isLegal = extraType !== 'wide' && extraType !== 'no_ball';

    // Balls faced: legal deliveries that aren't byes/leg-byes
    if (isLegal && extraType !== 'bye' && extraType !== 'leg_bye') {
      inn.balls++;
      if ((ball.runs || 0) === 0) inn.dots++;
    }

    // Runs to batsman: not byes/leg-byes
    if (!extraType || extraType === 'no_ball') {
      const r = ball.runs || 0;
      inn.runs += r;
      if (r === 4) inn.fours++;
      if (r === 6) inn.sixes++;
    }

    if (ball.wicket) inn.isOut = true;
  }

  const inningsList = Array.from(inningsMap.values());

  // Fetch completed matches for won/loss calculation
  const matchIds = [...new Set(inningsList.map(i => i.matchId))];
  const matches = await Match.find({ _id: { $in: matchIds } })
    .select('teamA teamB innings.first.battingTeam innings.second.battingTeam result state')
    .lean();
  const matchMap = {};
  for (const m of matches) matchMap[m._id.toString()] = m;

  let totalRuns = 0, totalBalls = 0, fours = 0, sixes = 0;
  let dismissals = 0, notOuts = 0, ducks = 0;
  let thirties = 0, fifties = 0, hundreds = 0;
  let won = 0, loss = 0;
  let highScore = 0, highScoreNotOut = false;
  const matchSet = new Set();
  const processedWL = new Set();

  for (const inn of inningsList) {
    matchSet.add(inn.matchId);
    totalRuns += inn.runs;
    totalBalls += inn.balls;
    fours += inn.fours;
    sixes += inn.sixes;

    if (inn.isOut) dismissals++;
    else notOuts++;

    if (inn.runs > highScore || (inn.runs === highScore && !inn.isOut)) {
      highScore = inn.runs;
      highScoreNotOut = !inn.isOut;
    }

    if (inn.runs === 0 && inn.isOut) ducks++;
    if (inn.runs >= 100) hundreds++;
    else if (inn.runs >= 50) fifties++;
    else if (inn.runs >= 30) thirties++;

    // Won/loss: once per match
    if (!processedWL.has(inn.matchId)) {
      processedWL.add(inn.matchId);
      const m = matchMap[inn.matchId];
      if (m && m.state === 'COMPLETED' && m.result?.winner) {
        const battingTeamId = inn.inningsNum === 1
          ? m.innings?.first?.battingTeam?.toString()
          : m.innings?.second?.battingTeam?.toString();
        if (battingTeamId === m.result.winner.toString()) won++;
        else loss++;
      }
    }
  }

  const avg = dismissals > 0 ? totalRuns / dismissals : totalRuns;

  return {
    matches: matchSet.size,
    innings: inningsList.length,
    notOuts,
    totalRuns,
    highScore,
    highScoreNotOut,
    average: parseFloat(avg.toFixed(2)),
    strikeRate: totalBalls > 0 ? parseFloat(((totalRuns / totalBalls) * 100).toFixed(2)) : 0,
    thirties,
    fifties,
    hundreds,
    fours,
    sixes,
    ducks,
    won,
    loss,
  };
};

const emptyBatting = () => ({
  matches: 0, innings: 0, notOuts: 0, totalRuns: 0, highScore: 0,
  highScoreNotOut: false, average: 0, strikeRate: 0,
  thirties: 0, fifties: 0, hundreds: 0, fours: 0, sixes: 0, ducks: 0, won: 0, loss: 0,
});

// ─── Bowling ────────────────────────────────────────────────────────────────

const getPlayerBowlingStats = async (playerId) => {
  const pid = new mongoose.Types.ObjectId(playerId);

  const balls = await Ball.find({ bowler: pid, isDeleted: false })
    .select('matchId innings over runs extras wicket')
    .lean();

  if (!balls.length) return emptyBowling();

  const overMap = new Map();     // key: matchId-innings-over → {runs, balls, wickets}
  const inningsMap = new Map();  // key: matchId-innings → per-innings summary

  for (const ball of balls) {
    const extraType = ball.extras?.type;
    const isLegal = extraType !== 'wide' && extraType !== 'no_ball';

    const runsConceded = extraType === 'wide'
      ? (ball.extras?.runs || 1)
      : extraType === 'no_ball'
      ? 1 + (ball.runs || 0)
      : (ball.runs || 0);

    const isBowlerWicket = ball.wicket && !NOT_BOWLER_WICKETS.includes(ball.wicket.type);

    // Over grouping (for maidens)
    const overKey = `${ball.matchId}-${ball.innings}-${ball.over}`;
    if (!overMap.has(overKey)) overMap.set(overKey, { runs: 0, balls: 0 });
    const ov = overMap.get(overKey);
    if (isLegal) ov.balls++;
    ov.runs += runsConceded;

    // Innings grouping
    const innKey = `${ball.matchId}-${ball.innings}`;
    if (!inningsMap.has(innKey)) {
      inningsMap.set(innKey, {
        matchId: ball.matchId.toString(),
        balls: 0, runs: 0, wickets: 0,
        wides: 0, noBalls: 0, dots: 0, fours: 0, sixes: 0,
      });
    }
    const inn = inningsMap.get(innKey);
    if (isLegal) inn.balls++;
    inn.runs += runsConceded;
    if (extraType === 'wide') inn.wides++;
    if (extraType === 'no_ball') inn.noBalls++;
    if (isLegal && !extraType && (ball.runs || 0) === 0 && !ball.wicket) inn.dots++;
    if ((ball.runs || 0) === 4) inn.fours++;
    if ((ball.runs || 0) === 6) inn.sixes++;
    if (isBowlerWicket) inn.wickets++;
  }

  // Maiden overs: completed (6 balls) overs with 0 runs
  let maidens = 0;
  for (const ov of overMap.values()) {
    if (ov.balls === 6 && ov.runs === 0) maidens++;
  }

  const inningsList = Array.from(inningsMap.values());

  let totalBalls = 0, totalRuns = 0, totalWickets = 0;
  let wides = 0, noBalls = 0, dots = 0, fours = 0, sixes = 0;
  let threeWicketHauls = 0, fiveWicketHauls = 0;
  let bestWickets = 0, bestRuns = Infinity;
  const matchSet = new Set();

  for (const inn of inningsList) {
    matchSet.add(inn.matchId);
    totalBalls += inn.balls;
    totalRuns += inn.runs;
    totalWickets += inn.wickets;
    wides += inn.wides;
    noBalls += inn.noBalls;
    dots += inn.dots;
    fours += inn.fours;
    sixes += inn.sixes;

    if (inn.wickets >= 5) fiveWicketHauls++;
    else if (inn.wickets >= 3) threeWicketHauls++;

    if (inn.wickets > bestWickets || (inn.wickets === bestWickets && inn.runs < bestRuns)) {
      bestWickets = inn.wickets;
      bestRuns = inn.runs;
    }
  }

  const overs = Math.floor(totalBalls / 6);
  const rem = totalBalls % 6;

  return {
    matches: matchSet.size,
    innings: inningsList.length,
    overs: `${overs}.${rem}`,
    totalBalls,
    totalRuns,
    totalWickets,
    wides,
    noBalls,
    maidens,
    dots,
    bestBowling: bestWickets > 0 ? `${bestWickets}/${bestRuns}` : '-',
    threeWicketHauls,
    fiveWicketHauls,
    economy: totalBalls > 0 ? parseFloat(((totalRuns / totalBalls) * 6).toFixed(2)) : 0,
    strikeRate: totalWickets > 0 ? parseFloat((totalBalls / totalWickets).toFixed(2)) : null,
    average: totalWickets > 0 ? parseFloat((totalRuns / totalWickets).toFixed(2)) : null,
    foursConceded: fours,
    sixesConceded: sixes,
  };
};

const emptyBowling = () => ({
  matches: 0, innings: 0, overs: '0.0', totalBalls: 0, totalRuns: 0, totalWickets: 0,
  wides: 0, noBalls: 0, maidens: 0, dots: 0, bestBowling: '-',
  threeWicketHauls: 0, fiveWicketHauls: 0,
  economy: 0, strikeRate: null, average: null,
  foursConceded: 0, sixesConceded: 0,
});

// ─── Fielding ───────────────────────────────────────────────────────────────

const getPlayerFieldingStats = async (playerId) => {
  const pid = new mongoose.Types.ObjectId(playerId);

  const [catches, caughtAndBowled, stumpings, runOuts] = await Promise.all([
    Ball.countDocuments({ 'wicket.fielder': pid, 'wicket.type': 'caught', isDeleted: false }),
    Ball.countDocuments({ bowler: pid, 'wicket.type': 'caught_and_bowled', isDeleted: false }),
    Ball.countDocuments({ 'wicket.fielder': pid, 'wicket.type': 'stumped', isDeleted: false }),
    Ball.countDocuments({ 'wicket.fielder': pid, 'wicket.type': 'run_out', isDeleted: false }),
  ]);

  const matchIds = await Ball.distinct('matchId', {
    $or: [
      { 'wicket.fielder': pid, isDeleted: false },
      { bowler: pid, 'wicket.type': 'caught_and_bowled', isDeleted: false },
    ],
  });

  return {
    matches: matchIds.length,
    catches,
    caughtAndBowled,
    stumpings,
    runOuts,
    totalDismissals: catches + caughtAndBowled + stumpings + runOuts,
  };
};

// ─── Leaderboard ────────────────────────────────────────────────────────────

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
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' } },
      { $unwind: { path: '$player', preserveNullAndEmptyArrays: true } },
      { $project: { player: { name: 1, avatar: 1 }, totalRuns: 1, matches: { $size: '$matches' } } },
    ]);
  }

  return Ball.aggregate([
    {
      $match: {
        isDeleted: false,
        wicket: { $ne: null },
        'wicket.type': { $nin: NOT_BOWLER_WICKETS },
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
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' } },
    { $unwind: { path: '$player', preserveNullAndEmpty: true } },
    { $project: { player: { name: 1, avatar: 1 }, totalWickets: 1, matches: { $size: '$matches' } } },
  ]);
};

// ─── Match Stats ─────────────────────────────────────────────────────────────

const getMatchStats = async (matchId) => {
  const mid = new mongoose.Types.ObjectId(matchId);

  const [topScorer, topBowler] = await Promise.all([
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
          'wicket.type': { $nin: NOT_BOWLER_WICKETS },
        },
      },
      { $group: { _id: '$bowler', wickets: { $sum: 1 } } },
      { $sort: { wickets: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'player' } },
      { $unwind: '$player' },
    ]),
  ]);

  return { topScorer: topScorer[0] || null, topBowler: topBowler[0] || null };
};

module.exports = {
  getPlayerBattingStats,
  getPlayerBowlingStats,
  getPlayerFieldingStats,
  getLeaderboard,
  getMatchStats,
};
