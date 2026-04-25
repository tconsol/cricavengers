const Tournament = require('../../models/Tournament');
const Team = require('../../models/Team');
const Match = require('../../models/Match');
const ScoreSummary = require('../../models/ScoreSummary');
const { AppError } = require('../../middlewares/errorHandler');

// ──────────────────────────────────────────────────────────
// NRR helper
// ──────────────────────────────────────────────────────────
function calcNRR(runsScored, oversFaced, runsConceded, oversBowled) {
  if (oversFaced === 0 || oversBowled === 0) return 0;
  return parseFloat(((runsScored / oversFaced) - (runsConceded / oversBowled)).toFixed(3));
}

// ──────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────
const createTournament = async (data, userId) => {
  const tournament = await Tournament.create({ ...data, createdBy: userId });
  return tournament;
};

const getTournaments = async (query, userId) => {
  const { page = 1, limit = 20, state, mine, search } = query;
  const filter = { isPublic: true };

  if (state) filter.state = state;
  if (mine === 'true') { delete filter.isPublic; filter.createdBy = userId; }
  if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { venue: new RegExp(search, 'i') }];

  const [tournaments, total] = await Promise.all([
    Tournament.find(filter)
      .populate('createdBy', 'name avatar')
      .populate('teams', 'name shortName color logo')
      .select('-fixtures -teamRequests -standings')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }),
    Tournament.countDocuments(filter),
  ]);

  return { tournaments, total, page: parseInt(page), limit: parseInt(limit) };
};

const getTournamentById = async (id) => {
  const t = await Tournament.findById(id)
    .populate('createdBy', 'name avatar')
    .populate('teams', 'name shortName color logo players')
    .populate('fixtures.teamA', 'name shortName color')
    .populate('fixtures.teamB', 'name shortName color')
    .populate('fixtures.matchId', 'state result scheduledAt')
    .populate('teamRequests.teamId', 'name shortName color')
    .populate('teamRequests.requestedBy', 'name');
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  return t;
};

const updateTournament = async (id, data, userId) => {
  const t = await Tournament.findById(id);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  const allowed = ['name', 'description', 'venue', 'startDate', 'endDate',
    'maxTeams', 'prizePool', 'rules', 'matchFormat', 'totalOvers', 'state'];
  allowed.forEach((k) => { if (data[k] !== undefined) t[k] = data[k]; });
  await t.save();
  return t;
};

const deleteTournament = async (id, userId) => {
  const t = await Tournament.findById(id);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  await t.deleteOne();
};

// ──────────────────────────────────────────────────────────
// Team registration
// ──────────────────────────────────────────────────────────
const registerTeam = async (tournamentId, teamId, userId) => {
  const [t, team] = await Promise.all([
    Tournament.findById(tournamentId),
    Team.findById(teamId),
  ]);
  if (!t)    throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');

  if (!['registration_open', 'draft'].includes(t.state)) {
    throw new AppError('Tournament is not accepting registrations', 400, 'INVALID_STATE');
  }
  if (t.teams.length >= t.maxTeams) {
    throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');
  }
  if (t.teams.map((x) => x.toString()).includes(teamId)) {
    throw new AppError('Team already registered', 409, 'DUPLICATE_ERROR');
  }

  // If organizer adds team directly → straight registration
  if (t.createdBy.toString() === userId) {
    t.teams.push(teamId);
    // Add to standings
    t.standings.push({ teamId, teamName: team.name });
    await t.save();
    return t;
  }

  // Otherwise → request flow
  const alreadyRequested = t.teamRequests.some(
    (r) => r.teamId.toString() === teamId && r.status === 'pending',
  );
  if (alreadyRequested) throw new AppError('Join request already pending', 409, 'DUPLICATE_ERROR');

  t.teamRequests.push({ teamId, teamName: team.name, requestedBy: userId });
  await t.save();
  return t;
};

const approveTeamRequest = async (tournamentId, requestId, userId) => {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  const req = t.teamRequests.id(requestId);
  if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
  if (req.status !== 'pending') throw new AppError('Request already processed', 400, 'INVALID_STATE');

  if (t.teams.length >= t.maxTeams) throw new AppError('Tournament is full', 400, 'TOURNAMENT_FULL');

  req.status = 'approved';
  t.teams.push(req.teamId);
  t.standings.push({ teamId: req.teamId, teamName: req.teamName });
  await t.save();
  return t;
};

const rejectTeamRequest = async (tournamentId, requestId, userId) => {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  const req = t.teamRequests.id(requestId);
  if (!req) throw new AppError('Request not found', 404, 'NOT_FOUND');
  if (req.status !== 'pending') throw new AppError('Request already processed', 400, 'INVALID_STATE');

  req.status = 'rejected';
  await t.save();
  return t;
};

const removeTeam = async (tournamentId, teamId, userId) => {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  t.teams = t.teams.filter((tid) => tid.toString() !== teamId);
  t.standings = t.standings.filter((s) => s.teamId.toString() !== teamId);
  await t.save();
  return t;
};

// ──────────────────────────────────────────────────────────
// Fixture generation
// ──────────────────────────────────────────────────────────
function generateRoundRobin(teams) {
  const fixtures = [];
  let round = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({ teamA: teams[i], teamB: teams[j], round, stage: 'group' });
      round++;
    }
  }
  return fixtures;
}

function generateSingleElimination(teams) {
  // Pad to next power of 2 with byes (null)
  const n = Math.pow(2, Math.ceil(Math.log2(teams.length)));
  const padded = [...teams, ...Array(n - teams.length).fill(null)];
  const fixtures = [];
  let round = 1;
  let bracket = padded;

  const stages = ['quarter_final', 'semi_final', 'final'];
  let stageIdx = 0;

  while (bracket.length > 1) {
    const next = [];
    const stage = bracket.length === 2 ? 'final'
      : bracket.length === 4 ? 'semi_final'
      : bracket.length === 8 ? 'quarter_final' : 'group';

    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i], b = bracket[i + 1];
      if (a && b) {
        fixtures.push({ teamA: a, teamB: b, round, stage });
        next.push(null); // winner TBD
      } else {
        next.push(a || b); // bye
      }
    }
    bracket = next;
    round++;
  }
  return fixtures;
}

const generateFixtures = async (tournamentId, userId) => {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  if (t.teams.length < 2) throw new AppError('Need at least 2 teams to generate fixtures', 400, 'VALIDATION_ERROR');
  if (t.fixtures.length) throw new AppError('Fixtures already generated. Delete them first.', 400, 'VALIDATION_ERROR');

  let rawFixtures = [];
  if (t.format === 'round_robin' || t.format === 'league') {
    rawFixtures = generateRoundRobin(t.teams);
  } else if (t.format === 'single_elimination') {
    rawFixtures = generateSingleElimination(t.teams);
  } else if (t.format === 'double_elimination') {
    rawFixtures = generateSingleElimination(t.teams); // simplified
  } else if (t.format === 'group_knockout') {
    // Split teams into 2 groups, round-robin per group
    const half = Math.ceil(t.teams.length / 2);
    const g1 = t.teams.slice(0, half), g2 = t.teams.slice(half);
    rawFixtures = [
      ...generateRoundRobin(g1).map((f) => ({ ...f, group: 'A' })),
      ...generateRoundRobin(g2).map((f) => ({ ...f, group: 'B' })),
    ];
  }

  // Create Match records for each fixture
  const createdFixtures = [];
  for (const f of rawFixtures) {
    if (!f.teamA || !f.teamB) continue; // skip byes
    const match = await Match.create({
      title: `Tournament Match (Round ${f.round})`,
      teamA: f.teamA,
      teamB: f.teamB,
      format: t.matchFormat,
      totalOvers: t.totalOvers,
      venue: t.venue,
      scheduledAt: t.startDate || new Date(),
      createdBy: userId,
      tournamentId: tournamentId,
    });
    await ScoreSummary.create({ matchId: match._id });

    createdFixtures.push({
      matchId: match._id,
      teamA: f.teamA,
      teamB: f.teamB,
      round: f.round,
      group: f.group || null,
      stage: f.stage || 'group',
      status: 'scheduled',
    });
  }

  t.fixtures = createdFixtures;
  if (t.state === 'registration_closed') t.state = 'in_progress';
  await t.save();
  return t;
};

const deleteFixtures = async (tournamentId, userId) => {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');
  if (t.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  // Only delete scheduled matches
  const matchIds = t.fixtures
    .filter((f) => f.status === 'scheduled')
    .map((f) => f.matchId);
  if (matchIds.length) {
    await Match.deleteMany({ _id: { $in: matchIds } });
    await ScoreSummary.deleteMany({ matchId: { $in: matchIds } });
  }

  t.fixtures = t.fixtures.filter((f) => f.status !== 'scheduled');
  await t.save();
  return t;
};

// ──────────────────────────────────────────────────────────
// Standings recalculation
// ──────────────────────────────────────────────────────────
const recalcStandings = async (tournamentId) => {
  const t = await Tournament.findById(tournamentId).populate('fixtures.matchId');
  if (!t) throw new AppError('Tournament not found', 404, 'NOT_FOUND');

  // Reset all
  t.standings.forEach((s) => {
    s.played = s.won = s.lost = s.tied = s.noResult = s.points = 0;
    s.runsScored = s.runsConceded = s.oversFaced = s.oversBowled = s.nrr = 0;
  });

  const map = {};
  t.standings.forEach((s) => { map[s.teamId.toString()] = s; });

  for (const fixture of t.fixtures) {
    const match = fixture.matchId;
    if (!match || match.state !== 'COMPLETED') continue;

    const { first, second } = match.innings || {};
    if (!first || !second) continue;

    const aId = first.battingTeam.toString();
    const bId = first.bowlingTeam.toString();
    const sa = map[aId], sb = map[bId];
    if (!sa || !sb) continue;

    const aRuns = first.totalRuns, aOvers = first.overs + first.balls / 6;
    const bRuns = second.totalRuns, bOvers = second.overs + second.balls / 6;

    sa.played++; sb.played++;
    sa.runsScored  += aRuns; sa.oversFaced   += aOvers;
    sa.runsConceded+= bRuns; sa.oversBowled  += bOvers;
    sb.runsScored  += bRuns; sb.oversFaced   += bOvers;
    sb.runsConceded+= aRuns; sb.oversBowled  += aOvers;

    const winner = match.result?.winner?.toString();
    if (!winner) {
      sa.tied++; sb.tied++;
      sa.points += 2; sb.points += 2;
    } else if (winner === aId) {
      sa.won++; sb.lost++;
      sa.points += 4;
    } else {
      sb.won++; sa.lost++;
      sb.points += 4;
    }

    sa.nrr = calcNRR(sa.runsScored, sa.oversFaced, sa.runsConceded, sa.oversBowled);
    sb.nrr = calcNRR(sb.runsScored, sb.oversFaced, sb.runsConceded, sb.oversBowled);
  }

  // Sort: points desc → nrr desc
  t.standings.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  await t.save();
  return t.standings;
};

module.exports = {
  createTournament, getTournaments, getTournamentById, updateTournament, deleteTournament,
  registerTeam, approveTeamRequest, rejectTeamRequest, removeTeam,
  generateFixtures, deleteFixtures, recalcStandings,
};
