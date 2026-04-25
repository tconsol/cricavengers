const Team = require('../../models/Team');
const { AppError } = require('../../middlewares/errorHandler');

const createTeam = async (data, createdBy) => {
  const team = await Team.create({ ...data, createdBy });
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
  return team;
};

const removePlayer = async (teamId, playerId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');

  team.players = team.players.filter((p) => p._id.toString() !== playerId);
  await team.save();
  return team;
};

const deleteTeam = async (id, userId) => {
  const team = await Team.findById(id);
  if (!team) throw new AppError('Team not found', 404, 'NOT_FOUND');
  if (team.createdBy.toString() !== userId) throw new AppError('Not authorized', 403, 'FORBIDDEN');
  team.isActive = false;
  await team.save();
};

module.exports = { createTeam, getTeams, getTeamById, updateTeam, addPlayer, removePlayer, deleteTeam };
