const Ball = require('../../models/Ball');
const Match = require('../../models/Match');
const AuditLog = require('../../models/AuditLog');
const { AppError } = require('../../middlewares/errorHandler');
const { validateBallInput, isLegalDelivery } = require('../../utils/scoring-engine');
const { recomputeSummary } = require('./scoreSummary.service');
const { emitMatchUpdate } = require('../../sockets');

/**
 * Add a new ball to the match.
 * Returns the ball + updated summary.
 */
const addBall = async (matchId, data, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const validStates = ['FIRST_INNINGS', 'SECOND_INNINGS'];
  if (!validStates.includes(match.state)) {
    throw new AppError(`Cannot score in match state: ${match.state}`, 400, 'INVALID_STATE');
  }

  // Engine-level validation
  const errors = validateBallInput(data);
  if (errors.length) throw new AppError(errors.join('; '), 400, 'VALIDATION_ERROR');

  // Determine over/ball number from existing balls
  const innings = data.innings;
  const lastBall = await Ball.findOne({ matchId, innings, isDeleted: false })
    .sort({ over: -1, ball: -1 });

  let over = 0, ball = 1;
  if (lastBall) {
    if (isLegalDelivery(lastBall)) {
      // last was legal
      if (lastBall.ball >= 6) {
        over = lastBall.over + 1;
        ball = 1;
      } else {
        over = lastBall.over;
        ball = lastBall.ball + 1;
      }
    } else {
      // last was wide/no-ball — same over/ball slot
      over = lastBall.over;
      ball = lastBall.ball;
    }
  }

  const legal = isLegalDelivery(data);

  const newBall = await Ball.create({
    matchId,
    innings: data.innings,
    over,
    ball,
    batsman: data.batsman,
    bowler: data.bowler,
    runs: data.runs,
    extras: data.extras || {},
    wicket: data.wicket || null,
    isLegal: legal,
    strikerAfter: data.strikerAfter || null,
    nonStrikerAfter: data.nonStrikerAfter || null,
    shotRegion: data.shotRegion || null,
  });

  // Update match innings state
  const inningsKey = innings === 1 ? 'first' : 'second';
  const totalRuns = (data.runs || 0) + (data.extras?.runs || 0);

  await Match.findByIdAndUpdate(matchId, {
    $inc: {
      [`innings.${inningsKey}.totalRuns`]: totalRuns,
      [`innings.${inningsKey}.wickets`]: data.wicket ? 1 : 0,
      [`innings.${inningsKey}.balls`]: legal ? 1 : 0,
    },
  });

  // Recompute summary (source of truth)
  const summary = await recomputeSummary(matchId);

  // Check auto-completion conditions
  await _checkInningsCompletion(matchId, match, innings, summary);

  await AuditLog.create({
    matchId,
    userId,
    action: 'BALL_ADDED',
    entityId: newBall._id,
    entityType: 'Ball',
    after: newBall.toObject(),
  });

  // Real-time broadcast
  emitMatchUpdate(matchId, 'BALL_ADDED', { ball: newBall, summary });

  return { ball: newBall, summary };
};

const _checkInningsCompletion = async (matchId, match, innings, summary) => {
  const inningsSummary = summary.innings[innings - 1];
  if (!inningsSummary) return;

  const currentInningsKey = innings === 1 ? 'first' : 'second';
  const maxOvers = match.totalOvers;
  const oversComplete = inningsSummary.overs >= maxOvers && inningsSummary.balls === 0;
  const allOut = inningsSummary.wickets >= 10;

  // Second innings: target achieved
  const target = match.innings?.second?.target;
  const targetAchieved = innings === 2 && target && inningsSummary.totalRuns >= target;

  if (oversComplete || allOut || targetAchieved) {
    const { endInnings } = require('../matches/matches.service');
    try {
      await endInnings(matchId, null);
    } catch { /* silent - state may already be updated */ }
  }
};

/**
 * Undo the last ball — marks as deleted and recomputes.
 */
const undoBall = async (matchId, innings, userId) => {
  const ball = await Ball.findOne({ matchId, innings, isDeleted: false })
    .sort({ over: -1, ball: -1 });

  if (!ball) throw new AppError('No ball to undo', 404, 'NOT_FOUND');

  const before = ball.toObject();
  ball.isDeleted = true;
  ball.editedAt = new Date();
  ball.editedBy = userId;
  await ball.save();

  const summary = await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_UNDONE',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: { isDeleted: true },
  });

  emitMatchUpdate(matchId, 'MATCH_UPDATED', { summary });

  return { ball, summary };
};

/**
 * Edit any ball by ID — full recompute after change.
 */
const editBall = async (matchId, ballId, updates, userId) => {
  const ball = await Ball.findOne({ _id: ballId, matchId, isDeleted: false });
  if (!ball) throw new AppError('Ball not found', 404, 'NOT_FOUND');

  const before = ball.toObject();

  Object.assign(ball, {
    ...updates,
    editedAt: new Date(),
    editedBy: userId,
    isLegal: isLegalDelivery({ ...ball.toObject(), ...updates }),
  });

  await ball.save();

  const summary = await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_EDITED',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: ball.toObject(),
  });

  emitMatchUpdate(matchId, 'MATCH_UPDATED', { summary });

  return { ball, summary };
};

/**
 * Delete a ball (hard) and recompute.
 */
const deleteBall = async (matchId, ballId, userId) => {
  const ball = await Ball.findOne({ _id: ballId, matchId });
  if (!ball) throw new AppError('Ball not found', 404, 'NOT_FOUND');

  const before = ball.toObject();
  ball.isDeleted = true;
  ball.editedAt = new Date();
  ball.editedBy = userId;
  await ball.save();

  const summary = await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_DELETED',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: { isDeleted: true },
  });

  emitMatchUpdate(matchId, 'MATCH_UPDATED', { summary });

  return { summary };
};

/**
 * Get the ball-by-ball log for an innings.
 */
const getBalls = async (matchId, innings) => {
  return Ball.find({ matchId, innings, isDeleted: false })
    .populate('batsman', 'name')
    .populate('bowler', 'name')
    .populate('wicket.batsmanOut', 'name')
    .populate('wicket.fielder', 'name')
    .sort({ over: 1, ball: 1 });
};

/**
 * Get the last N balls (for scoreboard display).
 */
const getRecentBalls = async (matchId, innings, count = 6) => {
  return Ball.find({ matchId, innings, isDeleted: false })
    .sort({ over: -1, ball: -1 })
    .limit(count)
    .populate('batsman', 'name')
    .populate('bowler', 'name');
};

/**
 * Get full audit trail for a match.
 */
const getAuditLog = async (matchId) => {
  return AuditLog.find({ matchId })
    .populate('userId', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
};

/**
 * Update current players (striker / non-striker / bowler) mid-innings.
 * Used after a wicket when the new batsman is selected.
 */
const setCurrentPlayers = async (matchId, { striker, nonStriker, bowler }) => {
  const ScoreSummary = require('../../models/ScoreSummary');

  const update = {};
  if (striker    !== undefined) update['currentState.striker']       = striker    || null;
  if (nonStriker !== undefined) update['currentState.nonStriker']    = nonStriker || null;
  if (bowler     !== undefined) update['currentState.currentBowler'] = bowler     || null;

  const summary = await ScoreSummary.findOneAndUpdate(
    { matchId },
    { $set: update },
    { new: true },
  )
    .populate('currentState.striker', 'name')
    .populate('currentState.nonStriker', 'name')
    .populate('currentState.currentBowler', 'name');

  return summary;
};

module.exports = {
  addBall, undoBall, editBall, deleteBall,
  getBalls, getRecentBalls, getAuditLog,
  setCurrentPlayers,
};
