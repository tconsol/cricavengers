const {
  computeInningsState,
  buildScorecard,
  validateBallInput,
  isLegalDelivery,
  ballTotalRuns,
  overString,
  EXTRA_TYPES,
} = require('../scoring-engine');

// Helper to make a ball object
const makeBall = (over, ball, runs, extras = null, wicket = null, isDeleted = false) => ({
  over, ball, runs, extras, wicket, isDeleted,
  batsman: 'batsman1', bowler: 'bowler1',
  strikerAfter: 'batsman1', nonStrikerAfter: 'batsman2',
});

// ----------------------------------------------------------------
describe('isLegalDelivery', () => {
  test('normal ball is legal', () => {
    expect(isLegalDelivery({ extras: { type: null } })).toBe(true);
  });

  test('wide is not legal', () => {
    expect(isLegalDelivery({ extras: { type: 'wide' } })).toBe(false);
  });

  test('no_ball is not legal', () => {
    expect(isLegalDelivery({ extras: { type: 'no_ball' } })).toBe(false);
  });

  test('bye is legal', () => {
    expect(isLegalDelivery({ extras: { type: 'bye' } })).toBe(true);
  });
});

// ----------------------------------------------------------------
describe('ballTotalRuns', () => {
  test('normal 4 runs', () => {
    expect(ballTotalRuns({ runs: 4, extras: null })).toBe(4);
  });

  test('wide + 1 = 1 extra run', () => {
    expect(ballTotalRuns({ runs: 0, extras: { type: 'wide', runs: 1 } })).toBe(1);
  });

  test('no-ball + 2 runs off bat', () => {
    expect(ballTotalRuns({ runs: 2, extras: { type: 'no_ball', runs: 1 } })).toBe(3);
  });
});

// ----------------------------------------------------------------
describe('validateBallInput', () => {
  test('valid ball passes', () => {
    const errors = validateBallInput({ runs: 4, batsman: 'b1', bowler: 'bw1' });
    expect(errors).toHaveLength(0);
  });

  test('missing runs fails', () => {
    const errors = validateBallInput({ batsman: 'b1', bowler: 'bw1' });
    expect(errors.some((e) => e.includes('runs'))).toBe(true);
  });

  test('runs > 6 fails', () => {
    const errors = validateBallInput({ runs: 7, batsman: 'b1', bowler: 'bw1' });
    expect(errors.some((e) => e.includes('runs'))).toBe(true);
  });

  test('missing batsman fails', () => {
    const errors = validateBallInput({ runs: 1, bowler: 'bw1' });
    expect(errors.some((e) => e.includes('batsman'))).toBe(true);
  });

  test('invalid extra type fails', () => {
    const errors = validateBallInput({
      runs: 0, batsman: 'b1', bowler: 'bw1',
      extras: { type: 'invalid_extra', runs: 1 },
    });
    expect(errors.some((e) => e.includes('extra'))).toBe(true);
  });

  test('invalid wicket type fails', () => {
    const errors = validateBallInput({
      runs: 0, batsman: 'b1', bowler: 'bw1',
      wicket: { type: 'caught_on_moon', batsmanOut: 'b1' },
    });
    expect(errors.some((e) => e.includes('wicket'))).toBe(true);
  });
});

// ----------------------------------------------------------------
describe('computeInningsState', () => {
  test('empty innings = zero score', () => {
    const state = computeInningsState([], 20);
    expect(state.totalRuns).toBe(0);
    expect(state.wickets).toBe(0);
    expect(state.legalBalls).toBe(0);
  });

  test('6 legal balls = 1 over', () => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      makeBall(0, i + 1, 1)
    );
    const state = computeInningsState(balls, 20);
    expect(state.legalBalls).toBe(6);
    expect(state.over).toBe(1);
    expect(state.ball).toBe(0);
    expect(state.totalRuns).toBe(6);
  });

  test('wide does not count as legal ball', () => {
    const balls = [
      makeBall(0, 1, 0, { type: 'wide', runs: 1 }),
      makeBall(0, 1, 4),
    ];
    const state = computeInningsState(balls, 20);
    expect(state.legalBalls).toBe(1);
    expect(state.totalRuns).toBe(5);
    expect(state.extras.wides).toBe(1);
  });

  test('wicket increments wicket count', () => {
    const balls = [
      makeBall(0, 1, 0, null, { type: 'bowled', batsmanOut: 'batsman1' }),
    ];
    const state = computeInningsState(balls, 20);
    expect(state.wickets).toBe(1);
    expect(state.fallOfWickets).toHaveLength(1);
  });

  test('10 wickets triggers all_out completion', () => {
    const balls = Array.from({ length: 10 }, (_, i) =>
      makeBall(0, i + 1, 0, null, { type: 'bowled', batsmanOut: 'batsman1' })
    );
    const state = computeInningsState(balls, 20);
    expect(state.isCompleted).toBe(true);
    expect(state.completionReason).toBe('all_out');
  });

  test('over limit triggers completion', () => {
    // 2 overs (12 balls)
    const balls = Array.from({ length: 12 }, (_, i) =>
      makeBall(Math.floor(i / 6), (i % 6) + 1, 0)
    );
    const state = computeInningsState(balls, 2);
    expect(state.isCompleted).toBe(true);
    expect(state.completionReason).toBe('overs_complete');
  });

  test('deleted balls are ignored', () => {
    const balls = [
      makeBall(0, 1, 6),
      { ...makeBall(0, 2, 6), isDeleted: true },
    ];
    const state = computeInningsState(balls, 20);
    expect(state.totalRuns).toBe(6); // only 1 ball counts
  });

  test('batting stats are computed correctly', () => {
    const balls = [
      { ...makeBall(0, 1, 4), batsman: 'p1' },
      { ...makeBall(0, 2, 6), batsman: 'p1' },
      { ...makeBall(0, 3, 2), batsman: 'p2' },
    ];
    const state = computeInningsState(balls, 20);
    expect(state.batting['p1'].runs).toBe(10);
    expect(state.batting['p1'].fours).toBe(1);
    expect(state.batting['p1'].sixes).toBe(1);
    expect(state.batting['p2'].runs).toBe(2);
  });

  test('bowling wickets not counted for run-out', () => {
    const balls = [
      {
        ...makeBall(0, 1, 0, null, { type: 'run_out', batsmanOut: 'batsman1' }),
        bowler: 'bw1',
      },
    ];
    const state = computeInningsState(balls, 20);
    expect(state.bowling['bw1']?.wickets || 0).toBe(0);
  });
});

// ----------------------------------------------------------------
describe('overString', () => {
  test('0 balls = 0.0', () => expect(overString(0)).toBe('0.0'));
  test('6 balls = 1.0', () => expect(overString(6)).toBe('1.0'));
  test('7 balls = 1.1', () => expect(overString(7)).toBe('1.1'));
  test('13 balls = 2.1', () => expect(overString(13)).toBe('2.1'));
});
