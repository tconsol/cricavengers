const Joi = require('joi');

const createTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  shortName: Joi.string().max(5).optional().allow('', null),
  color: Joi.string().optional().allow('', null),
  logo: Joi.string().uri().optional().allow('', null),
  players: Joi.array().items(Joi.object({
    userId: Joi.string().required(),
    name: Joi.string().required(),
    role: Joi.string().valid('batsman', 'bowler', 'all-rounder', 'wicket-keeper').default('batsman'),
    jerseyNumber: Joi.number().optional().allow(null),
    isCaptain: Joi.boolean().default(false),
    isViceCaptain: Joi.boolean().default(false),
  })).default([]),
});

const updateTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  shortName: Joi.string().max(5).allow('', null),
  color: Joi.string().allow('', null),
  logo: Joi.string().uri().allow('', null),
});

const addPlayerSchema = Joi.object({
  userId: Joi.string().required(),
  name: Joi.string().required(),
  role: Joi.string().valid('batsman', 'bowler', 'all-rounder', 'wicket-keeper').default('batsman'),
  jerseyNumber: Joi.number().optional().allow(null),
  isCaptain: Joi.boolean().default(false),
  isViceCaptain: Joi.boolean().default(false),
});

module.exports = { createTeamSchema, updateTeamSchema, addPlayerSchema };
