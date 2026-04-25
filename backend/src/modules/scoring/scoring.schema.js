const Joi = require('joi');

const addBallSchema = Joi.object({
  innings: Joi.number().valid(1, 2).required(),
  batsman: Joi.string().length(24).required(),
  bowler: Joi.string().length(24).required(),
  runs: Joi.number().integer().min(0).max(6).required(),
  extras: Joi.object({
    type: Joi.string().valid('wide', 'no_ball', 'bye', 'leg_bye', 'penalty').allow(null),
    runs: Joi.number().integer().min(0).max(7).default(0),
  }).optional().allow(null),
  wicket: Joi.object({
    type: Joi.string().valid(
      'bowled', 'caught', 'lbw', 'run_out', 'stumped',
      'hit_wicket', 'caught_and_bowled', 'obstructing_field',
      'handled_ball', 'timed_out', 'hit_twice'
    ).required(),
    batsmanOut: Joi.string().length(24).required(),
    fielder: Joi.string().length(24).optional().allow(null),
  }).optional().allow(null),
  // New striker/nonStriker after this ball (for rotation)
  strikerAfter: Joi.string().length(24).optional().allow(null),
  nonStrikerAfter: Joi.string().length(24).optional().allow(null),
  newBatsman: Joi.string().length(24).optional().allow(null),
});

const editBallSchema = Joi.object({
  runs: Joi.number().integer().min(0).max(6),
  extras: Joi.object({
    type: Joi.string().valid('wide', 'no_ball', 'bye', 'leg_bye', 'penalty').allow(null),
    runs: Joi.number().integer().min(0).max(7),
  }).optional().allow(null),
  wicket: Joi.object({
    type: Joi.string().valid(
      'bowled', 'caught', 'lbw', 'run_out', 'stumped',
      'hit_wicket', 'caught_and_bowled', 'obstructing_field',
      'handled_ball', 'timed_out', 'hit_twice'
    ).required(),
    batsmanOut: Joi.string().length(24).required(),
    fielder: Joi.string().length(24).optional().allow(null),
  }).optional().allow(null),
  strikerAfter: Joi.string().length(24).optional().allow(null),
  nonStrikerAfter: Joi.string().length(24).optional().allow(null),
});

const setBatsmanSchema = Joi.object({
  innings: Joi.number().valid(1, 2).required(),
  position: Joi.string().valid('striker', 'nonStriker').required(),
  playerId: Joi.string().length(24).required(),
});

const setBowlerSchema = Joi.object({
  innings: Joi.number().valid(1, 2).required(),
  playerId: Joi.string().length(24).required(),
});

module.exports = { addBallSchema, editBallSchema, setBatsmanSchema, setBowlerSchema };
