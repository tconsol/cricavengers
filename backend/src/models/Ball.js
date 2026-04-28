const mongoose = require('mongoose');

const wicketSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'bowled', 'caught', 'lbw', 'run_out', 'stumped',
      'hit_wicket', 'caught_and_bowled', 'obstructing_field',
      'handled_ball', 'timed_out', 'hit_twice',
    ],
    required: true,
  },
  batsmanOut: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fielder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const extrasSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['wide', 'no_ball', 'bye', 'leg_bye', 'penalty', null],
    default: null,
  },
  runs: { type: Number, default: 0 },
}, { _id: false });

const ballSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
    index: true,
  },
  innings: { type: Number, enum: [1, 2, 3, 4], required: true },
  over: { type: Number, required: true, min: 0 },
  ball: { type: Number, required: true, min: 1 },

  batsman: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Runs scored off the bat (excluding extras)
  runs: { type: Number, default: 0, min: 0, max: 6 },

  extras: { type: extrasSchema, default: () => ({}) },

  wicket: { type: wicketSchema, default: null },

  // Whether this ball counts as a legal delivery
  isLegal: { type: Boolean, default: true },

  // Post-delivery state snapshot
  strikerAfter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nonStrikerAfter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Cumulative score at this point
  cumulativeRuns: { type: Number, default: 0 },
  cumulativeWickets: { type: Number, default: 0 },

  // Where the ball went on the field
  shotRegion: {
    type: String,
    enum: ['fine_leg', 'square_leg', 'mid_wicket', 'mid_on', 'long_on', 'straight',
           'long_off', 'mid_off', 'cover', 'point', 'third_man', 'gully', null],
    default: null,
  },

  // For edit/undo tracking
  editedAt: { type: Date, default: null },
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isDeleted: { type: Boolean, default: false },

  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: false,
  toJSON: { virtuals: true },
});

// Compound indexes for fast queries
ballSchema.index({ matchId: 1, innings: 1, over: 1, ball: 1 }, { unique: true });
ballSchema.index({ matchId: 1, innings: 1, isDeleted: 1 });
ballSchema.index({ batsman: 1, matchId: 1 });
ballSchema.index({ bowler: 1, matchId: 1 });

// Total runs from this ball (bat + extras)
ballSchema.virtual('totalRuns').get(function () {
  return this.runs + (this.extras?.runs || 0);
});

module.exports = mongoose.model('Ball', ballSchema);
