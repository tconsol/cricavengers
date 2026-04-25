const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['BALL_ADDED', 'BALL_EDITED', 'BALL_DELETED', 'BALL_UNDONE', 'MATCH_CREATED',
           'MATCH_STATE_CHANGED', 'TOSS_SET', 'INNINGS_STARTED', 'INNINGS_ENDED',
           'MATCH_COMPLETED', 'PLAYER_SET'],
    required: true,
  },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  entityType: { type: String, enum: ['Ball', 'Match', null], default: null },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: null },
}, {
  timestamps: true,
});

auditLogSchema.index({ matchId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
