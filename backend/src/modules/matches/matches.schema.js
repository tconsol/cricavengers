const Joi = require('joi');

const squadPlayerSchema = Joi.object({
  userId: Joi.string().length(24).required(),
  name: Joi.string().required(),
  role: Joi.string().valid('batsman', 'bowler', 'all-rounder', 'wicket-keeper').default('batsman'),
  jerseyNumber: Joi.number().optional().allow(null),
});

const createMatchSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  teamA: Joi.string().length(24).required(),
  teamB: Joi.string().length(24).required(),
  venue: Joi.string().max(200).optional().allow('', null),
  scheduledAt: Joi.date().required(),
  format: Joi.string().valid('T20', 'ODI', 'Test', 'T10', 'Custom').default('T20'),
  totalOvers: Joi.number().min(1).max(500).required(),
  isPublic: Joi.boolean().default(true),
  tournamentId: Joi.string().length(24).optional().allow(null),

  // Squad & role selections
  squadA:   Joi.array().items(squadPlayerSchema).default([]),
  squadB:   Joi.array().items(squadPlayerSchema).default([]),
  captainA: Joi.string().length(24).optional().allow(null),
  wkA:      Joi.string().length(24).optional().allow(null),
  sub12A:   Joi.string().length(24).optional().allow(null),
  captainB: Joi.string().length(24).optional().allow(null),
  wkB:      Joi.string().length(24).optional().allow(null),
  sub12B:   Joi.string().length(24).optional().allow(null),
});

const tossSchema = Joi.object({
  winner: Joi.string().length(24).required(),
  decision: Joi.string().valid('bat', 'bowl').required(),
});

const setPlayersSchema = Joi.object({
  innings: Joi.number().valid(1, 2, 3, 4).required(),
  striker: Joi.string().length(24).required(),
  nonStriker: Joi.string().length(24).required(),
  bowler: Joi.string().length(24).required(),
});

const addRoleSchema = Joi.object({
  userId: Joi.string().length(24).required(),
  role: Joi.string().valid('scorer', 'umpire', 'organizer', 'viewer').required(),
});

module.exports = { createMatchSchema, tossSchema, setPlayersSchema, addRoleSchema };
