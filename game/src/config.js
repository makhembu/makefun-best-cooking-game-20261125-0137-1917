// Every tuning number, station rectangle and palette colour in one place. The playfield is a
// fixed 1280x720 logical kitchen; the renderer scales it to the window, so no rule depends on
// the screen size. Stations are top-down counters the chef walks up to and uses with Space.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  speed: 340,
  radius: 24,
  margin: 34,
};

/** How many ingredients the chef can hold at once. */
export const MAX_CARRY = 4;
/** How many ingredients one plate accepts. */
export const MAX_PLATE = 8;

export const LIVES = 3;
/** Orders served per level: the rush gets faster and the recipes deeper as the level climbs. */
export const ORDERS_PER_LEVEL = 4;

/** The six pantry ingredients: what they are called, their colour and what the kitchen can do to them. */
export const INGREDIENTS = {
  tomato: { name: 'Tomato', color: '#d94b42', chop: true, cook: false },
  lettuce: { name: 'Lettuce', color: '#58b96a', chop: true, cook: false },
  mushroom: { name: 'Mushroom', color: '#c39a6b', chop: true, cook: false },
  cheese: { name: 'Cheese', color: '#f2c14e', chop: false, cook: false },
  dough: { name: 'Dough', color: '#e0b884', chop: false, cook: true },
  egg: { name: 'Egg', color: '#f7f1df', chop: false, cook: true },
};

/** The pantry bins, in the order they sit along the top counter. */
export const INGREDIENT_ORDER = ['tomato', 'lettuce', 'mushroom', 'cheese', 'dough', 'egg'];

/** Prep times in seconds. */
export const CHOP_SECONDS = 0.85;
export const COOK_SECONDS = 1.15;

/** The pantry bins: wide low counters under the order board. */
export const BINS = INGREDIENT_ORDER.map((ingredient, index) => ({
  kind: 'bin',
  ingredient,
  x: 140 + index * 170,
  y: 146,
  w: 150,
  h: 88,
}));

/** The four work stations: chop, cook, plate and serve. */
export const STATIONS = [
  { kind: 'board', x: 70, y: 466, w: 240, h: 168, label: 'Cutting Board' },
  { kind: 'stove', x: 350, y: 466, w: 240, h: 168, label: 'Stove' },
  { kind: 'plate', x: 630, y: 466, w: 240, h: 168, label: 'Plate' },
  { kind: 'window', x: 910, y: 466, w: 240, h: 168, label: 'Serving Window' },
];

/** Every station the chef can use, bins first. */
export const ALL_STATIONS = [...BINS, ...STATIONS];

export const PALETTE = {
  backdrop: '#1a120c',
  wall: '#3a261c',
  wallTrim: '#5b3a27',
  floorA: '#efd9b8',
  floorB: '#e3c59d',
  floorLine: '#d2ad82',
  counter: '#5a3822',
  counterTop: '#c98a52',
  counterEdge: '#8f5a32',
  board: '#d9a869',
  boardEdge: '#a9773d',
  stove: '#2b2f38',
  burner: '#565e6d',
  flame: '#ff8a3d',
  plate: '#fbf3e4',
  plateRim: '#d9c9ae',
  panel: '#2c1d16',
  panelEdge: '#6b4127',
  card: '#fff4e0',
  cardEdge: '#e0c9a8',
  text: '#fff6e8',
  ink: '#3b2417',
  muted: '#b9a48e',
  accent: '#ffb35c',
  good: '#6fcf87',
  warn: '#f2c14e',
  bad: '#e5534b',
  chef: '#2f8f83',
  chefDark: '#237066',
  skin: '#f0c49c',
  hat: '#fffaf0',
  shadow: 'rgba(30, 18, 10, 0.28)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skillet-rush.best';

/** A distance from point to a station rectangle, 0 when the point is inside it. */
export function distanceToStation(px, py, station) {
  const dx = Math.max(station.x - px, 0, px - (station.x + station.w));
  const dy = Math.max(station.y - py, 0, py - (station.y + station.h));
  return Math.hypot(dx, dy);
}
