/**
 * Seed script – simple demo data for CricAvengers app.
 * Creates 30 players in 2 teams (15 players each).
 * Run:        node src/utils/seed.js
 * Full reset: node src/utils/seed.js --reset
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User         = require('../models/User');
const Team         = require('../models/Team');
const AuditLog     = require('../models/AuditLog');

// ─── helpers ─────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── users ───────────────────────────────────────────────────────────────────

const PLAYERS = [
  // Organizer / Admin
  { name: 'Dhanunjay Thumula', email: 'dhanu@test.com', role: 'organizer' },

  // Team A: Sky Warriors – 15 players (idx 1-15)
  { name: 'Arjun Sharma',     email: 'arjun@test.com',    role: 'player' },
  { name: 'Rohit Reddy',      email: 'rohit@test.com',    role: 'player' },
  { name: 'Kiran Rao',        email: 'kiran@test.com',    role: 'player' },
  { name: 'Suresh Kumar',     email: 'suresh@test.com',   role: 'player' },
  { name: 'Vijay Patel',      email: 'vijay@test.com',    role: 'player' },
  { name: 'Naveen Singh',     email: 'naveen@test.com',   role: 'player' },
  { name: 'Prasad Iyer',      email: 'prasad@test.com',   role: 'player' },
  { name: 'Aakash Mehta',     email: 'aakash@test.com',   role: 'player' },
  { name: 'Deepak Nair',      email: 'deepak@test.com',   role: 'player' },
  { name: 'Sanjay Dubey',     email: 'sanjay@test.com',   role: 'player' },
  { name: 'Ravi Joshi',       email: 'ravi@test.com',     role: 'player' },
  { name: 'Ankit Kumar',      email: 'ankit@test.com',    role: 'player' },
  { name: 'Vishal Singh',     email: 'vishal@test.com',   role: 'player' },
  { name: 'Raj Malhotra',     email: 'raj@test.com',      role: 'player' },
  { name: 'Aman Verma',       email: 'aman@test.com',     role: 'player' },

  // Team B: Fire Eagles – 15 players (idx 16-30)
  { name: 'Mohammed Faiz',    email: 'faiz@test.com',     role: 'player' },
  { name: 'Ganesh Varma',     email: 'ganesh@test.com',   role: 'player' },
  { name: 'Nikhil Chandra',   email: 'nikhil@test.com',   role: 'player' },
  { name: 'Tarun Yadav',      email: 'tarun@test.com',    role: 'player' },
  { name: 'Pranav Gupta',     email: 'pranav@test.com',   role: 'player' },
  { name: 'Siddharth Rao',    email: 'siddharth@test.com',role: 'player' },
  { name: 'Kartik Verma',     email: 'kartik@test.com',   role: 'player' },
  { name: 'Lokesh Bhat',      email: 'lokesh@test.com',   role: 'player' },
  { name: 'Uday Krishnan',    email: 'uday@test.com',     role: 'player' },
  { name: 'Harish Pillai',    email: 'harish@test.com',   role: 'player' },
  { name: 'Sachin Nayak',     email: 'sachin@test.com',   role: 'player' },
  { name: 'Rahul Desai',      email: 'rahul@test.com',    role: 'player' },
  { name: 'Ankit Jain',       email: 'ankit.jain@test.com',role: 'player' },
  { name: 'Priyank Shah',     email: 'priyank@test.com',  role: 'player' },
  { name: 'Devraj More',      email: 'devraj@test.com',   role: 'player' },
];

// ─── seed users ──────────────────────────────────────────────────────────────

async function seedUsers() {
  const hash = await bcrypt.hash('Password123!', 10);
  return User.insertMany(PLAYERS.map((u) => ({ ...u, password: hash, isActive: true })));
}

// ─── seed teams ──────────────────────────────────────────────────────────────

const mkPlayer = (u, idx, roles) => ({
  userId: u._id,
  name: u.name,
  role: roles[idx] || 'batsman',
  jerseyNumber: idx + 1,
  isCaptain: idx === 0,
  isViceCaptain: idx === 1,
});

async function seedTeams(users) {
  const ROLES_TEMPLATE = [
    'batsman','batsman','batsman','batsman','all-rounder',
    'all-rounder','wicket-keeper','bowler','bowler','bowler','bowler','batsman','batsman','all-rounder','bowler',
  ];

  const org = users[0];

  const teamA = await Team.create({
    name: 'Sky Warriors', shortName: 'SW', color: '#1E3A5F',
    createdBy: org._id,
    players: users.slice(1, 16).map((u, i) => mkPlayer(u, i, ROLES_TEMPLATE)),
  });

  const teamB = await Team.create({
    name: 'Fire Eagles', shortName: 'FE', color: '#DC2626',
    createdBy: org._id,
    players: users.slice(16, 31).map((u, i) => mkPlayer(u, i, ROLES_TEMPLATE)),
  });

  return { teamA, teamB };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const reset = process.argv.includes('--reset');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ MongoDB connected\n');

  if (reset) {
    await Promise.all([
      User.deleteMany({}),
      Team.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('✓ All collections cleared\n');
  }

  console.log('Seeding users…');
  const users = await seedUsers();
  console.log(`  ✓ ${users.length} users created (1 organizer + 30 players)`);

  console.log('Seeding teams…');
  const teams = await seedTeams(users);

  console.log('\n✅ Seed complete!\n');
  console.log('══════════════════════════════════════════════════════');
  console.log('  App state after seed:');
  console.log('  • 2 teams with 15 unique players each');
  console.log('  • 30 players total');
  console.log('  • 1 organizer account');
  console.log('══════════════════════════════════════════════════════');
  console.log('\n  Login accounts (password: Password123!)');
  console.log('──────────────────────────────────────────────────────');
  console.log('  organizer  │ dhanu@test.com   (Dhanunjay Thumula)');
  console.log('  player     │ arjun@test.com   (Arjun Sharma – Sky Warriors)');
  console.log('  player     │ faiz@test.com    (Mohammed Faiz – Fire Eagles)');
  console.log('──────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
