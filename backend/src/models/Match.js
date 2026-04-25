const mongoose = require('mongoose');

const MATCH_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  TOSS_DONE: 'TOSS_DONE',
  FIRST_INNINGS: 'FIRST_INNINGS',
  INNINGS_BREAK: 'INNINGS_BREAK',
  SECOND_INNINGS: 'SECOND_INNINGS',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
};

// Valid state transitions
const VALID_TRANSITIONS = {
  NOT_STARTED: ['TOSS_DONE', 'ABANDONED'],
  TOSS_DONE: ['FIRST_INNINGS', 'ABANDONED'],
  FIRST_INNINGS: ['INNINGS_BREAK', 'ABANDONED'],
  INNINGS_BREAK: ['SECOND_INNINGS', 'ABANDONED'],
  SECOND_INNINGS: ['COMPLETED', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: [],
};

const inningsSchema = new mongoose.Schema({
  battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  totalRuns: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  overs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  extras: {
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  striker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  currentBowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  target: { type: Number, default: null },
  isCompleted: { type: Boolean, default: false },
  completionReason: {
    type: String,
    enum: ['all_out', 'overs_complete', 'target_achieved', 'declared', null],
    default: null,
  },
}, { _id: false });

const matchSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Match title is required'],
    trim: true,
  },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  venue: { type: String, trim: true },
  scheduledAt: { type: Date, required: true },
  format: {
    type: String,
    enum: ['T20', 'ODI', 'Test', 'T10', 'Custom'],
    default: 'T20',
  },
  totalOvers: { type: Number, required: true, min: 1 },
  state: {
    type: String,
    enum: Object.values(MATCH_STATES),
    default: MATCH_STATES.NOT_STARTED,
  },
  toss: {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    decision: { type: String, enum: ['bat', 'bowl', null], default: null },
  },
  innings: {
    first: { type: inningsSchema, default: null },
    second: { type: inningsSchema, default: null },
  },
  result: {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    winMargin: { type: Number, default: null },
    winType: { type: String, enum: ['runs', 'wickets', 'tie', 'no_result', null], default: null },
    description: { type: String, default: null },
  },
  // Access control
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roles: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['scorer', 'umpire', 'organizer', 'viewer'] },
  }],
  isPublic: { type: Boolean, default: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

matchSchema.index({ teamA: 1, teamB: 1 });
matchSchema.index({ createdBy: 1 });
matchSchema.index({ state: 1 });
matchSchema.index({ scheduledAt: -1 });

matchSchema.methods.canTransitionTo = function (newState) {
  return VALID_TRANSITIONS[this.state]?.includes(newState) ?? false;
};

matchSchema.methods.transitionTo = function (newState) {
  if (!this.canTransitionTo(newState)) {
    throw new Error(`Invalid state transition: ${this.state} → ${newState}`);
  }
  this.state = newState;
};

matchSchema.statics.STATES = MATCH_STATES;

module.exports = mongoose.model('Match', matchSchema);
