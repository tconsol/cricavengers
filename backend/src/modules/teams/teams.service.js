const Team = require('../../models/Team');
const User = require('../../models/User');
const { AppError } = require('../../middlewares/errorHandler');
const { emitToAll } = require('../../sockets');

const createTeam = async (data, createdBy) => {
  const team = await Team.create({ ...data, createdBy });
  emitToAll('TEAM_CREATED', { team });
  return team;
};

const getTeams = async (query, userId) => {
  const { page = 1, limit = 20, mine } = query;
  const filter = mine === 'true' ? { createdBy: userId, isActive: true } : { isActive: true };

  const [teams, total] = await Promise.all([
    Team.find(filter)
      .populate('createdBy', 'name avatar')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }),
    Team.countDocuments(filter),
  ]);

  return { teams, total, page: parseInt(page), limit: parseInt(limit) };
};

const getTeamById = async (id) => {
  const team = await Team.findById(id).populate('createdBy', 'name avatar');
  if (!team || !team.isActive) throw new AppError('Team not found', 404, 'NOT_FOUND');
  return team;
};

const updateTeam = async (id, data, userId) => {
  const team = await Team.findById(id);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  Object.assign(team, data);
  await team.save();
  emitToAll('TEAM_UPDATED', { team });
  return team;
};

const addPlayer = async (teamId, playerData, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  const exists = team.players.find((p) => p.userId.toString() === playerData.userId);
  if (exists) throw new AppError('Player already in team', 409, 'DUPLICATE_ERROR');

  team.players.push(playerData);
  await team.save();
  emitToAll('TEAM_UPDATED', { team });
  return team;
};

const removePlayer = async (teamId, playerId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  team.players = team.players.filter((p) => p._id.toString() !== playerId);
  await team.save();
  emitToAll('TEAM_UPDATED', { team });
  return team;
};

const deleteTeam = async (id, userId) => {
  const team = await Team.findById(id);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  team.isActive = false;
  await team.save();
  emitToAll('TEAM_DELETED', { teamId: id });
};

const searchPlayers = async (query) => {
  const { q } = query;
  if (!q || q.trim().length < 2) throw new AppError('Query must be at least 2 characters', 400, 'VALIDATION_ERROR');

  const regex = new RegExp(q.trim(), 'i');
  const players = await User.find({
    $or: [{ email: regex }, { phone: regex }, { name: regex }],
    isActive: true,
  }).select('name email phone avatar role').limit(20);

  return players;
};

module.exports = { createTeam, getTeams, getTeamById, updateTeam, addPlayer, removePlayer, deleteTeam, searchPlayers };
