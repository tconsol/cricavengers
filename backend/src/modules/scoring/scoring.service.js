const Ball = require('../../models/Ball');
const Match = require('../../models/Match');
const AuditLog = require('../../models/AuditLog');
const { AppError } = require('../../middlewares/errorHandler');
const { validateBallInput, isLegalDelivery } = require('../../utils/scoring-engine');
const { recomputeSummary, getLiveSummary } = require('./scoreSummary.service');
const { emitMatchUpdate, emitToAll } = require('../../sockets');

/**
 * Add a new ball to the match.
 * Returns the ball + updated summary.
 */
const addBall = async (matchId, data, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const STATE_TO_INNINGS = { FIRST_INNINGS: 1, SECOND_INNINGS: 2, SUPER_OVER_1: 3, SUPER_OVER_2: 4 };
  const validStates = Object.keys(STATE_TO_INNINGS);
  if (!validStates.includes(match.state)) {
    throw new AppError(`Cannot score in match state: ${match.state}`, 400, 'INVALID_STATE');
  }

  // Engine-level validation
  const errors = validateBallInput(data);
  if (errors.length) throw new AppError(errors.join('; '), 400, 'VALIDATION_ERROR');

  // Innings number is derived from match state (not client input) for safety
  const innings = STATE_TO_INNINGS[match.state];

  const computeNextSlot = async () => {
    const last = await Ball.findOne({ matchId, innings, isDeleted: false })
      .sort({ over: -1, ball: -1 });

    if (!last) return { over: 0, ball: 1 };

    // Count legal deliveries in the current over (sequential ball# can exceed 6 due to
    // wides/no-balls, so we must use legal count — NOT last.ball — to detect over completion).
    const legalInOver = await Ball.countDocuments({
      matchId, innings, over: last.over, isLegal: true, isDeleted: false,
    });

    if (legalInOver >= 6) {
      return { over: last.over + 1, ball: 1 };
    }
    return { over: last.over, ball: last.ball + 1 };
  };

  let { over, ball } = await computeNextSlot();

  const legal = isLegalDelivery(data);

  let newBall;
  try {
    newBall = await Ball.create({
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
  } catch (err) {
    // E11000: two concurrent requests computed the same (over, ball) slot.
    // Re-derive the slot with the freshest DB state and retry once.
    if (err.code === 11000) {
      ({ over, ball } = await computeNextSlot());
      newBall = await Ball.create({
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
    } else {
      throw err;
    }
  }

  // Update match innings state (regular or super over)
  const isSuperOver = innings >= 3;
  const inningsKey = (innings === 1 || innings === 3) ? 'first' : 'second';
  const inningsPath = isSuperOver ? `superOver.${inningsKey}` : `innings.${inningsKey}`;
  const totalRuns = (data.runs || 0) + (data.extras?.runs || 0);

  await Match.findByIdAndUpdate(matchId, {
    $inc: {
      [`${inningsPath}.totalRuns`]: totalRuns,
      [`${inningsPath}.wickets`]: data.wicket ? 1 : 0,
      [`${inningsPath}.balls`]: legal ? 1 : 0,
    },
  });

  // Recompute summary (source of truth)
  const rawSummary = await recomputeSummary(matchId);

  // Check auto-completion conditions
  await _checkInningsCompletion(matchId, match, innings, rawSummary);

  await AuditLog.create({
    matchId,
    userId,
    action: 'BALL_ADDED',
    entityId: newBall._id,
    entityType: 'Ball',
    after: newBall.toObject(),
  });

  // Return populated summary so striker/bowler names are available on the client
  const summary = await getLiveSummary(matchId);

  // Real-time broadcast to match room (scorers / live viewers)
  emitMatchUpdate(matchId, 'BALL_ADDED', { ball: newBall, summary });

  // Lightweight global broadcast so home screen live cards update score without joining match room
  const cs = summary?.currentState;
  emitToAll('LIVE_SCORE_UPDATE', {
    matchId: matchId.toString(),
    innings: cs?.innings,
    totalRuns: cs?.totalRuns ?? 0,
    wickets: cs?.wickets ?? 0,
    over: cs?.over ?? 0,
    ball: cs?.ball ?? 0,
  });

  return { ball: newBall, summary };
};

const _checkInningsCompletion = async (matchId, match, innings, summary) => {
  const inningsSummary = summary.innings[innings - 1];
  if (!inningsSummary) return;

  // Super over = max 1 over; regular = match.totalOvers
  const isSuperOver = innings >= 3;
  const maxOvers = isSuperOver ? 1 : match.totalOvers;
  const oversComplete = inningsSummary.overs >= maxOvers && inningsSummary.balls === 0;
  const allOut = inningsSummary.wickets >= (isSuperOver ? 2 : 10); // super over: 2 wickets end it

  // Target achieved (2nd innings of each phase)
  const target = isSuperOver
    ? match.superOver?.second?.target
    : match.innings?.second?.target;
  const isSecondPhase = isSuperOver ? innings === 4 : innings === 2;
  const targetAchieved = isSecondPhase && target && inningsSummary.totalRuns >= target;

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
const undoBall = async (matchId, _inningsIgnored, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');
  const STATE_TO_INNINGS = { FIRST_INNINGS: 1, SECOND_INNINGS: 2, SUPER_OVER_1: 3, SUPER_OVER_2: 4 };
  const innings = STATE_TO_INNINGS[match.state];
  if (!innings) throw new AppError('Cannot undo in current match state', 400, 'INVALID_STATE');

  const ball = await Ball.findOne({ matchId, innings, isDeleted: false })
    .sort({ over: -1, ball: -1 });

  if (!ball) throw new AppError('No ball to undo', 404, 'NOT_FOUND');

  const before = ball.toObject();
  ball.isDeleted = true;
  ball.editedAt = new Date();
  ball.editedBy = userId;
  await ball.save();

  await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_UNDONE',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: { isDeleted: true },
  });

  const summary = await getLiveSummary(matchId);
  emitMatchUpdate(matchId, 'BALL_REMOVED', { removedBallId: ball._id.toString(), summary });

  // Update home screen live cards after undo
  const cs = summary?.currentState;
  emitToAll('LIVE_SCORE_UPDATE', {
    matchId: matchId.toString(),
    innings: cs?.innings,
    totalRuns: cs?.totalRuns ?? 0,
    wickets: cs?.wickets ?? 0,
    over: cs?.over ?? 0,
    ball: cs?.ball ?? 0,
  });

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

  await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_EDITED',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: ball.toObject(),
  });

  const summary = await getLiveSummary(matchId);
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

  await recomputeSummary(matchId);

  await AuditLog.create({
    matchId, userId,
    action: 'BALL_DELETED',
    entityId: ball._id,
    entityType: 'Ball',
    before,
    after: { isDeleted: true },
  });

  const summary = await getLiveSummary(matchId);
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
 * Used after a wicket (new batsman) or after each over (new bowler).
 * Emits BALL_ADDED socket so live viewers refresh instantly.
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

  // Broadcast to all live viewers so the live tab shows new batsman/bowler immediately
  emitMatchUpdate(matchId, 'PLAYER_CHANGED', { summary });

  return summary;
};

module.exports = {
  addBall, undoBall, editBall, deleteBall,
  getBalls, getRecentBalls, getAuditLog,
  setCurrentPlayers,
};
