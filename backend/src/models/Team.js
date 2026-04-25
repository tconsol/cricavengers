const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'],
    default: 'batsman',
  },
  jerseyNumber: { type: Number, default: null },
  isCaptain: { type: Boolean, default: false },
  isViceCaptain: { type: Boolean, default: false },
}, { _id: true });

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters'],
  },
  shortName: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [5, 'Short name cannot exceed 5 characters'],
  },
  logo: { type: String, default: null },
  color: { type: String, default: '#1E3A5F' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  players: [playerSchema],
  stats: {
    matches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    ties: { type: Number, default: 0 },
    nrr: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

teamSchema.index({ createdBy: 1 });
teamSchema.index({ name: 'text' });
teamSchema.virtual('playerCount').get(function () {
  return this.players.length;
});

module.exports = mongoose.model('Team', teamSchema);
