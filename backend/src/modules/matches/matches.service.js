const Match = require('../../models/Match');
const Team = require('../../models/Team');
const ScoreSummary = require('../../models/ScoreSummary');
const AuditLog = require('../../models/AuditLog');
const { AppError } = require('../../middlewares/errorHandler');
const { emitToAll, emitMatchUpdate } = require('../../sockets');

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

  // Populate teams so clients get names/logos/colors immediately
  const populated = await Match.findById(match._id)
    .populate('teamA', 'name shortName logo color')
    .populate('teamB', 'name shortName logo color')
    .populate('createdBy', 'name');
  emitToAll('MATCH_CREATED', { match: populated });
  return match;
};

const getMatches = async (query, userId) => {
  const { page = 1, limit = 20, state, mine, teamId } = query;
  const filter = {};

  if (state) {
    const states = state.split(',').map((s) => s.trim()).filter(Boolean);
    filter.state = states.length > 1 ? { $in: states } : states[0];
  }
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
    state: { $in: ['FIRST_INNINGS', 'SECOND_INNINGS', 'SUPER_OVER_1', 'SUPER_OVER_2'] },
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

const populateMatch = (id) =>
  Match.findById(id)
    .populate('teamA')
    .populate('teamB')
    .populate('createdBy', 'name avatar')
    .populate('roles.userId', 'name avatar');

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

  const populated = await populateMatch(matchId);
  emitMatchUpdate(matchId, 'MATCH_STATE_CHANGED', { state: match.state, match: populated });
  return populated;
};

const startInnings = async (matchId, { innings, striker, nonStriker, bowler }, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const isSuperOver = innings === 3 || innings === 4;
  const targetState = isSuperOver
    ? (innings === 3 ? 'SUPER_OVER_1' : 'SUPER_OVER_2')
    : (innings === 1 ? 'FIRST_INNINGS' : 'SECOND_INNINGS');

  if (!match.canTransitionTo(targetState)) {
    throw new AppError(`Cannot start innings ${innings} from state: ${match.state}`, 400, 'INVALID_STATE');
  }

  if (isSuperOver) {
    const soKey = innings === 3 ? 'first' : 'second';
    if (!match.superOver?.[soKey]) throw new AppError('Super over not initialised', 400, 'INVALID_STATE');
    match.superOver[soKey].striker = striker;
    match.superOver[soKey].nonStriker = nonStriker;
    match.superOver[soKey].currentBowler = bowler;
  } else {
    const inningsKey = innings === 1 ? 'first' : 'second';
    if (!match.innings[inningsKey]) throw new AppError('Innings not initialized', 400, 'INVALID_STATE');
    match.innings[inningsKey].striker = striker;
    match.innings[inningsKey].nonStriker = nonStriker;
    match.innings[inningsKey].currentBowler = bowler;

    if (innings === 2) {
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

    // Auto-grant scorer to batting captain
    const battingTeamId = match.innings[inningsKey].battingTeam.toString();
    const battingTeamDoc = await Team.findById(battingTeamId);
    if (battingTeamDoc) {
      const captain = battingTeamDoc.players.find((p) => p.isCaptain);
      if (captain) {
        const captainId = (captain.userId._id || captain.userId).toString();
        const creatorId = match.createdBy.toString();
        if (captainId !== creatorId && !match.roles.some((r) => r.userId.toString() === captainId)) {
          match.roles.push({ userId: captainId, role: 'scorer' });
        }
      }
    }
  }

  match.transitionTo(targetState);
  await match.save();

  const populatedForInnings = await populateMatch(matchId);
  emitMatchUpdate(matchId, 'MATCH_STATE_CHANGED', { state: match.state, match: populatedForInnings });

  const target = isSuperOver
    ? (innings === 4 ? match.superOver?.second?.target : null)
    : (innings === 2 ? match.innings.second.target : null);

  await ScoreSummary.findOneAndUpdate(
    { matchId },
    {
      'currentState.innings': innings,
      'currentState.striker': striker,
      'currentState.nonStriker': nonStriker,
      'currentState.currentBowler': bowler,
      'currentState.target': target,
    }
  );

  await AuditLog.create({
    matchId, userId,
    action: 'INNINGS_STARTED',
    entityId: matchId,
    entityType: 'Match',
    after: { innings, striker, nonStriker, bowler },
  });

  return populatedForInnings;
};

const endInnings = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  if (match.state === 'FIRST_INNINGS') {
    match.innings.first.isCompleted = true;
    match.transitionTo('INNINGS_BREAK');
    match.innings.second = {
      battingTeam: match.innings.first.bowlingTeam,
      bowlingTeam: match.innings.first.battingTeam,
      totalRuns: 0, wickets: 0, overs: 0, balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      target: match.innings.first.totalRuns + 1,
    };
  } else if (match.state === 'SECOND_INNINGS') {
    match.innings.second.isCompleted = true;
    await _computeMatchResult(match);
    if (match.result.winType === 'tie') {
      // Offer super over instead of ending match
      match.result = null;
      match.superOver = {
        first: {
          battingTeam: match.innings.second.battingTeam,
          bowlingTeam: match.innings.first.battingTeam,
          totalRuns: 0, wickets: 0, overs: 0, balls: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
        },
        second: {
          battingTeam: match.innings.first.battingTeam,
          bowlingTeam: match.innings.second.battingTeam,
          totalRuns: 0, wickets: 0, overs: 0, balls: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
        },
      };
      match.transitionTo('SUPER_OVER_BREAK');
    } else {
      match.transitionTo('COMPLETED');
    }
  } else if (match.state === 'SUPER_OVER_1') {
    match.superOver.first.isCompleted = true;
    match.transitionTo('SUPER_OVER_INNINGS_BREAK');
    match.superOver.second.target = match.superOver.first.totalRuns + 1;
  } else if (match.state === 'SUPER_OVER_2') {
    match.superOver.second.isCompleted = true;
    _computeSuperOverResult(match);
    match.transitionTo('COMPLETED');
  } else {
    throw new AppError('Cannot end innings in current match state', 400, 'INVALID_STATE');
  }

  await match.save();

  await AuditLog.create({
    matchId, userId,
    action: 'INNINGS_ENDED',
    entityId: matchId,
    entityType: 'Match',
  });

  const populated = await populateMatch(matchId);
  emitMatchUpdate(matchId, 'MATCH_STATE_CHANGED', { state: match.state, match: populated });
  if (match.state === 'COMPLETED') {
    emitToAll('MATCH_COMPLETED', { matchId, result: match.result });
  }
  return match;
};

const _computeSuperOverResult = (match) => {
  const first = match.superOver.first;
  const second = match.superOver.second;
  const target = first.totalRuns + 1;
  if (second.totalRuns >= target) {
    match.result = {
      winner: second.battingTeam,
      winType: 'wickets',
      winMargin: 2 - second.wickets,
      description: `Super Over: ${2 - second.wickets} wicket${2 - second.wickets !== 1 ? 's' : ''} win`,
    };
  } else if (second.totalRuns < first.totalRuns) {
    match.result = {
      winner: first.battingTeam,
      winType: 'runs',
      winMargin: first.totalRuns - second.totalRuns,
      description: `Super Over: ${first.totalRuns - second.totalRuns} run${first.totalRuns - second.totalRuns !== 1 ? 's' : ''} win`,
    };
  } else {
    match.result = { winner: null, winType: 'tie', winMargin: 0, description: 'Super Over tied — match tied' };
  }
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

  const isOrganizer = match.createdBy.toString() === requesterId;
  const isScorer = match.roles.some((r) => r.userId.toString() === requesterId && r.role === 'scorer');

  if (!isOrganizer && !isScorer) {
    throw new AppError('Only the organizer or scorer can assign roles', 403, 'FORBIDDEN');
  }
  if (!isOrganizer && isScorer && role !== 'scorer') {
    throw new AppError('Scorers can only transfer the scorer role', 403, 'FORBIDDEN');
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

const updateSquad = async (matchId, { teamId, squad }, requesterId) => {
  const match = await Match.findById(matchId).populate('teamA').populate('teamB');
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const isTeamA = match.teamA._id.toString() === teamId;
  const isTeamB = match.teamB._id.toString() === teamId;
  if (!isTeamA && !isTeamB) {
    throw new AppError('Team not part of this match', 400, 'VALIDATION_ERROR');
  }

  const team = isTeamA ? match.teamA : match.teamB;
  const isOrganizer = match.createdBy.toString() === requesterId;
  const isCaptain = team.players.some(
    (p) => (p.userId._id || p.userId).toString() === requesterId && p.isCaptain,
  );

  if (!isOrganizer && !isCaptain) {
    throw new AppError('Only the team captain or match organizer can set the squad', 403, 'FORBIDDEN');
  }

  if (isTeamA) {
    match.squadA = squad;
  } else {
    match.squadB = squad;
  }

  await match.save();

  return Match.findById(matchId)
    .populate('teamA')
    .populate('teamB')
    .populate('createdBy', 'name');
};

const removeRole = async (matchId, targetId, requesterId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');

  const isOrganizer = match.createdBy.toString() === requesterId;
  const isScorer = match.roles.some((r) => r.userId.toString() === requesterId && r.role === 'scorer');

  if (!isOrganizer && !isScorer) {
    throw new AppError('Only the organizer or scorer can revoke roles', 403, 'FORBIDDEN');
  }

  match.roles = match.roles.filter((r) => r.userId.toString() !== targetId);
  await match.save();
  return match;
};

const endMatchAsTie = async (matchId, userId) => {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match not found', 404, 'NOT_FOUND');
  if (match.state !== 'SUPER_OVER_BREAK') {
    throw new AppError('Match is not in super over break', 400, 'INVALID_STATE');
  }
  match.result = { winner: null, winType: 'tie', winMargin: 0, description: 'Match tied' };
  match.transitionTo('COMPLETED');
  await match.save();
  await AuditLog.create({ matchId, userId, action: 'MATCH_STATE_CHANGED', after: { state: 'COMPLETED', result: match.result } });
  const populated = await populateMatch(matchId);
  emitMatchUpdate(matchId, 'MATCH_STATE_CHANGED', { state: 'COMPLETED', match: populated });
  emitToAll('MATCH_COMPLETED', { matchId, result: match.result });
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
  emitMatchUpdate(matchId, 'MATCH_STATE_CHANGED', { state: 'ABANDONED', match });
  emitToAll('MATCH_COMPLETED', { matchId, result: match.result });
  return match;
};

module.exports = {
  createMatch, getMatches, getLiveMatches, getMatchById,
  setToss, startInnings, endInnings, endMatchAsTie, addRole, removeRole, updateSquad, abandonMatch,
};
