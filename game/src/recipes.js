// The recipe catalogue and the order-selection algorithm. An order is a recipe plus a clock.
// The selector does not draw uniformly: it builds the feasible candidates, scores each one on
// how well its complexity fits the current rush, how recently it was ordered and how its
// payout-per-second compares with the target pressure, then draws from the best few with a
// decaying weight. That keeps the board varied, gates harder dishes behind levels, and makes
// the pressure ramp without ever handing out an impossible order.

export const RAW = 'raw';
export const CHOPPED = 'chopped';
export const COOKED = 'cooked';

/** Every dish the kitchen can make. `items` is the exact multiset a finished plate must hold. */
export const RECIPES = [
  {
    id: 'salad',
    name: 'Garden Salad',
    reward: 16,
    baseTime: 28,
    complexity: 1,
    items: [
      { ingredient: 'tomato', prep: CHOPPED },
      { ingredient: 'lettuce', prep: CHOPPED },
    ],
  },
  {
    id: 'caprese',
    name: 'Caprese Plate',
    reward: 18,
    baseTime: 26,
    complexity: 1,
    items: [
      { ingredient: 'tomato', prep: CHOPPED },
      { ingredient: 'cheese', prep: RAW },
    ],
  },
  {
    id: 'toast',
    name: 'Cheese Toast',
    reward: 22,
    baseTime: 26,
    complexity: 2,
    items: [
      { ingredient: 'dough', prep: COOKED },
      { ingredient: 'cheese', prep: RAW },
    ],
  },
  {
    id: 'omelette',
    name: 'Veggie Omelette',
    reward: 28,
    baseTime: 32,
    complexity: 2,
    items: [
      { ingredient: 'egg', prep: COOKED },
      { ingredient: 'cheese', prep: RAW },
      { ingredient: 'mushroom', prep: CHOPPED },
    ],
  },
  {
    id: 'wrap',
    name: 'Garden Wrap',
    reward: 30,
    baseTime: 34,
    complexity: 3,
    items: [
      { ingredient: 'dough', prep: COOKED },
      { ingredient: 'lettuce', prep: CHOPPED },
      { ingredient: 'tomato', prep: CHOPPED },
    ],
  },
  {
    id: 'pizza',
    name: 'Forest Pizza',
    reward: 34,
    baseTime: 36,
    complexity: 3,
    items: [
      { ingredient: 'dough', prep: COOKED },
      { ingredient: 'tomato', prep: CHOPPED },
      { ingredient: 'cheese', prep: RAW },
      { ingredient: 'mushroom', prep: CHOPPED },
    ],
  },
  {
    id: 'stuffed',
    name: 'Stuffed Mushroom',
    reward: 30,
    baseTime: 32,
    complexity: 3,
    items: [
      { ingredient: 'mushroom', prep: CHOPPED },
      { ingredient: 'cheese', prep: RAW },
      { ingredient: 'egg', prep: COOKED },
    ],
  },
];

export const RECIPE_BY_ID = new Map(RECIPES.map((recipe) => [recipe.id, recipe]));

/** A stable key for one prepared ingredient, used to compare a plate with a recipe. */
export function itemKey(item) {
  return `${item.ingredient}|${item.prep}`;
}

/** Whether a plate holds exactly the multiset a recipe asks for, nothing more or less. */
export function plateMatches(plate, recipe) {
  if (plate.length !== recipe.items.length) return false;
  const needed = new Map();
  for (const item of recipe.items) {
    const key = itemKey(item);
    needed.set(key, (needed.get(key) ?? 0) + 1);
  }
  for (const item of plate) {
    const left = needed.get(itemKey(item));
    if (!left) return false;
    needed.set(itemKey(item), left - 1);
  }
  return true;
}

/**
 * One order: the recipe, its clock and what it pays at the current level. `timeLeft` may be
 * given to stage a screenshot or to seed a mid-rush order.
 */
export function makeOrder(recipe, level, timeLeft) {
  const totalTime = Math.max(13, recipe.baseTime - (level - 1) * 2);
  return {
    recipe,
    level,
    totalTime,
    timeLeft: timeLeft ?? totalTime,
    reward: recipe.reward + (level - 1) * 2,
  };
}

/**
 * Choose the next order's recipe. `context` carries the level's target complexity, the recent
 * order ids and the level itself. The candidate ceiling rises with the target, so a level 1
 * kitchen never opens with the four-ingredient pizza, while the freshness penalty keeps the
 * board from repeating one dish three times.
 */
export function pickRecipe(context, random) {
  const target = context.targetComplexity ?? 1;
  const recent = context.recent ?? [];
  const level = context.level ?? 1;
  const ceiling = Math.min(3, target + 1);
  const candidates = RECIPES.filter((recipe) => recipe.complexity <= ceiling);
  const targetRate = 0.55 + level * 0.02;

  const scored = candidates.map((recipe) => {
    const fit = 3 - Math.abs(recipe.complexity - target);
    const freshness = recent.includes(recipe.id) ? -2.4 : 0.7;
    const rate = recipe.reward / recipe.baseTime;
    const pressure = Math.max(0, 1 - Math.abs(rate - targetRate) / 0.5);
    const jitter = random() * 0.8;
    return { recipe, score: fit * 1.6 + freshness + pressure * 2 + jitter };
  });
  scored.sort((a, b) => b.score - a.score);

  const shortlist = scored.slice(0, Math.min(3, scored.length));
  const weights = shortlist.map((_, index) => 0.62 ** index);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < shortlist.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return shortlist[index].recipe;
  }
  return shortlist[0].recipe;
}

/** The complexity the kitchen aims for at a level. */
export function targetComplexityFor(level) {
  return Math.min(3, 1 + Math.floor(level / 2));
}
