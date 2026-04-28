const mongoose = require('mongoose');

const TOURNAMENT_STATES = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'];
const FORMATS = ['round_robin', 'single_elimination', 'double_elimination', 'group_knockout', 'league'];

const standingsEntrySchema = new mongoose.Schema({
  teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamName:    { type: String, required: true },
  played:      { type: Number, default: 0 },
  won:         { type: Number, default: 0 },
  lost:        { type: Number, default: 0 },
  tied:        { type: Number, default: 0 },
  noResult:    { type: Number, default: 0 },
  points:      { type: Number, default: 0 },
  runsScored:  { type: Number, default: 0 },
  runsConceded:{ type: Number, default: 0 },
  oversFaced:  { type: Number, default: 0 },
  oversBowled: { type: Number, default: 0 },
  nrr:         { type: Number, default: 0 },
}, { _id: false });

const fixtureSchema = new mongoose.Schema({
  matchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
  teamA:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamB:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  round:     { type: Number, required: true },
  group:     { type: String, default: null },
  stage:     { type: String, enum: ['group', 'quarter_final', 'semi_final', 'final', 'third_place'], default: 'group' },
  status:    { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  scheduledAt: { type: Date, default: null },
  result:    {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    scoreA: { type: String, default: null },
    scoreB: { type: String, default: null },
  },
}, { timestamps: true });

const teamRequestSchema = new mongoose.Schema({
  teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  teamName:  { type: String, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
}, { _id: true });

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    maxlength: [150, 'Name cannot exceed 150 characters'],
  },
  description: { type: String, trim: true, default: '' },
  format: {
    type: String,
    enum: FORMATS,
    required: [true, 'Tournament format is required'],
  },
  matchFormat: {
    type: String,
    enum: ['T20', 'ODI', 'T10', 'Custom'],
    default: 'T20',
  },
  totalOvers: { type: Number, default: 20 },
  venue: { type: String, trim: true, default: '' },
  startDate: { type: Date, default: null },
  endDate:   { type: Date, default: null },
  maxTeams:  { type: Number, default: 8, min: 2, max: 64 },
  state: {
    type: String,
    enum: TOURNAMENT_STATES,
    default: 'draft',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Registered teams (approved)
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],

  // Pending join requests
  teamRequests: [teamRequestSchema],

  // Generated fixtures / matches
  fixtures: [fixtureSchema],

  // Points table
  standings: [standingsEntrySchema],

  // Prize / extra info
  prizePool: { type: String, default: '' },
  rules:     { type: String, default: '' },

  logo: { type: String, default: null },
  isPublic: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

tournamentSchema.index({ createdBy: 1 });
tournamentSchema.index({ state: 1 });
tournamentSchema.index({ name: 'text' });

tournamentSchema.virtual('teamCount').get(function () {
  return (this.teams || []).length;
});

tournamentSchema.virtual('fixtureCount').get(function () {
  return (this.fixtures || []).length;
});

module.exports = mongoose.model('Tournament', tournamentSchema);
