# 🏏 CricAvengers — Production-Ready Cricket Scoring App

A full-stack, production-grade cricket scoring application inspired by CricHeroes.
Ball-by-ball scoring, real-time updates, offline support, and full scorecards.

---

## 🏗️ Tech Stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Backend  | Node.js 20 · Express 4 · MongoDB 7 (Mongoose)          |
| Realtime | Socket.IO 4                                             |
| Auth     | JWT (Access + Refresh token rotation)                   |
| Mobile   | React Native · Expo SDK 54 · Expo Router v4             |
| Styling  | NativeWind v4 (Tailwind CSS v3 for React Native)        |
| State    | Zustand v5                                              |
| DevOps   | Docker · Docker Compose                                 |

---

## 📁 Project Structure

```
cricavengers/
├── backend/
│   ├── src/
│   │   ├── config/          # DB connection
│   │   ├── models/          # Mongoose schemas (User, Team, Match, Ball, ScoreSummary, AuditLog)
│   │   ├── middlewares/     # auth, validate, rateLimiter, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/        # Register, login, refresh, logout
│   │   │   ├── users/       # Profile management
│   │   │   ├── teams/       # Team + player CRUD
│   │   │   ├── matches/     # Match state machine, toss, innings
│   │   │   ├── scoring/     # Add/edit/undo/delete ball + recompute
│   │   │   ├── stats/       # Aggregated batting/bowling/leaderboard
│   │   │   └── search/      # Cross-entity search
│   │   ├── sockets/         # Socket.IO JWT auth + match rooms
│   │   └── utils/
│   │       ├── scoring-engine.js   # Pure deterministic engine (fully tested)
│   │       └── seed.js             # Sample data
│   ├── Dockerfile
│   └── .env.example
├── mobile/
│   ├── app/
│   │   ├── (auth)/          # Login, Register
│   │   ├── (tabs)/          # Home, Matches, Teams, Leaderboard, Profile
│   │   └── match/[id]/      # Live, Score screens
│   ├── components/scoring/  # BallInput, ScoreBoard, WicketModal, etc.
│   ├── store/               # Zustand stores (auth, match, scoring, team)
│   ├── services/            # API client, Socket, Offline sync queue
│   └── constants/           # Match states, extra types, colors
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+  ·  MongoDB 7  ·  Expo Go (phone) or emulator

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI + JWT secrets
npm install
npm run seed                # loads sample users, teams, 1 match
npm run dev                 # → http://localhost:5000
```

### 2. Mobile

```bash
cd mobile
npm install
```

Create `mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1     # Android emulator
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

```bash
npm run android   # or: npm run ios
```

### 3. Docker (Production)

```bash
docker-compose up -d
```

---

## 🧪 Tests

```bash
cd backend && npm test
```

Tests cover the deterministic scoring engine: legal delivery detection, run counting, over progression, extras, wickets, batting/bowling stats, completion conditions, and deleted balls.

---

## 🏏 Match State Machine

```
NOT_STARTED → TOSS_DONE → FIRST_INNINGS → INNINGS_BREAK → SECOND_INNINGS → COMPLETED
                                    ↘ ABANDONED (from any state)
```

Invalid transitions throw an error — you cannot score a ball in `NOT_STARTED` state.

---

## 🎯 Ball Storage (Source of Truth)

Every ball is stored individually:
```json
{
  "matchId": "...",  "innings": 1,  "over": 3,  "ball": 2,
  "batsman": "userId",  "bowler": "userId",
  "runs": 4,
  "extras": { "type": null, "runs": 0 },
  "wicket": null,
  "strikerAfter": "userId",  "nonStrikerAfter": "userId"
}
```

All stats (batting avg, bowling economy, scorecard, fall of wickets) are derived
from this log — never stored independently. Edit/undo/delete = recompute from scratch.

---

## 📡 Socket.IO Events

```js
// Connect with JWT
const socket = io(SOCKET_URL, { auth: { token: accessToken } });

// Join a match room
socket.emit('JOIN_MATCH', matchId);

// Receive live updates
socket.on('BALL_ADDED',    (data) => { /* data.ball, data.summary */ });
socket.on('MATCH_UPDATED', (data) => { /* data.summary */ });
```

---

## 🌱 Sample Logins (after seed)

| Email           | Password    | Role      |
|-----------------|-------------|-----------|
| arjun@test.com  | Password123 | Organizer |
| rahul@test.com  | Password123 | Player    |

---

## 🔐 Security

- JWT access (15 min) + refresh (7 days) with rotation
- Refresh token reuse detection → invalidates all sessions
- Rate limiting: 100/15min global · 10/15min auth · 5/sec scoring
- Helmet + CORS + Joi validation on every endpoint
- Audit log for every scoring change

---

## 📊 Key API Endpoints

```
POST /api/v1/auth/register          Register
POST /api/v1/auth/login             Login
POST /api/v1/auth/refresh           Refresh tokens

GET  /api/v1/matches                List matches
POST /api/v1/matches                Create match
GET  /api/v1/matches/live           Live matches
POST /api/v1/matches/:id/toss       Set toss
POST /api/v1/matches/:id/innings/start  Start innings

POST /api/v1/scoring/matches/:id/balls         Add ball
POST /api/v1/scoring/matches/:id/innings/:n/undo  Undo last
PUT  /api/v1/scoring/matches/:id/balls/:ballId  Edit ball
GET  /api/v1/scoring/matches/:id/live          Live summary

GET  /api/v1/stats/leaderboard      Top batsmen/bowlers
GET  /api/v1/stats/players/:id      Player career stats
```

---

Made with ❤️ for cricket fans everywhere 🏏