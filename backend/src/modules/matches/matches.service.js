const Match = require('../../models/Match');
const ScoreSummary = require('../../models/ScoreSummary');
const AuditLog = require('../../models/AuditLog');
const { AppError } = require('../../middlewares/errorHandler');

const createMatch = async (data, createdBy) => {
  if (data.teamA === data.teamB) {
    throw new AppError('Team A and Team B must be different', 400, 'VALIDATION_ERROR');
  }

  const match = await Match.create({ ...data, createdBy });

  // Initialise empty score summary
  await ScoreSummary.create({ matchId: match._id });

  await AuditLog.create({
    matchId: match._id,
    userId: createdBy,
    action: 'MATCH_CREATED',
    entityId: match._id,
    entityType: 'Match',
    after: match.toObject(),
  });

  return match;
};

const getMatches = async (query, userId) => {
  const { page = 1, limit = 20, state, mine, teamId } = query;
  const filter = {};

  if (state) filter.state = state;
  if (mine === 'true') filter.createdBy = userId;
  if (teamId) filter.$or = [{ teamA: teamId }, { teamB: teamId }];

  const [matches, total] = await Promise.all([
    Match.find(filter)
      .populate('teamA', 'name shortName logo color')
      .populate('teamB', 'name shortName logo color')
      .populate('createdBy', 'name avatar')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ scheduledAt: -1 }),
    Match.countDocuments(filter),
  ]);

  return { matches, total, page: parseInt(page), limit: parseInt(limit) };
};

const getLiveMatches = async () => {
  return Match.find({
    state: { $in: ['FIRST_INNINGS', 'SECOND_INNINGS'] },
  })
    .populate('teamA', 'name shortName logo color')
    .populate('teamB', 'name shortName logo color')
    .sort({ updatedAt: -1 })
    .limit(20);
};

const getMatchById = async (id) => {
  const match = await Match.findById(id)
    .populate('teamA')
    .populate('teamB')
    .populate('createdBy', 'name avatar')
    .populate('roles.userId', 'name avatar');
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');
  return match;
};

const setToss = async (matchId, { winner, decision }, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  if (!match.canTransitionTo('TOSS_DONE')) {
    throw new AppError(`Cannot set toss in state: ${match.state}`, 400, 'INVALID_STATE');
  }

  // Validate winner is one of the teams
  if (![match.teamA.toString(), match.teamB.toString()].includes(winner)) {
    throw new AppError('Toss winner must be one of the match teams', 400, 'VALIDATION_ERROR');
  }

  match.toss = { winner, decision };
  match.transitionTo('TOSS_DONE');

  // Set up innings based on toss
  const battingTeam = decision === 'bat' ? winner
    : (match.teamA.toString() === winner ? match.teamB.toString() : match.teamA.toString());
  const bowlingTeam = battingTeam === match.teamA.toString()
    ? match.teamB.toString() : match.teamA.toString();

  match.innings.first = {
    battingTeam, bowlingTeam,
    totalRuns: 0, wickets: 0, overs: 0, balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
  };

  await match.save();

  await AuditLog.create({
    matchId, userId,
    action: 'TOSS_SET',
    entityId: matchId,
    entityType: 'Match',
    after: { winner, decision, battingTeam, bowlingTeam },
  });

  return match;
};

const startInnings = async (matchId, { innings, striker, nonStriker, bowler }, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const requiredState = innings === 1 ? 'TOSS_DONE' : 'INNINGS_BREAK';
  if (!match.canTransitionTo(innings === 1 ? 'FIRST_INNINGS' : 'SECOND_INNINGS')) {
    throw new AppError(`Cannot start innings ${innings} from state: ${match.state}`, 400, 'INVALID_STATE');
  }

  const inningsKey = innings === 1 ? 'first' : 'second';
  if (!match.innings[inningsKey]) throw new AppError('Innings not initialized', 400, 'INVALID_STATE');

  match.innings[inningsKey].striker = striker;
  match.innings[inningsKey].nonStriker = nonStriker;
  match.innings[inningsKey].currentBowler = bowler;

  if (innings === 2) {
    match.innings.second.target = match.innings.first.totalRuns + 1;
    // Set up second innings teams (reverse of first)
    const firstBatting = match.innings.first.battingTeam.toString();
    match.innings.second = {
      ...match.innings.second,
      battingTeam: match.innings.first.bowlingTeam,
      bowlingTeam: match.innings.first.battingTeam,
      striker,
      nonStriker,
      currentBowler: bowler,
      target: match.innings.first.totalRuns + 1,
    };
  }

  match.transitionTo(innings === 1 ? 'FIRST_INNINGS' : 'SECOND_INNINGS');
  await match.save();

  // Update score summary
  await ScoreSummary.findOneAndUpdate(
    { matchId },
    {
      'currentState.innings': innings,
      'currentState.striker': striker,
      'currentState.nonStriker': nonStriker,
      'currentState.currentBowler': bowler,
      'currentState.target': innings === 2 ? match.innings.second.target : null,
    }
  );

  await AuditLog.create({
    matchId, userId,
    action: 'INNINGS_STARTED',
    entityId: matchId,
    entityType: 'Match',
    after: { innings, striker, nonStriker, bowler },
  });

  return match;
};

const endInnings = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  if (match.state === 'FIRST_INNINGS') {
    match.innings.first.isCompleted = true;
    match.transitionTo('INNINGS_BREAK');

    // Set up second innings
    match.innings.second = {
      battingTeam: match.innings.first.bowlingTeam,
      bowlingTeam: match.innings.first.battingTeam,
      totalRuns: 0, wickets: 0, overs: 0, balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      target: match.innings.first.totalRuns + 1,
    };
  } else if (match.state === 'SECOND_INNINGS') {
    match.innings.second.isCompleted = true;
    match.transitionTo('COMPLETED');
    await _computeMatchResult(match);
  }

  await match.save();

  await AuditLog.create({
    matchId, userId,
    action: 'INNINGS_ENDED',
    entityId: matchId,
    entityType: 'Match',
  });

  return match;
};

const _computeMatchResult = async (match) => {
  const first = match.innings.first;
  const second = match.innings.second;
  const target = first.totalRuns + 1;

  if (second.totalRuns >= target) {
    match.result = {
      winner: second.battingTeam,
      winType: 'wickets',
      winMargin: 10 - second.wickets,
      description: `${10 - second.wickets} wicket${10 - second.wickets !== 1 ? 's' : ''} win`,
    };
  } else if (second.totalRuns < first.totalRuns) {
    match.result = {
      winner: first.battingTeam,
      winType: 'runs',
      winMargin: first.totalRuns - second.totalRuns,
      description: `${first.totalRuns - second.totalRuns} run${first.totalRuns - second.totalRuns !== 1 ? 's' : ''} win`,
    };
  } else {
    match.result = { winner: null, winType: 'tie', winMargin: 0, description: 'Match tied' };
  }
};

const addRole = async (matchId, { userId: targetId, role }, requesterId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');
  if (match.createdBy.toString() !== requesterId) {
    throw new AppError('Only the organizer can assign roles', 403, 'FORBIDDEN');
  }

  const existingIdx = match.roles.findIndex((r) => r.userId.toString() === targetId);
  if (existingIdx >= 0) {
    match.roles[existingIdx].role = role;
  } else {
    match.roles.push({ userId: targetId, role });
  }

  await match.save();
  return match;
};

const abandonMatch = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');
  if (!match.canTransitionTo('ABANDONED')) {
    throw new AppError('Cannot abandon match in current state', 400, 'INVALID_STATE');
  }
  match.transitionTo('ABANDONED');
  match.result = { winner: null, winType: 'no_result', winMargin: null, description: 'Match abandoned' };
  await match.save();

  await AuditLog.create({ matchId, userId, action: 'MATCH_STATE_CHANGED', after: { state: 'ABANDONED' } });
  return match;
};

module.exports = {
  createMatch, getMatches, getLiveMatches, getMatchById,
  setToss, startInnings, endInnings, addRole, abandonMatch,
};
