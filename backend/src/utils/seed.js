/**
 * CricAvengers Seed Script
 *
 * Modes:
 *   node src/utils/seed.js              – seed users + teams only
 *   node src/utils/seed.js --match      – seed a completed match (users/teams must exist)
 *   node src/utils/seed.js --full       – seed users + teams + completed match
 *   node src/utils/seed.js --reset      – wipe everything, then re-seed users + teams + match
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
const { recomputeSummary } = require('../modules/scoring/scoreSummary.service');

// ─── Player definitions ──────────────────────────────────────────────────────

const PLAYERS = [
  { name: 'Dhanunjay Thumula', email: 'dhanu@test.com',          role: 'organizer' },
  // Team A: Sky Warriors (idx 1-15)
  { name: 'Arjun Sharma',      email: 'arjun@test.com',          role: 'player' },
  { name: 'Rohit Reddy',       email: 'rohit@test.com',          role: 'player' },
  { name: 'Kiran Rao',         email: 'kiran@test.com',          role: 'player' },
  { name: 'Suresh Kumar',      email: 'suresh@test.com',         role: 'player' },
  { name: 'Vijay Patel',       email: 'vijay@test.com',          role: 'player' },
  { name: 'Naveen Singh',      email: 'naveen@test.com',         role: 'player' },
  { name: 'Prasad Iyer',       email: 'prasad@test.com',         role: 'player' },
  { name: 'Aakash Mehta',      email: 'aakash@test.com',         role: 'player' },
  { name: 'Deepak Nair',       email: 'deepak@test.com',         role: 'player' },
  { name: 'Sanjay Dubey',      email: 'sanjay@test.com',         role: 'player' },
  { name: 'Ravi Joshi',        email: 'ravi@test.com',           role: 'player' },
  { name: 'Ankit Kumar',       email: 'ankit@test.com',          role: 'player' },
  { name: 'Vishal Singh',      email: 'vishal@test.com',         role: 'player' },
  { name: 'Raj Malhotra',      email: 'raj@test.com',            role: 'player' },
  { name: 'Aman Verma',        email: 'aman@test.com',           role: 'player' },
  // Team B: Fire Eagles (idx 16-30)
  { name: 'Mohammed Faiz',     email: 'faiz@test.com',           role: 'player' },
  { name: 'Ganesh Varma',      email: 'ganesh@test.com',         role: 'player' },
  { name: 'Nikhil Chandra',    email: 'nikhil@test.com',         role: 'player' },
  { name: 'Tarun Yadav',       email: 'tarun@test.com',          role: 'player' },
  { name: 'Pranav Gupta',      email: 'pranav@test.com',         role: 'player' },
  { name: 'Siddharth Rao',     email: 'siddharth@test.com',      role: 'player' },
  { name: 'Kartik Verma',      email: 'kartik@test.com',         role: 'player' },
  { name: 'Lokesh Bhat',       email: 'lokesh@test.com',         role: 'player' },
  { name: 'Uday Krishnan',     email: 'uday@test.com',           role: 'player' },
  { name: 'Harish Pillai',     email: 'harish@test.com',         role: 'player' },
  { name: 'Sachin Nayak',      email: 'sachin@test.com',         role: 'player' },
  { name: 'Rahul Desai',       email: 'rahul@test.com',          role: 'player' },
  { name: 'Ankit Jain',        email: 'ankit.jain@test.com',     role: 'player' },
  { name: 'Priyank Shah',      email: 'priyank@test.com',        role: 'player' },
  { name: 'Devraj More',       email: 'devraj@test.com',         role: 'player' },
];

const ROLES_TEMPLATE = [
  'batsman','batsman','batsman','batsman','all-rounder',
  'all-rounder','wicket-keeper','bowler','bowler','bowler',
  'bowler','batsman','batsman','all-rounder','bowler',
];

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUsers() {
  const hash = await bcrypt.hash('Password123!', 10);
  return User.insertMany(PLAYERS.map(u => ({ ...u, password: hash, isActive: true })));
}

function mkPlayer(u, idx) {
  return {
    userId: u._id, name: u.name,
    role: ROLES_TEMPLATE[idx] || 'batsman',
    jerseyNumber: idx + 1,
    isCaptain: idx === 0,
    isViceCaptain: idx === 1,
  };
}

async function seedTeams(users) {
  const org = users[0];
  const teamA = await Team.create({
    name: 'Sky Warriors', shortName: 'SW', color: '#1E3A5F',
    createdBy: org._id,
    players: users.slice(1, 16).map((u, i) => mkPlayer(u, i)),
  });
  const teamB = await Team.create({
    name: 'Fire Eagles', shortName: 'FE', color: '#DC2626',
    createdBy: org._id,
    players: users.slice(16, 31).map((u, i) => mkPlayer(u, i)),
  });
  return { teamA, teamB };
}

// ─── Ball simulation engine ───────────────────────────────────────────────────

/**
 * Ball spec notation:
 *   { r: N }                    normal delivery, N runs
 *   { r: N, shot: 'region' }    with shot region
 *   { r: N, w: 'type' }         wicket (striker dismissed), optional runs before dismissal
 *   { r: N, w: 'type', shot }   wicket + shot region
 *   { wd: N }                   wide, N = extra runs beyond the 1 penalty (usually 0)
 *   { nb: N }                   no ball, N = bat runs off the no ball
 *   { nb: N, shot: 'region' }   no ball with shot
 */

const SHOT_BY_RUNS = {
  6: ['long_on','long_off','straight','mid_wicket','square_leg'],
  4: ['cover','point','fine_leg','third_man','mid_off','square_leg','gully'],
  1: ['mid_on','mid_off','cover','mid_wicket','point','fine_leg'],
  2: ['mid_wicket','cover','mid_on','mid_off','point'],
  3: ['mid_wicket','cover','mid_on','fine_leg'],
  0: [null],
};
function autoShot(r) {
  const opts = SHOT_BY_RUNS[r] || SHOT_BY_RUNS[1];
  return opts[Math.floor(Math.random() * opts.length)];
}

function simulateInnings(matchId, inningsNum, batters, bowlerPerOver, overPlans) {
  const balls = [];
  let striker    = batters[0];
  let nonStriker = batters[1];
  let nextBatIdx = 2;

  for (let ov = 0; ov < overPlans.length; ov++) {
    const bowler = bowlerPerOver[ov];
    const specs  = overPlans[ov];
    let legalInOver = 0;
    let seqInOver   = 0;

    for (const spec of specs) {
      seqInOver++;
      const isWide   = 'wd' in spec;
      const isNoBall = 'nb' in spec;
      const isLegal  = !isWide && !isNoBall;
      if (isLegal) legalInOver++;

      const currentStriker    = striker;
      const currentNonStriker = nonStriker;
      const runs = isWide ? 0 : (isNoBall ? (spec.nb || 0) : (spec.r || 0));
      const wicketType = spec.w || null;
      const shotRegion = spec.shot || (isWide || isNoBall ? null : autoShot(runs));

      let extras = null;
      if (isWide)   extras = { type: 'wide',    runs: 1 + (spec.wd || 0) };
      if (isNoBall) extras = { type: 'no_ball', runs: 1 };

      let wicketObj  = null;
      let strikerAfterVal;
      let nonStrikerAfterVal;

      if (wicketType) {
        wicketObj = {
          type: wicketType,
          batsmanOut: currentStriker._id,
          fielder: spec.fielder || null,
        };
        const newBatter = batters[nextBatIdx++] || null;
        if (runs % 2 !== 0) {
          // batsmen crossed before dismissal
          striker    = currentNonStriker;
          nonStriker = newBatter;
        } else {
          striker    = newBatter;
          nonStriker = currentNonStriker;
        }
        strikerAfterVal    = striker ? striker._id : null;
        nonStrikerAfterVal = nonStriker ? nonStriker._id : currentNonStriker._id;
      } else if (isWide) {
        strikerAfterVal    = currentStriker._id;
        nonStrikerAfterVal = currentNonStriker._id;
      } else {
        if (runs % 2 !== 0) {
          striker    = currentNonStriker;
          nonStriker = currentStriker;
        }
        strikerAfterVal    = striker._id;
        nonStrikerAfterVal = nonStriker._id;
      }

      balls.push({
        matchId,
        innings: inningsNum,
        over: ov,
        ball: seqInOver,
        batsman:  currentStriker._id,
        bowler:   bowler._id,
        runs,
        extras:   extras || { type: null, runs: 0 },
        wicket:   wicketObj,
        isLegal,
        strikerAfter:    strikerAfterVal,
        nonStrikerAfter: nonStrikerAfterVal,
        shotRegion,
        timestamp: new Date(Date.now() + (ov * 360 + seqInOver * 30) * 1000),
      });
    }

    // End-of-over: swap ends (batsman who was non-striker now faces)
    [striker, nonStriker] = [nonStriker, striker];
  }

  return balls;
}

// ─── Match data definition ────────────────────────────────────────────────────

async function seedMatch(users, teamA, teamB) {
  // ── Player references ──────────────────────────────────────────────────────
  // Sky Warriors (users 1-15, teamA)
  const sw = users.slice(1, 16);   // [Arjun,Rohit,Kiran,Suresh,Vijay,Naveen,Prasad,Aakash,Deepak,Sanjay,Ravi,...]
  const [Arjun,Rohit,Kiran,Suresh,Vijay,Naveen,Prasad,Aakash,Deepak,Sanjay,Ravi] = sw;

  // Fire Eagles (users 16-30, teamB)
  const fe = users.slice(16, 31);  // [Faiz,Varma,Nikhil,Tarun,Pranav,Siddharth,Kartik,Lokesh,Uday,Harish,Sachin,...]
  const [Faiz,Varma,Nikhil,Tarun,Pranav,Siddharth,Kartik,Lokesh,Uday,Harish,Sachin] = fe;

  const org = users[0];

  // ── Create Match ───────────────────────────────────────────────────────────
  const match = await Match.create({
    title:       'Sky Warriors vs Fire Eagles – T20 Clash',
    teamA:       teamA._id,
    teamB:       teamB._id,
    venue:       'Hyderabad Cricket Ground',
    scheduledAt: new Date('2026-04-20T14:00:00.000Z'),
    format:      'T20',
    totalOvers:  20,
    state:       'COMPLETED',
    createdBy:   org._id,
    isPublic:    true,
    toss: {
      winner:   teamA._id,
      decision: 'bat',
    },
    squadA: sw.map((u, i) => ({ userId: u._id, name: u.name, role: ROLES_TEMPLATE[i] || 'batsman', jerseyNumber: i+1 })),
    squadB: fe.map((u, i) => ({ userId: u._id, name: u.name, role: ROLES_TEMPLATE[i] || 'batsman', jerseyNumber: i+1 })),
    captainA: Arjun._id, wkA: Prasad._id,
    captainB: Faiz._id,  wkB: Lokesh._id,
    innings: {
      first: {
        battingTeam: teamA._id, bowlingTeam: teamB._id,
        totalRuns: 0, wickets: 0, overs: 0, balls: 0,
        isCompleted: true, completionReason: 'overs_complete',
      },
      second: {
        battingTeam: teamB._id, bowlingTeam: teamA._id,
        totalRuns: 0, wickets: 0, overs: 0, balls: 0,
        target: 159,
        isCompleted: true, completionReason: 'overs_complete',
      },
    },
    result: {
      winner:      teamA._id,
      winType:     'runs',
      winMargin:   17,
      description: 'Sky Warriors won by 17 runs',
    },
    roles: [{ userId: org._id, role: 'organizer' }],
  });

  // ── Fire Eagles bowlers for innings 1 (per over, 0-indexed) ───────────────
  // Max 4 overs each: Faiz, Varma, Nikhil, Tarun; 2 overs: Pranav, Siddharth
  const i1Bowlers = [
    Faiz, Varma, Nikhil, Tarun, Pranav, Siddharth,   // overs 1-6
    Faiz, Varma, Nikhil, Tarun,                        // overs 7-10
    Pranav, Siddharth, Faiz, Varma,                    // overs 11-14
    Nikhil, Tarun, Faiz, Varma, Nikhil, Tarun,        // overs 15-20
  ];

  // ── Innings 1 over plans: Sky Warriors bat → 158/7 in 20 overs ────────────
  //
  // Batting order:  Arjun(0) Rohit(1) | Kiran(2) | Suresh(3) | Vijay(4)
  //                 Naveen(5) | Prasad(6) | Aakash(7) | Deepak(8) | Sanjay(9) | Ravi(10)
  // Wickets:
  //   W1 over 5  – Rohit caught    → Kiran in
  //   W2 over 8  – Kiran bowled    → Suresh in
  //   W3 over 11 – Arjun caught    → Vijay in
  //   W4 over 13 – Suresh LBW      → Naveen in
  //   W5 over 15 – Vijay stumped   → Prasad in
  //   W6 over 18 – Prasad caught   → Aakash in
  //   W7 over 20 – Aakash run_out  → Deepak in (overs exhausted)
  //
  const i1Plans = [
    // Over 1 (Faiz) – tight opener: 5 runs
    [{r:0},{r:1,shot:'mid_on'},{r:0},{r:4,shot:'cover'},{r:0},{r:0}],
    // Over 2 (Varma): 7 runs
    [{r:0},{r:1,shot:'point'},{r:4,shot:'fine_leg'},{r:0},{r:1,shot:'mid_wicket'},{r:1,shot:'mid_on'}],
    // Over 3 (Nikhil): 8 runs
    [{r:1,shot:'mid_off'},{r:4,shot:'cover'},{r:0},{r:1,shot:'point'},{r:0},{r:2,shot:'mid_wicket'}],
    // Over 4 (Tarun): 6 runs incl wide
    [{r:0},{wd:0},{r:1,shot:'mid_on'},{r:4,shot:'third_man'},{r:0},{r:0},{r:1,shot:'cover'}],
    // Over 5 (Pranav) – Rohit 25 off bat: W1 Rohit caught
    [{r:6,shot:'long_on'},{r:0},{r:1,shot:'mid_wicket'},{r:0},{r:0,w:'caught',shot:'cover'},{r:0}],
    // Over 6 (Siddharth) – Kiran comes in: 7 runs
    [{r:0},{r:1,shot:'mid_off'},{r:4,shot:'square_leg'},{r:0},{r:0},{r:2,shot:'mid_wicket'}],
    // Over 7 (Faiz): 6 runs
    [{r:1,shot:'point'},{r:0},{r:4,shot:'fine_leg'},{r:0},{r:1,shot:'mid_on'},{r:0}],
    // Over 8 (Varma) – Kiran bowled: W2
    [{r:0},{r:1,shot:'cover'},{r:0},{r:4,shot:'third_man'},{r:0,w:'bowled'},{r:0}],
    // Over 9 (Nikhil) – Suresh in: 9 runs
    [{r:0},{r:6,shot:'long_off'},{r:1,shot:'mid_on'},{r:0},{r:0},{r:2,shot:'mid_wicket'}],
    // Over 10 (Tarun): 7 runs
    [{r:1,shot:'point'},{r:0},{r:4,shot:'cover'},{r:0},{r:1,shot:'mid_wicket'},{r:1,shot:'fine_leg'}],
    // Over 11 (Pranav) – Arjun 62 off 50 balls: W3 Arjun caught
    [{r:4,shot:'mid_off'},{r:1,shot:'mid_on'},{r:0},{r:6,shot:'long_on'},{r:0,w:'caught',shot:'long_off'},{r:1,shot:'point'}],
    // Over 12 (Siddharth) – Vijay in: 9 runs
    [{r:0},{r:4,shot:'cover'},{r:1,shot:'mid_wicket'},{r:0},{r:4,shot:'point'},{r:0}],
    // Over 13 (Faiz) – Suresh LBW: W4
    [{r:1,shot:'mid_off'},{r:0},{r:4,shot:'cover'},{r:0,w:'lbw'},{r:0},{r:1,shot:'mid_on'}],
    // Over 14 (Varma) – Naveen in: 8 runs
    [{r:0},{r:4,shot:'fine_leg'},{r:0},{r:1,shot:'point'},{r:0},{r:3,shot:'mid_wicket'}],
    // Over 15 (Nikhil) – Vijay stumped: W5
    [{r:6,shot:'long_on'},{r:0},{r:1,shot:'mid_on'},{r:0},{r:4,shot:'cover'},{r:0,w:'stumped'}],
    // Over 16 (Tarun) – Prasad in: 8 runs
    [{r:0},{r:1,shot:'mid_off'},{r:4,shot:'third_man'},{r:0},{r:1,shot:'point'},{r:2,shot:'mid_wicket'}],
    // Over 17 (Faiz) – death: 10 runs
    [{r:0},{r:6,shot:'long_off'},{r:0},{r:1,shot:'mid_on'},{r:1,shot:'cover'},{r:2,shot:'fine_leg'}],
    // Over 18 (Varma) – Prasad caught: W6, Aakash in
    [{r:4,shot:'square_leg'},{r:0},{r:1,shot:'mid_wicket'},{r:0,w:'caught',shot:'long_on'},{r:0},{r:4,shot:'cover'}],
    // Over 19 (Nikhil) – Aakash in: 11 runs
    [{r:1,shot:'mid_off'},{r:6,shot:'long_on'},{r:0},{r:0},{r:4,shot:'fine_leg'},{r:0}],
    // Over 20 (Tarun) – last over: Aakash run_out W7, Deepak in: 8 runs
    [{r:4,shot:'third_man'},{r:0},{r:1,shot:'mid_on'},{r:0,w:'run_out'},{r:1,shot:'point'},{r:2,shot:'mid_wicket'}],
  ];

  const i1Batters = [Arjun,Rohit,Kiran,Suresh,Vijay,Naveen,Prasad,Aakash,Deepak,Sanjay,Ravi];
  const i1Balls   = simulateInnings(match._id, 1, i1Batters, i1Bowlers, i1Plans);
  await Ball.insertMany(i1Balls);

  // ── Sky Warriors bowlers for innings 2 (per over) ─────────────────────────
  const i2Bowlers = [
    Aakash, Deepak, Sanjay, Ravi, Aakash, Deepak,     // overs 1-6
    Sanjay, Ravi, Aakash, Deepak,                       // overs 7-10
    Vijay, Naveen, Sanjay, Ravi, Vijay,                 // overs 11-15
    Naveen, Aakash, Deepak, Sanjay, Ravi,               // overs 16-20
  ];

  // ── Innings 2 over plans: Fire Eagles chase 159 → 141/9 (lose by 17) ──────
  //
  // Batting order:  Faiz(0) Varma(1) | Nikhil(2) | Tarun(3) | Pranav(4)
  //                 Siddharth(5) | Kartik(6) | Lokesh(7) | Uday(8) | Harish(9) | Sachin(10)
  // Wickets:
  //   W1 over 4   – Varma caught    → Nikhil in
  //   W2 over 7   – Faiz caught     → Tarun in
  //   W3 over 10  – Nikhil LBW      → Pranav in
  //   W4 over 13  – Tarun run_out   → Siddharth in
  //   W5 over 15  – Pranav bowled   → Kartik in
  //   W6 over 17  – Siddharth caught→ Lokesh in
  //   W7 over 18  – Kartik caught   → Uday in
  //   W8 over 19  – Lokesh bowled   → Harish in
  //   W9 over 20  – Uday run_out    → Sachin in (overs end)
  //
  const i2Plans = [
    // Over 1 (Aakash) – 7 runs
    [{r:1,shot:'mid_on'},{r:0},{r:4,shot:'cover'},{r:0},{r:1,shot:'point'},{r:1,shot:'mid_wicket'}],
    // Over 2 (Deepak) – 6 runs
    [{r:0},{r:4,shot:'fine_leg'},{r:0},{r:0},{r:1,shot:'mid_off'},{r:1,shot:'point'}],
    // Over 3 (Sanjay) – 8 runs
    [{r:0},{r:1,shot:'cover'},{r:6,shot:'long_on'},{r:0},{r:0},{r:1,shot:'mid_wicket'}],
    // Over 4 (Ravi) – Varma 18 off bat: W1 Varma caught, Nikhil in
    [{r:4,shot:'square_leg'},{r:1,shot:'mid_on'},{r:0},{r:0,w:'caught',shot:'point'},{r:0},{r:1,shot:'mid_off'}],
    // Over 5 (Aakash) – 9 runs
    [{r:0},{r:1,shot:'cover'},{r:4,shot:'third_man'},{r:0},{r:4,shot:'fine_leg'},{r:0}],
    // Over 6 (Deepak) – 8 runs
    [{r:1,shot:'mid_on'},{r:0},{r:4,shot:'cover'},{r:0},{r:2,shot:'mid_wicket'},{r:1,shot:'point'}],
    // Over 7 (Sanjay) – Faiz 52 off bat: W2 Faiz caught, Tarun in
    [{r:6,shot:'long_off'},{r:4,shot:'cover'},{r:0},{r:1,shot:'mid_on'},{r:0,w:'caught',shot:'long_on'},{r:0}],
    // Over 8 (Ravi) – 7 runs
    [{r:0},{r:4,shot:'fine_leg'},{r:0},{r:1,shot:'point'},{r:0},{r:2,shot:'mid_wicket'}],
    // Over 9 (Aakash) – 6 runs
    [{r:1,shot:'mid_off'},{r:0},{r:4,shot:'cover'},{r:0},{r:0},{r:1,shot:'mid_on'}],
    // Over 10 (Deepak) – Nikhil 31: W3 Nikhil LBW, Pranav in
    [{r:0},{r:4,shot:'square_leg'},{r:1,shot:'mid_wicket'},{r:0,w:'lbw'},{r:0},{r:1,shot:'cover'}],
    // Over 11 (Vijay) – 7 runs
    [{r:0},{r:1,shot:'point'},{r:4,shot:'third_man'},{r:0},{r:1,shot:'mid_on'},{r:1,shot:'mid_off'}],
    // Over 12 (Naveen) – 6 runs
    [{r:0},{r:4,shot:'cover'},{r:0},{r:1,shot:'mid_wicket'},{r:0},{r:1,shot:'fine_leg'}],
    // Over 13 (Sanjay) – Tarun 10: W4 Tarun run_out, Siddharth in
    [{r:1,shot:'mid_on'},{r:0},{r:4,shot:'point'},{r:0,w:'run_out'},{r:0},{r:1,shot:'cover'}],
    // Over 14 (Ravi) – 7 runs
    [{r:0},{r:1,shot:'mid_wicket'},{r:4,shot:'fine_leg'},{r:0},{r:1,shot:'mid_off'},{r:1,shot:'cover'}],
    // Over 15 (Vijay) – Pranav 8: W5 Pranav bowled, Kartik in
    [{r:4,shot:'third_man'},{r:0},{r:1,shot:'point'},{r:0,w:'bowled'},{r:0},{r:0}],
    // Over 16 (Naveen) – 7 runs
    [{r:0},{r:4,shot:'cover'},{r:0},{r:1,shot:'mid_on'},{r:0},{r:2,shot:'mid_wicket'}],
    // Over 17 (Aakash) – Siddharth 5: W6 Siddharth caught, Lokesh in
    [{r:1,shot:'mid_off'},{r:0},{r:4,shot:'square_leg'},{r:0,w:'caught',shot:'point'},{r:0},{r:0}],
    // Over 18 (Deepak) – Kartik 4: W7 Kartik caught, Uday in
    [{r:0},{r:4,shot:'cover'},{r:0,w:'caught',shot:'long_on'},{r:0},{r:1,shot:'mid_on'},{r:0}],
    // Over 19 (Sanjay) – Lokesh 2: W8 Lokesh bowled, Harish in
    [{r:1,shot:'point'},{r:0},{r:0,w:'bowled'},{r:0},{r:4,shot:'fine_leg'},{r:1,shot:'cover'}],
    // Over 20 (Ravi) – Uday 1: W9 Uday run_out, Sachin in (overs end): 4 runs
    [{r:0},{r:1,shot:'mid_on'},{r:0},{r:0,w:'run_out'},{r:1,shot:'cover'},{r:2,shot:'mid_wicket'}],
  ];

  const i2Batters = [Faiz,Varma,Nikhil,Tarun,Pranav,Siddharth,Kartik,Lokesh,Uday,Harish,Sachin];
  const i2Balls   = simulateInnings(match._id, 2, i2Batters, i2Bowlers, i2Plans);
  await Ball.insertMany(i2Balls);

  // ── Recompute ScoreSummary from ball log ───────────────────────────────────
  const summary = await recomputeSummary(match._id.toString());

  // ── Patch innings totals into Match document ───────────────────────────────
  const inn1 = summary.innings[0];
  const inn2 = summary.innings[1];
  await Match.findByIdAndUpdate(match._id, {
    'innings.first.totalRuns':  inn1?.totalRuns  || 0,
    'innings.first.wickets':    inn1?.wickets    || 0,
    'innings.first.overs':      inn1?.overs      || 20,
    'innings.first.balls':      inn1?.balls      || 0,
    'innings.second.totalRuns': inn2?.totalRuns  || 0,
    'innings.second.wickets':   inn2?.wickets    || 0,
    'innings.second.overs':     inn2?.overs      || 20,
    'innings.second.balls':     inn2?.balls      || 0,
    'result.winMargin': (inn1?.totalRuns || 0) - (inn2?.totalRuns || 0),
    'result.description': `Sky Warriors won by ${(inn1?.totalRuns || 0) - (inn2?.totalRuns || 0)} runs`,
  });

  return { match, summary, inn1, inn2 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args  = process.argv.slice(2);
  const reset = args.includes('--reset');
  const full  = args.includes('--full') || reset;
  const matchOnly = args.includes('--match');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ MongoDB connected\n');

  if (reset) {
    await Promise.all([
      User.deleteMany({}), Team.deleteMany({}),
      Match.deleteMany({}), Ball.deleteMany({}),
      ScoreSummary.deleteMany({}), AuditLog.deleteMany({}),
    ]);
    console.log('✓ All collections cleared\n');
  }

  let users, teams;

  if (!matchOnly) {
    console.log('Seeding users…');
    users = await seedUsers();
    console.log(`  ✓ ${users.length} users created`);

    console.log('Seeding teams…');
    teams = await seedTeams(users);
    console.log('  ✓ Sky Warriors & Fire Eagles created');
  } else {
    // Load existing
    users = await User.find({}).sort({ createdAt: 1 }).lean();
    if (users.length < 31) {
      console.error('❌ Not enough users found. Run seed without --match first.');
      process.exit(1);
    }
    const teamADoc = await Team.findOne({ name: 'Sky Warriors' });
    const teamBDoc = await Team.findOne({ name: 'Fire Eagles' });
    if (!teamADoc || !teamBDoc) {
      console.error('❌ Teams not found. Run seed without --match first.');
      process.exit(1);
    }
    teams = { teamA: teamADoc, teamB: teamBDoc };
  }

  if (full || matchOnly) {
    console.log('\nSeeding completed match…');
    const { match, inn1, inn2 } = await seedMatch(users, teams.teamA, teams.teamB);
    console.log(`  ✓ Match created: ${match.title}`);
    console.log(`  ✓ Innings 1: ${inn1?.totalRuns}/${inn1?.wickets} in 20 overs`);
    console.log(`  ✓ Innings 2: ${inn2?.totalRuns}/${inn2?.wickets} in 20 overs`);
    console.log(`  ✓ Result: ${match.result?.description || 'computed'}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Login accounts (password: Password123!)');
  console.log('──────────────────────────────────────────────────────────');
  console.log('  organizer  │ dhanu@test.com    (Dhanunjay Thumula)');
  console.log('  opener SW  │ arjun@test.com    (Arjun Sharma, Sky Warriors)');
  console.log('  captain FE │ faiz@test.com     (Mohammed Faiz, Fire Eagles)');
  console.log('──────────────────────────────────────────────────────────');
  if (full || matchOnly) {
    console.log('  Completed match available in app → match list');
    console.log('  • Scorecard, Summary, Commentary, Squads all populated');
    console.log('  • Player stats available for all 22 players');
  }
  console.log('══════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message, err.stack);
  process.exit(1);
});
