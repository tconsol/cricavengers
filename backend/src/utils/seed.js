/**
 * Seed script: populates MongoDB with demo data.
 * Run:         node src/utils/seed.js
 * Full reset:  node src/utils/seed.js --reset
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User         = require('../models/User');
const Team         = require('../models/Team');
const Match        = require('../models/Match');
const Ball         = require('../models/Ball');
const ScoreSummary = require('../models/ScoreSummary');
const AuditLog     = require('../models/AuditLog');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const USERS_DATA = [
  { name: 'Dhanu Kumar',  email: 'dhanu@test.com',   role: 'organizer' },
  { name: 'Ravi Sharma',  email: 'ravi@test.com',    role: 'player' },
  { name: 'Priya Singh',  email: 'priya@test.com',   role: 'player' },
  { name: 'Arjun Patel',  email: 'arjun@test.com',   role: 'player' },
  { name: 'Anita Rao',    email: 'anita@test.com',   role: 'player' },
  { name: 'Kiran Mehta',  email: 'kiran@test.com',   role: 'player' },
  { name: 'Suresh Verma', email: 'suresh@test.com',  role: 'player' },
  { name: 'Deepak Nair',  email: 'deepak@test.com',  role: 'player' },
  { name: 'Vijay Iyer',   email: 'vijay@test.com',   role: 'player' },
  { name: 'Raj Kumar',    email: 'raj@test.com',     role: 'player' },
  { name: 'Anil Gupta',   email: 'anil@test.com',    role: 'player' },
  { name: 'Neha Joshi',   email: 'neha@test.com',    role: 'player' },
  { name: 'Rohit Kapoor', email: 'rohit@test.com',   role: 'player' },
  { name: 'Sanjay Dubey', email: 'sanjay@test.com',  role: 'player' },
];

async function seedUsers() {
  const hash = await bcrypt.hash('Password123!', 12);
  return User.insertMany(USERS_DATA.map((u) => ({ ...u, password: hash, isActive: true })));
}

async function seedTeams(users) {
  const mkPlayer = (u, i) => ({
    userId: u._id, name: u.name,
    role: i <= 2 ? 'batsman' : i <= 5 ? 'bowler' : i === 6 ? 'wicket-keeper' : 'all-rounder',
    jerseyNumber: i + 1, battingOrder: i + 1,
  });
  const teamA = await Team.create({
    name: 'Royal Strikers', shortName: 'RS', color: '#1E3A5F',
    createdBy: users[0]._id, players: users.slice(0, 7).map(mkPlayer),
  });
  const teamB = await Team.create({
    name: 'Thunder Kings', shortName: 'TK', color: '#8B0000',
    createdBy: users[0]._id, players: users.slice(7, 14).map(mkPlayer),
  });
  return { teamA, teamB };
}

function makeBalls(matchId, innings, batters, bowlers, overs) {
  const RUNS    = [0, 0, 0, 1, 1, 2, 4, 6];
  const WKTYPES = ['bowled', 'caught', 'lbw', 'caught_and_bowled'];
  const balls   = [];
  let si = 0, ni = 1, bi = 0, nextBatter = 2, wkts = 0;
  let cumRuns = 0, cumWkts = 0;

  for (let o = 1; o <= overs; o++) {
    const bowler = bowlers[bi % bowlers.length];
    for (let b = 1; b <= 6; b++) {
      if (wkts >= batters.length - 1) break;
      const batter   = batters[si];
      const isWicket = wkts < 5 && Math.random() < 0.07;
      const runs     = isWicket ? 0 : pick(RUNS);
      cumRuns += runs;
      if (isWicket) cumWkts++;

      balls.push({
        matchId, innings, over: o, ball: b,
        batsman: batter.userId,
        bowler:  bowler.userId,
        runs, isLegal: true,
        wicket: isWicket ? { type: pick(WKTYPES), batsmanOut: batter.userId } : null,
        strikerAfter:    isWicket ? (batters[nextBatter]?.userId ?? null) : (runs % 2 === 1 ? batters[ni].userId : batter.userId),
        nonStrikerAfter: isWicket ? batters[ni].userId                     : (runs % 2 === 1 ? batter.userId : batters[ni].userId),
        cumulativeRuns: cumRuns,
        cumulativeWickets: cumWkts,
        timestamp: new Date(),
      });
      if (isWicket) { wkts++; si = nextBatter++; }
      else if (runs % 2 === 1) { [si, ni] = [ni, si]; }
    }
    [si, ni] = [ni, si];
    bi++;
  }
  return balls;
}

async function seedMatches(users, teamA, teamB) {
  const org = users[0];
  const aB = teamA.players, bB = teamB.players;
  const aBwl = aB.slice(3, 6), bBwl = bB.slice(3, 6);

  const inningsFirst  = (bt, bwt, s, ns, cb) => ({ battingTeam: bt, bowlingTeam: bwt, striker: s, nonStriker: ns, currentBowler: cb, isCompleted: false });
  const inningsSecond = (bt, bwt, s, ns, cb) => ({ battingTeam: bt, bowlingTeam: bwt, striker: s, nonStriker: ns, currentBowler: cb, isCompleted: false });

  // Completed match
  const m1 = await Match.create({
    title: 'CricAvengers Cup – Final', venue: 'Hyderabad Cricket Ground',
    teamA: teamA._id, teamB: teamB._id, format: 'T20', totalOvers: 5,
    state: 'COMPLETED', createdBy: org._id,
    scheduledAt: new Date(Date.now() - 2 * 86400000),
    toss: { winner: teamA._id, decision: 'bat' },
    innings: {
      first:  inningsFirst(teamA._id, teamB._id, aB[0].userId, aB[1].userId, bBwl[0].userId),
      second: inningsSecond(teamB._id, teamA._id, bB[0].userId, bB[1].userId, aBwl[0].userId),
    },
    result: { winner: teamA._id, winMargin: 12, winType: 'runs', description: 'Royal Strikers won by 12 runs' },
    roles: [{ userId: users[1]._id, role: 'scorer' }, { userId: users[2]._id, role: 'umpire' }],
  });
  await Ball.insertMany([...makeBalls(m1._id, 1, aB, bBwl, 5), ...makeBalls(m1._id, 2, bB, aBwl, 5)]);

  // Live match
  const m2 = await Match.create({
    title: 'Evening T20 Showdown', venue: 'Secunderabad Stadium',
    teamA: teamA._id, teamB: teamB._id, format: 'T20', totalOvers: 10,
    state: 'FIRST_INNINGS', createdBy: org._id, scheduledAt: new Date(),
    toss: { winner: teamB._id, decision: 'bowl' },
    innings: {
      first: inningsFirst(teamA._id, teamB._id, aB[0].userId, aB[1].userId, bBwl[0].userId),
    },
    roles: [{ userId: users[1]._id, role: 'scorer' }],
  });
  await Ball.insertMany(makeBalls(m2._id, 1, aB, bBwl, 4));

  // Scheduled match
  await Match.create({
    title: 'Weekend Warriors Cup', venue: 'LB Stadium',
    teamA: teamA._id, teamB: teamB._id, format: 'ODI', totalOvers: 20,
    state: 'NOT_STARTED', createdBy: org._id,
    scheduledAt: new Date(Date.now() + 2 * 86400000), roles: [],
  });

  console.log('  ✓ 3 matches + ball data seeded');
}

async function main() {
  const reset = process.argv.includes('--reset');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ MongoDB connected\n');

  if (reset) {
    await Promise.all([
      User.deleteMany({}), Team.deleteMany({}), Match.deleteMany({}),
      Ball.deleteMany({}), ScoreSummary.deleteMany({}), AuditLog.deleteMany({}),
    ]);
    console.log('✓ All collections cleared\n');
  }

  console.log('Seeding users…');
  const users = await seedUsers();
  console.log(`  ✓ ${users.length} users`);

  console.log('Seeding teams…');
  const { teamA, teamB } = await seedTeams(users);
  console.log('  ✓ Royal Strikers + Thunder Kings');

  console.log('Seeding matches…');
  await seedMatches(users, teamA, teamB);

  console.log('\n✅  Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('  Login accounts  (password: Password123!)');
  console.log('─────────────────────────────────────────────');
  USERS_DATA.forEach((u) => console.log(`  ${u.role.padEnd(10)} │ ${u.email}`));
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
