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

  const SUPER_OVER_STATES = ['SUPER_OVER_BREAK', 'SUPER_OVER_1', 'SUPER_OVER_INNINGS_BREAK', 'SUPER_OVER_2'];
  const hasSuperOver = match.superOver?.first != null;
  const isSuperOverPhase = SUPER_OVER_STATES.includes(match.state) || hasSuperOver;
  const maxOvers = match.totalOvers;
  const inningsSummaries = [];

  const inningsToProcess = isSuperOverPhase ? [1, 2, 3, 4] : [1, 2];

  for (const inningsNum of inningsToProcess) {
    const balls = await Ball.find({ matchId, innings: inningsNum, isDeleted: false })
      .sort({ over: 1, ball: 1 })
      .lean();

    if (inningsNum === 2 && balls.length === 0 && match.state !== 'SECOND_INNINGS' && match.state !== 'COMPLETED' && !isSuperOverPhase) {
      inningsSummaries.push(null);
      continue;
    }
    if ((inningsNum === 3 || inningsNum === 4) && balls.length === 0) {
      inningsSummaries.push(null);
      continue;
    }

    const effectiveMaxOvers = inningsNum >= 3 ? 1 : maxOvers;
    const sc = buildScorecard(balls, effectiveMaxOvers);

    const playerIds = [
      ...sc.batting.map((b) => b.playerId),
      ...sc.bowling.map((b) => b.playerId),
    ].filter(Boolean);

    const users = await User.find({ _id: { $in: playerIds } }).select('name').lean();
    const nameMap = {};
    users.forEach((u) => { nameMap[u._id.toString()] = u.name; });

    const battingTeamId =
      inningsNum === 1 ? match.innings?.first?.battingTeam
      : inningsNum === 2 ? match.innings?.second?.battingTeam
      : inningsNum === 3 ? match.superOver?.first?.battingTeam
      : match.superOver?.second?.battingTeam;

    inningsSummaries.push({
      battingTeam: battingTeamId,
      totalRuns: sc.totalRuns,
      wickets: sc.wickets,
      overs: sc.currentState.over,
      balls: sc.currentState.ball,
      extras: sc.extras,
      runRate: sc.runRate,
      batting: sc.batting.map((b) => ({ ...b, playerName: nameMap[b.playerId] || 'Unknown' })),
      bowling: sc.bowling.map((b) => ({ ...b, playerName: nameMap[b.playerId] || 'Unknown' })),
      fallOfWickets: sc.fallOfWickets,
    });
  }

  // Current innings state
  const STATE_TO_INNINGS = {
    FIRST_INNINGS: 1, INNINGS_BREAK: 1,
    SECOND_INNINGS: 2,
    SUPER_OVER_BREAK: 3, SUPER_OVER_1: 3, SUPER_OVER_INNINGS_BREAK: 3,
    SUPER_OVER_2: 4,
    COMPLETED: hasSuperOver ? 4 : 2,
  };
  const currentInningsNum = STATE_TO_INNINGS[match.state] || 1;
  const currentSummary = inningsSummaries[currentInningsNum - 1];
  const latestBall = await Ball.findOne({ matchId, innings: currentInningsNum, isDeleted: false })
    .sort({ over: -1, ball: -1 });

  const target = currentInningsNum === 4
    ? (match.superOver?.second?.target || null)
    : (match.innings?.second?.target || null);
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
      .populate('teamA', 'name shortName logo color players')
      .populate('teamB', 'name shortName logo color players'),
    ScoreSummary.findOne({ matchId })
      .populate('currentState.striker', 'name')
      .populate('currentState.nonStriker', 'name')
      .populate('currentState.currentBowler', 'name'),
  ]);

  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const summaryObj = summary ? summary.toObject() : null;

  if (summaryObj && summaryObj.innings) {
    for (const inningsNum of [1, 2]) {
      if (!summaryObj.innings[inningsNum - 1]) continue;

      const balls = await Ball.find({ matchId, innings: inningsNum, isDeleted: false })
        .sort({ over: 1, ball: 1 }).lean();

      if (balls.length === 0) continue;

      const sc = buildScorecard(balls, match.totalOvers);

      const partnerIds = [...new Set(
        sc.partnerships.flatMap(p => [p.batter1, p.batter2].filter(Boolean)),
      )];
      const partnerUsers = partnerIds.length > 0
        ? await User.find({ _id: { $in: partnerIds } }).select('name').lean()
        : [];
      const partnerNameMap = {};
      partnerUsers.forEach(u => { partnerNameMap[u._id.toString()] = u.name; });

      summaryObj.innings[inningsNum - 1].partnerships = sc.partnerships.map(p => ({
        ...p,
        batter1Name: partnerNameMap[p.batter1] || 'Unknown',
        batter2Name: p.batter2 ? (partnerNameMap[p.batter2] || 'Unknown') : null,
      }));
      summaryObj.innings[inningsNum - 1].perOverData = sc.perOverData;

      // Ball-by-ball labels per batsman (for player card modal)
      const ballsByPlayer = {};
      for (const ball of balls) {
        if (ball.isDeleted) continue;
        const bid = ball.batsman?.toString();
        if (!bid) continue;
        if (!ballsByPlayer[bid]) ballsByPlayer[bid] = [];
        let label;
        if (ball.wicket) label = 'W';
        else if (ball.extras?.type === 'wide') label = 'Wd';
        else if (ball.extras?.type === 'no_ball') label = 'Nb';
        else label = String(ball.runs || 0);
        ballsByPlayer[bid].push(label);
      }
      summaryObj.innings[inningsNum - 1].ballsByPlayer = ballsByPlayer;

      // Runs per shot region per batsman (for wagon wheel)
      const runsByRegion = {};
      for (const ball of balls) {
        if (ball.isDeleted || !ball.shotRegion) continue;
        const bid = ball.batsman?.toString();
        if (!bid) continue;
        if (!runsByRegion[bid]) runsByRegion[bid] = {};
        const r = ball.shotRegion;
        runsByRegion[bid][r] = (runsByRegion[bid][r] || 0) + (ball.runs || 0);
      }
      summaryObj.innings[inningsNum - 1].runsByRegion = runsByRegion;
    }
  }

  return { match, summary: summaryObj };
};

const getMatchGraphData = async (matchId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const innings = [];

  for (const inningsNum of [1, 2]) {
    const balls = await Ball.find({ matchId, innings: inningsNum, isDeleted: false })
      .sort({ over: 1, ball: 1 }).lean();

    if (balls.length === 0) continue;

    const sc = buildScorecard(balls, match.totalOvers);

    let cumulative = 0;
    const worm = sc.perOverData.map(o => {
      cumulative += o.runs;
      return { over: o.over, totalRuns: cumulative };
    });

    innings.push({ inningsNum, overs: sc.perOverData, worm });
  }

  return { innings };
};

const getLiveSummary = async (matchId) => {
  return ScoreSummary.findOne({ matchId })
    .populate('currentState.striker', 'name')
    .populate('currentState.nonStriker', 'name')
    .populate('currentState.currentBowler', 'name');
};

module.exports = { recomputeSummary, getFullScorecard, getLiveSummary, getMatchGraphData };
