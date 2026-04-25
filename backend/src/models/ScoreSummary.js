const mongoose = require('mongoose');

const battingStatSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  playerName: String,
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  strikeRate: { type: Number, default: 0 },
  dismissal: { type: String, default: null },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isOut: { type: Boolean, default: false },
  battingPosition: { type: Number, default: 0 },
}, { _id: false });

const bowlingStatSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  playerName: String,
  overs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  maidens: { type: Number, default: 0 },
  economy: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 },
}, { _id: false });

const fowSchema = new mongoose.Schema({
  wicketNumber: Number,
  runs: Number,
  over: Number,
  ball: Number,
  batsmanOut: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  batsmanName: String,
}, { _id: false });

const inningsSummarySchema = new mongoose.Schema({
  battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
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
  runRate: { type: Number, default: 0 },
  batting: [battingStatSchema],
  bowling: [bowlingStatSchema],
  fallOfWickets: [fowSchema],
  partnerships: [{
    batter1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    batter2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    runs: Number,
    balls: Number,
  }],
}, { _id: false });

const scoreSummarySchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true,
    index: true,
  },
  // Live match state cache
  currentState: {
    innings: { type: Number, default: 1 },
    over: { type: Number, default: 0 },
    ball: { type: Number, default: 0 },
    striker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentBowler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    totalRuns: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    target: { type: Number, default: null },
    requiredRuns: { type: Number, default: null },
    requiredRate: { type: Number, default: null },
    currentRate: { type: Number, default: 0 },
    projectedScore: { type: Number, default: null },
  },
  innings: [inningsSummarySchema],
  lastBallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ball', default: null },
  computedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ScoreSummary', scoreSummarySchema);
