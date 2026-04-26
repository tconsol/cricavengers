// Cricket commentary generator

export const SHOT_REGIONS: Record<string, { label: string; direction: string }> = {
  fine_leg:    { label: 'Fine Leg',    direction: 'behind square on the leg side' },
  square_leg:  { label: 'Square Leg', direction: 'square on the leg side' },
  mid_wicket:  { label: 'Mid Wicket', direction: 'through mid-wicket' },
  mid_on:      { label: 'Mid On',     direction: 'down the ground on the on side' },
  long_on:     { label: 'Long On',    direction: 'over long-on' },
  straight:    { label: 'Straight',   direction: 'straight down the ground' },
  long_off:    { label: 'Long Off',   direction: 'over long-off' },
  mid_off:     { label: 'Mid Off',    direction: 'through mid-off' },
  cover:       { label: 'Cover',      direction: 'through the covers' },
  point:       { label: 'Point',      direction: 'past point' },
  third_man:   { label: 'Third Man',  direction: 'behind square on the off side' },
  gully:       { label: 'Gully',      direction: 'past gully' },
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const region = (shotRegion?: string | null): string =>
  shotRegion ? SHOT_REGIONS[shotRegion]?.direction || '' : '';

// ─── Six commentary ────────────────────────────────────────────
const sixLines = (bat: string, bowl: string, r: string) => [
  `SIX! ${bat} sends ${bowl} sailing ${r}! What a colossal hit!`,
  `${bat} launches ${bowl} into the stands ${r}! MAXIMUM!`,
  `Unbelievable! ${bat} clears the rope with ease ${r}! Six more!`,
  `${bowl} gets hammered ${r} by ${bat}! That's gone into orbit!`,
  `${bat} has muscles! Deposits ${bowl} ${r} for a huge SIX!`,
];

// ─── Four commentary ───────────────────────────────────────────
const fourLines = (bat: string, bowl: string, r: string) => [
  `FOUR! ${bat} times it beautifully ${r}!`,
  `${bat} drives ${bowl} ${r} and it races away for four!`,
  `No stopping that! ${bat} finds the gap ${r} for a boundary!`,
  `${bat} cuts ${bowl} ${r} — races through for FOUR!`,
  `Pure timing from ${bat}! Creams it ${r} for a boundary!`,
];

// ─── Dot ball commentary ───────────────────────────────────────
const dotLines = (bat: string, bowl: string) => [
  `${bowl} bowls a tight one, defended back by ${bat}.`,
  `Good length delivery, ${bat} plays it straight back to ${bowl}.`,
  `Dot ball. ${bowl} beats ${bat} in the flight — no run.`,
  `${bat} has a look at it but lets it go. Good bowling!`,
  `Tight over developing — ${bowl} keeps it quiet.`,
];

// ─── Single/Double/Triple commentary ──────────────────────────
const runLines = (bat: string, bowl: string, runs: number, r: string) => [
  `${bat} pushes ${bowl} ${r} and they run ${runs}.`,
  `Clipped off the pads by ${bat}, ${runs} taken ${r}.`,
  `${bat} works it ${r} for ${runs} run${runs > 1 ? 's' : ''}.`,
  `${runs} more. ${bat} nudges it ${r}.`,
];

// ─── Wicket commentary ─────────────────────────────────────────
const wicketLines: Record<string, (bat: string, bowl: string, r: string) => string[]> = {
  bowled: (bat, bowl) => [
    `BOWLED! ${bowl} smashes through ${bat}'s defence! The stumps are shattered!`,
    `${bat} is bowled middle stump! ${bowl} is on fire!`,
    `Clean bowled! ${bowl} finds the gap between bat and pad of ${bat}!`,
  ],
  caught: (bat, bowl, r) => [
    `CAUGHT! ${bat} holes out ${r}! ${bowl} gets the breakthrough!`,
    `${bat} skied it ${r} and it's taken cleanly! ${bowl} strikes!`,
    `A big one! ${bat} top-edges ${bowl} ${r} and it's gobbled up!`,
  ],
  caught_and_bowled: (bat, bowl) => [
    `Caught and bowled! ${bowl} takes a stunning return catch off ${bat}!`,
    `${bowl} to ${bat} — C&B! Lightning reflexes from the bowler!`,
  ],
  lbw: (bat, bowl) => [
    `LBW! ${bat} misses the sweep and is hit flush in front! ${bowl} appeals and umpire raises the finger!`,
    `Out LBW! ${bowl} traps ${bat} right in front of middle stump!`,
    `Plumb in front! ${bat} has no case for a review — ${bowl} gets the wicket!`,
  ],
  run_out: (bat) => [
    `RUN OUT! ${bat} was well short and they didn't bother with the review!`,
    `Brilliant work in the field! ${bat} is run out by yards!`,
    `Oh no — ${bat} is run out! A terrible mix-up between the batters!`,
  ],
  stumped: (bat, bowl) => [
    `STUMPED! ${bat} ventures down the pitch, misses the flighted delivery from ${bowl}, and is well out of the crease!`,
    `${bat} is stumped! Quick work by the keeper off ${bowl}'s delivery!`,
  ],
  hit_wicket: (bat, bowl) => [
    `HIT WICKET! ${bat} loses balance and dislodges the bails — bizarre dismissal off ${bowl}!`,
  ],
  default: (bat, bowl) => [
    `OUT! ${bowl} gets ${bat}!`,
  ],
};

// ─── Extra commentary ──────────────────────────────────────────
const extraLines: Record<string, (bowl: string, extraRuns: number) => string> = {
  wide:    (bowl, runs) => `${bowl} strays ${runs > 1 ? `wide with ${runs - 1} extra runs` : 'wide'}. Umpire signals wide.`,
  no_ball: (bowl)       => `No ball! Free hit coming up! ${bowl} oversteps.`,
  bye:     (_, runs)    => `${runs} bye${runs > 1 ? 's' : ''} — keeper couldn't gather!`,
  leg_bye: (_, runs)    => `${runs} leg bye${runs > 1 ? 's' : ''} — deflects off the pad.`,
};

// ─── Main generator ────────────────────────────────────────────

export function generateCommentary(ball: {
  runs: number;
  extras?: { type?: string; runs?: number } | null;
  wicket?: { type?: string } | null;
  shotRegion?: string | null;
}, batsmanName: string, bowlerName: string): string {
  const bat  = batsmanName || 'Batsman';
  const bowl = bowlerName  || 'Bowler';
  const r    = region(ball.shotRegion);
  const et   = ball.extras?.type;
  const extraRuns = (ball.extras?.runs || 0);

  // Wicket
  if (ball.wicket?.type) {
    const type = ball.wicket.type;
    const lines = wicketLines[type] || wicketLines.default;
    return pick(lines(bat, bowl, r));
  }

  // Extras (no wicket)
  if (et && extraLines[et]) {
    return extraLines[et](bowl, extraRuns);
  }

  // Normal runs
  const runs = ball.runs ?? 0;
  if (runs === 6) return pick(sixLines(bat, bowl, r));
  if (runs === 4) return pick(fourLines(bat, bowl, r));
  if (runs === 0) return pick(dotLines(bat, bowl));
  return pick(runLines(bat, bowl, runs, r));
}
