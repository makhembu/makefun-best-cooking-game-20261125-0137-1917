// The screenshot scenes behind ?shot=kitchen|prep|rush|start. Each one is staged from the real
// world state and drawn by the real renderer: the same order cards, clocks, stations, plate and
// chef the player sees. The seed stays fixed in shots.json, so every capture is repeatable.
import { STATIONS } from './config.js';
import { RECIPE_BY_ID, makeOrder } from './recipes.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function order(id, level, timeLeft) {
  return makeOrder(RECIPE_BY_ID.get(id), level, timeLeft);
}

function place(state, x, y, carry, near, prep) {
  state.player.x = x;
  state.player.y = y;
  state.player.carry = carry.map(([ingredient, prepState]) => ({ ingredient, prep: prepState }));
  state.player.walking = false;
  state.player.stepPhase = 0;
  state.near = near ?? null;
  state.prep = prep ?? null;
}

function say(state, message, seconds) {
  state.message = message;
  state.messageTime = seconds;
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const board = STATIONS[0];
  const stove = STATIONS[1];
  const window = STATIONS[3];

  if (name === 'prep') {
    state.score = 980;
    state.level = 3;
    state.hearts = 3;
    state.combo = 1;
    state.served = 8;
    state.orders = [order('pizza', 3, 26), order('omelette', 3, 18), order('wrap', 3, 24)];
    state.plate = [
      { ingredient: 'dough', prep: 'cooked' },
      { ingredient: 'cheese', prep: 'raw' },
    ];
    place(state, 190, 435, [['tomato', 'raw'], ['mushroom', 'raw']], board, {
      kind: 'chop',
      handIndex: 0,
      progress: 0.62,
      duration: 0.85,
    });
    say(state, 'Chop the tomato before the pizza ticket burns.', 10);
    return { screen: SCREEN_PLAY, best: 980 };
  }

  if (name === 'rush') {
    state.score = 2260;
    state.level = 6;
    state.hearts = 2;
    state.combo = 5;
    state.served = 22;
    state.orders = [order('pizza', 6, 7), order('stuffed', 6, 5), order('omelette', 6, 12)];
    state.plate = [
      { ingredient: 'dough', prep: 'cooked' },
      { ingredient: 'tomato', prep: 'chopped' },
      { ingredient: 'cheese', prep: 'raw' },
      { ingredient: 'mushroom', prep: 'chopped' },
    ];
    place(state, 470, 435, [['egg', 'raw'], ['cheese', 'raw']], stove, {
      kind: 'cook',
      handIndex: 0,
      progress: 0.48,
      duration: 1.15,
    });
    say(state, 'Rush hour! Two tickets are nearly out of time.', 10);
    return { screen: SCREEN_PLAY, best: 2260 };
  }

  if (name === 'start') {
    state.score = 0;
    state.player.x = 640;
    state.player.y = 320;
    state.player.carry = [];
    state.near = null;
    return { screen: SCREEN_TITLE, best: 0 };
  }

  // The cover kitchen scene: a finished wrap on the plate, three live tickets, the chef at the pass.
  state.score = 1480;
  state.level = 4;
  state.hearts = 3;
  state.combo = 3;
  state.served = 13;
  state.orders = [order('pizza', 4, 24), order('wrap', 4, 19), order('omelette', 4, 27)];
  state.plate = [
    { ingredient: 'dough', prep: 'cooked' },
    { ingredient: 'lettuce', prep: 'chopped' },
    { ingredient: 'tomato', prep: 'chopped' },
  ];
  place(state, 640, 340, [['mushroom', 'chopped'], ['cheese', 'raw']], null, null);
  say(state, 'Wrap is plated — ring the bell to serve!', 10);
  return { screen: SCREEN_PLAY, best: 1480 };
}
