const Ball = require('../../models/Ball');
const Match = require('../../models/Match');
const ScoreSummary = require('../../models/ScoreSummary');
const User = require('../../models/User');
const { buildScorecard } = require('../../utils/scoring-engine');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Recompute the full ScoreSummary from the ball log.
 * Called after every add/edit/delete/undo.
 */
const recomputeSummary = async (matchId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const maxOvers = match.totalOvers;
  const inningsSummaries = [];

  for (const inningsNum of [1, 2]) {
    const balls = await Ball.find({ matchId, innings: inningsNum, isDeleted: false })
      .sort({ over: 1, ball: 1 })
      .lean();

    if (balls.length === 0 && inningsNum === 2 && match.state !== 'SECOND_INNINGS' && match.state !== 'COMPLETED') {
      continue;
    }

    const sc = buildScorecard(balls, maxOvers);

    // Enrich player names
    const playerIds = [
      ...sc.batting.map((b) => b.playerId),
      ...sc.bowling.map((b) => b.playerId),
    ].filter(Boolean);

    const users = await User.find({ _id: { $in: playerIds } }).select('name').lean();
    const nameMap = {};
    users.forEach((u) => { nameMap[u._id.toString()] = u.name; });

    const battingTeamId = inningsNum === 1
      ? match.innings?.first?.battingTeam
      : match.innings?.second?.battingTeam;

    inningsSummaries.push({
      battingTeam: battingTeamId,
      totalRuns: sc.totalRuns,
      wickets: sc.wickets,
      overs: sc.currentState.over,
      balls: sc.currentState.ball,
      extras: sc.extras,
      runRate: sc.runRate,
      batting: sc.batting.map((b) => ({
        ...b,
        playerName: nameMap[b.playerId] || 'Unknown',
      })),
      bowling: sc.bowling.map((b) => ({
        ...b,
        playerName: nameMap[b.playerId] || 'Unknown',
      })),
      fallOfWickets: sc.fallOfWickets,
    });
  }

  // Current innings state
  const currentInningsNum = match.state === 'SECOND_INNINGS' || match.state === 'COMPLETED' ? 2 : 1;
  const currentSummary = inningsSummaries[currentInningsNum - 1];
  const latestBall = await Ball.findOne({ matchId, innings: currentInningsNum, isDeleted: false })
    .sort({ over: -1, ball: -1 });

  const target = match.innings?.second?.target || null;
  const currentRuns = currentSummary?.totalRuns || 0;
  const totalBallsBowled = (currentSummary?.overs || 0) * 6 + (currentSummary?.balls || 0);
  const remainingBalls = maxOvers * 6 - totalBallsBowled;
  const requiredRuns = target ? target - currentRuns : null;
  const requiredRate = (target && remainingBalls > 0)
    ? parseFloat(((requiredRuns / remainingBalls) * 6).toFixed(2))
    : null;

  const updateData = {
    innings: inningsSummaries,
    lastBallId: latestBall?._id || null,
    computedAt: new Date(),
    'currentState.innings': currentInningsNum,
    'currentState.over': currentSummary?.overs || 0,
    'currentState.ball': currentSummary?.balls || 0,
    'currentState.totalRuns': currentSummary?.totalRuns || 0,
    'currentState.wickets': currentSummary?.wickets || 0,
    'currentState.target': target,
    'currentState.requiredRuns': requiredRuns,
    'currentState.requiredRate': requiredRate,
    'currentState.currentRate': currentSummary?.runRate || 0,
  };

  if (latestBall) {
    // strikerAfter === null means wicket — keep null (new batsman not yet set).
    // Only fall back to batsman if field was never stored (undefined).
    updateData['currentState.striker'] =
      latestBall.strikerAfter !== undefined ? latestBall.strikerAfter : latestBall.batsman;
    updateData['currentState.nonStriker'] = latestBall.nonStrikerAfter;
    updateData['currentState.currentBowler'] = latestBall.bowler;
  }

  const summary = await ScoreSummary.findOneAndUpdate(
    { matchId },
    { $set: updateData },
    { new: true, upsert: true }
  );

  return summary;
};

const getFullScorecard = async (matchId) => {
  const [match, summary] = await Promise.all([
    Match.findById(matchId)
      .populate('teamA', 'name shortName logo color')
      .populate('teamB', 'name shortName logo color'),
    ScoreSummary.findOne({ matchId })
      .populate('currentState.striker', 'name')
      .populate('currentState.nonStriker', 'name')
      .populate('currentState.currentBowler', 'name'),
  ]);

  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  return { match, summary };
};

const getLiveSummary = async (matchId) => {
  return ScoreSummary.findOne({ matchId })
    .populate('currentState.striker', 'name')
    .populate('currentState.nonStriker', 'name')
    .populate('currentState.currentBowler', 'name');
};

module.exports = { recomputeSummary, getFullScorecard, getLiveSummary };
