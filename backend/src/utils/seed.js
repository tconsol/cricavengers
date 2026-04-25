require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Match = require('../models/Match');
const ScoreSummary = require('../models/ScoreSummary');
const logger = require('./logger');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cricavengers');
  logger.info('Connected for seeding...');

  // Clear
  await Promise.all([User.deleteMany({}), Team.deleteMany({}), Match.deleteMany({}), ScoreSummary.deleteMany({})]);

  // Users
  const users = await User.create([
    { name: 'Arjun Sharma', email: 'arjun@test.com', password: 'Password123', role: 'organizer' },
    { name: 'Rahul Verma', email: 'rahul@test.com', password: 'Password123' },
    { name: 'Priya Singh', email: 'priya@test.com', password: 'Password123' },
    { name: 'Dev Kumar', email: 'dev@test.com', password: 'Password123' },
    { name: 'Aman Gupta', email: 'aman@test.com', password: 'Password123' },
    { name: 'Vikram Rao', email: 'vikram@test.com', password: 'Password123' },
    { name: 'Suresh Pillai', email: 'suresh@test.com', password: 'Password123' },
    { name: 'Nikhil Joshi', email: 'nikhil@test.com', password: 'Password123' },
    { name: 'Kiran Nair', email: 'kiran@test.com', password: 'Password123' },
    { name: 'Ravi Teja', email: 'ravi@test.com', password: 'Password123' },
    { name: 'Deepak Chahar', email: 'deepak@test.com', password: 'Password123' },
    { name: 'Ajay Mishra', email: 'ajay@test.com', password: 'Password123' },
  ]);

  // Teams
  const teamA = await Team.create({
    name: 'Royal Strikers',
    shortName: 'RS',
    color: '#1E3A5F',
    createdBy: users[0]._id,
    players: users.slice(0, 6).map((u, i) => ({
      userId: u._id,
      name: u.name,
      role: i === 0 ? 'all-rounder' : i < 3 ? 'batsman' : 'bowler',
      isCaptain: i === 0,
      jerseyNumber: i + 1,
    })),
  });

  const teamB = await Team.create({
    name: 'Thunder Kings',
    shortName: 'TK',
    color: '#8B0000',
    createdBy: users[0]._id,
    players: users.slice(6, 12).map((u, i) => ({
      userId: u._id,
      name: u.name,
      role: i === 0 ? 'all-rounder' : i < 3 ? 'batsman' : 'bowler',
      isCaptain: i === 0,
      jerseyNumber: i + 1,
    })),
  });

  // Match
  const match = await Match.create({
    title: 'Royal Strikers vs Thunder Kings - T20 Challenge',
    teamA: teamA._id,
    teamB: teamB._id,
    venue: 'Wankhede Stadium, Mumbai',
    scheduledAt: new Date(),
    format: 'T20',
    totalOvers: 20,
    createdBy: users[0]._id,
    isPublic: true,
    roles: [
      { userId: users[1]._id, role: 'scorer' },
      { userId: users[2]._id, role: 'umpire' },
    ],
  });

  await ScoreSummary.create({ matchId: match._id });

  logger.info(`
✅ Seed complete!
   Users:   ${users.length}
   Teams:   2 (${teamA.name}, ${teamB.name})
   Match:   ${match.title}

   Logins:
   arjun@test.com / Password123  (organizer)
   rahul@test.com / Password123  (scorer)
  `);

  await mongoose.disconnect();
};

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
