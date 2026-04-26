/**
 * Deterministic Cricket Scoring Engine
 * All match state can be derived from the ordered ball log.
 * This engine is pure (no DB calls) and fully testable.
 */

const EXTRA_TYPES = { WIDE: 'wide', NO_BALL: 'no_ball', BYE: 'bye', LEG_BYE: 'leg_bye', PENALTY: 'penalty' };
const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket',
  'caught_and_bowled', 'obstructing_field', 'handled_ball', 'timed_out', 'hit_twice'];

// -------------------------------------------------------
// Pure helpers
// -------------------------------------------------------

function isLegalDelivery(ball) {
  const et = ball.extras?.type;
  return et !== EXTRA_TYPES.WIDE && et !== EXTRA_TYPES.NO_BALL;
}

function ballTotalRuns(ball) {
  return (ball.runs || 0) + (ball.extras?.runs || 0);
}

function overString(totalBalls) {
  return `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`;
}

// -------------------------------------------------------
// Strike rotation logic
// -------------------------------------------------------

function shouldRotateStrike(ball, isOverEnd) {
  const runs = ball.runs || 0;
  const extraType = ball.extras?.type;
  const extraRuns = ball.extras?.runs || 0;

  if (ball.wicket?.type === 'run_out') return false; // handled separately

  // Runs are odd → rotate
  const totalBatRuns = runs;
  if (isOverEnd && totalBatRuns % 2 === 0) return true; // rotate at over end if even
  if (!isOverEnd && totalBatRuns % 2 !== 0) return true;

  // Byes / leg-byes: rotate on odd runs
  if ([EXTRA_TYPES.BYE, EXTRA_TYPES.LEG_BYE].includes(extraType)) {
    if (isOverEnd && extraRuns % 2 === 0) return true;
    if (!isOverEnd && extraRuns % 2 !== 0) return true;
  }

  return false;
}

// -------------------------------------------------------
// Core state reducer — derive full innings state from balls
// -------------------------------------------------------

function computeInningsState(balls, maxOvers, maxWickets = 10) {
  const state = {
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,   // balls that count toward overs
    totalBalls: 0,   // including wides/no-balls
    over: 0,
    ball: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
    batting: {},     // batsmanId → stats
    bowling: {},     // bowlerId → stats
    fallOfWickets: [],
    partnerships: [],
    isCompleted: false,
    completionReason: null,
    striker: null,
    nonStriker: null,
    currentBowler: null,
    currentOverBalls: [],
  };

  for (const ball of balls) {
    if (ball.isDeleted) continue;

    const legal = isLegalDelivery(ball);
    const totalRuns = ballTotalRuns(ball);
    const extraType = ball.extras?.type;
    const extraRuns = ball.extras?.runs || 0;
    const batRuns = ball.runs || 0;

    state.totalRuns += totalRuns;
    state.totalBalls++;

    // Extras breakdown
    if (extraType === EXTRA_TYPES.WIDE) {
      state.extras.wides += extraRuns || 1;
      state.extras.total += extraRuns || 1;
    } else if (extraType === EXTRA_TYPES.NO_BALL) {
      // Only the 1-run penalty goes to extras; off-bat runs go to the batsman's tally
      state.extras.noBalls += 1;
      state.extras.total += 1;
    } else if (extraType === EXTRA_TYPES.BYE) {
      state.extras.byes += extraRuns;
      state.extras.total += extraRuns;
    } else if (extraType === EXTRA_TYPES.LEG_BYE) {
      state.extras.legByes += extraRuns;
      state.extras.total += extraRuns;
    } else if (extraType === EXTRA_TYPES.PENALTY) {
      state.extras.penalty += extraRuns;
      state.extras.total += extraRuns;
    }

    // Batting stats
    const bId = ball.batsman?.toString();
    if (bId) {
      if (!state.batting[bId]) {
        state.batting[bId] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: null };
      }
      const bs = state.batting[bId];

      if (legal && extraType !== EXTRA_TYPES.BYE && extraType !== EXTRA_TYPES.LEG_BYE) {
        bs.balls++;
      }
      if (!extraType || extraType === EXTRA_TYPES.NO_BALL) {
        bs.runs += batRuns;
        if (batRuns === 4) bs.fours++;
        if (batRuns === 6) bs.sixes++;
      }
    }

    // Bowling stats
    const bowlId = ball.bowler?.toString();
    if (bowlId) {
      if (!state.bowling[bowlId]) {
        state.bowling[bowlId] = { overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0 };
      }
      const bw = state.bowling[bowlId];
      if (legal) bw.balls++;
      // Bowler concedes: bat runs + penalty no-ball, not byes/leg-byes
      if (extraType === EXTRA_TYPES.WIDE) { bw.runs += extraRuns || 1; bw.wides++; }
      else if (extraType === EXTRA_TYPES.NO_BALL) { bw.runs += 1 + batRuns; bw.noBalls++; }
      else if (!extraType) { bw.runs += batRuns; }
      // Byes/leg-byes don't count against bowler
    }

    // Wicket
    if (ball.wicket) {
      state.wickets++;
      if (bId && state.batting[bId]) {
        state.batting[bId].isOut = true;
        state.batting[bId].dismissal = ball.wicket.type;
      }
      if (bowlId && state.bowling[bowlId]) {
        const notBowlerWickets = ['run_out', 'obstructing_field', 'handled_ball', 'timed_out', 'hit_twice'];
        if (!notBowlerWickets.includes(ball.wicket.type)) {
          state.bowling[bowlId].wickets++;
        }
      }
      state.fallOfWickets.push({
        wicketNumber: state.wickets,
        runs: state.totalRuns,
        over: state.over,
        ball: state.ball + (legal ? 1 : 0),
        batsmanOut: ball.wicket.batsmanOut,
      });
    }

    // Legal delivery — advance over/ball count
    if (legal) {
      state.legalBalls++;
      state.over = Math.floor(state.legalBalls / 6);
      state.ball = state.legalBalls % 6;
    }

    state.currentBowler = ball.bowler;
    state.striker = ball.strikerAfter || ball.batsman;
    state.nonStriker = ball.nonStrikerAfter;
  }

  // Compute bowling overs
  for (const id of Object.keys(state.bowling)) {
    const bw = state.bowling[id];
    bw.overs = Math.floor(bw.balls / 6);
    bw.economy = bw.balls > 0 ? parseFloat(((bw.runs / bw.balls) * 6).toFixed(2)) : 0;
  }

  // Completion check
  if (state.wickets >= maxWickets) {
    state.isCompleted = true;
    state.completionReason = 'all_out';
  } else if (maxOvers && state.over >= maxOvers) {
    state.isCompleted = true;
    state.completionReason = 'overs_complete';
  }

  return state;
}

// -------------------------------------------------------
// Determine batsman/bowler after a delivery
// -------------------------------------------------------

function resolveStrikeAfterBall(ball, striker, nonStriker) {
  const legal = isLegalDelivery(ball);
  const batRuns = ball.runs || 0;
  const extraType = ball.extras?.type;
  const extraRuns = ball.extras?.runs || 0;

  let newStriker = striker;
  let newNonStriker = nonStriker;

  // Wicket — new batsman comes in at striker end unless run out and crossed
  if (ball.wicket) {
    if (ball.wicket.type === 'run_out') {
      // if they crossed, new batter at non-striker end, handle manually
    }
    // New batsman replaces the dismissed batsman — left to caller
    newStriker = null; // signal: needs new batsman
  }

  const totalForRotation = [EXTRA_TYPES.BYE, EXTRA_TYPES.LEG_BYE].includes(extraType) ? extraRuns : batRuns;
  const isOverComplete = legal && /* caller passes this */ false;

  if (totalForRotation % 2 !== 0) {
    [newStriker, newNonStriker] = [newNonStriker, newStriker];
  }

  return { striker: newStriker, nonStriker: newNonStriker };
}

// -------------------------------------------------------
// Validate a ball before adding
// -------------------------------------------------------

function validateBallInput(input) {
  const errors = [];

  if (input.runs === undefined || input.runs === null) errors.push('runs is required');
  if (![0,1,2,3,4,5,6].includes(input.runs)) errors.push('runs must be 0-6');
  if (!input.batsman) errors.push('batsman is required');
  if (!input.bowler) errors.push('bowler is required');

  if (input.extras?.type && !Object.values(EXTRA_TYPES).includes(input.extras.type)) {
    errors.push(`Invalid extra type: ${input.extras.type}`);
  }

  if (input.wicket) {
    if (!WICKET_TYPES.includes(input.wicket.type)) errors.push(`Invalid wicket type: ${input.wicket.type}`);
    if (!input.wicket.batsmanOut) errors.push('wicket.batsmanOut is required');
  }

  return errors;
}

// -------------------------------------------------------
// Full scorecard builder from raw ball array
// -------------------------------------------------------

function buildScorecard(balls, maxOvers, maxWickets = 10) {
  const state = computeInningsState(balls, maxOvers, maxWickets);

  const battingList = Object.entries(state.batting).map(([playerId, s]) => ({
    playerId,
    ...s,
    strikeRate: s.balls > 0 ? parseFloat(((s.runs / s.balls) * 100).toFixed(2)) : 0,
  }));

  const bowlingList = Object.entries(state.bowling).map(([playerId, s]) => ({
    playerId,
    ...s,
  }));

  return {
    totalRuns: state.totalRuns,
    wickets: state.wickets,
    overs: overString(state.legalBalls),
    extras: state.extras,
    runRate: state.legalBalls > 0
      ? parseFloat(((state.totalRuns / state.legalBalls) * 6).toFixed(2))
      : 0,
    batting: battingList,
    bowling: bowlingList,
    fallOfWickets: state.fallOfWickets,
    isCompleted: state.isCompleted,
    completionReason: state.completionReason,
    currentState: {
      striker: state.striker,
      nonStriker: state.nonStriker,
      currentBowler: state.currentBowler,
      over: state.over,
      ball: state.ball,
    },
  };
}

// -------------------------------------------------------
// Match result computation
// -------------------------------------------------------

function computeMatchResult(firstInnings, secondInnings, maxWickets = 10) {
  const target = firstInnings.totalRuns + 1;
  const chasing = secondInnings;

  if (chasing.isCompleted && chasing.completionReason === 'target_achieved') {
    return {
      winner: 'batting_second',
      winType: 'wickets',
      winMargin: maxWickets - chasing.wickets,
      description: `Won by ${maxWickets - chasing.wickets} wicket${maxWickets - chasing.wickets !== 1 ? 's' : ''}`,
    };
  }

  if (chasing.totalRuns < target) {
    return {
      winner: 'batting_first',
      winType: 'runs',
      winMargin: target - 1 - chasing.totalRuns,
      description: `Won by ${target - 1 - chasing.totalRuns} run${target - 1 - chasing.totalRuns !== 1 ? 's' : ''}`,
    };
  }

  if (chasing.totalRuns === firstInnings.totalRuns) {
    return { winner: null, winType: 'tie', winMargin: 0, description: 'Match tied' };
  }

  return null;
}

module.exports = {
  computeInningsState,
  buildScorecard,
  validateBallInput,
  resolveStrikeAfterBall,
  computeMatchResult,
  isLegalDelivery,
  ballTotalRuns,
  overString,
  EXTRA_TYPES,
  WICKET_TYPES,
};
