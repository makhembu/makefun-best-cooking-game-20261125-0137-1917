// The kitchen's rules and state, with no drawing and no browser in it: the chef, the pantry
// bins, the chop/cook/plate/serve stations, the order board's clocks, score, combo, reputation
// and level. step() advances one fixed tick and returns what happened as bit flags, so the
// caller can react with sound and screens without the world knowing about either. interact()
// uses whichever station the chef is standing beside and returns the same kind of flags.
import {
  ALL_STATIONS,
  CHOP_SECONDS,
  COOK_SECONDS,
  FIELD,
  INGREDIENTS,
  LIVES,
  MAX_CARRY,
  MAX_PLATE,
  ORDERS_PER_LEVEL,
  PLAYER,
  distanceToStation,
} from './config.js';
import {
  CHOPPED,
  COOKED,
  RAW,
  makeOrder,
  pickRecipe,
  plateMatches,
  targetComplexityFor,
} from './recipes.js';

export const EVENT_SERVE = 1;
export const EVENT_EXPIRE = 2;
export const EVENT_OVER = 4;
export const EVENT_CHOP = 8;
export const EVENT_COOK = 16;
export const EVENT_PICK = 32;
export const EVENT_PLATE = 64;
export const EVENT_CANCEL = 128;

const ORDER_SLOTS = 3;
const RECENT_MEMORY = 4;
/** How close the chef's centre must be to a counter to use it. */
const INTERACT_RANGE = 42;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: 340,
    facing: { x: 0, y: 1 },
    carry: [],
    walking: false,
    stepPhase: 0,
  };
  const state = {
    player,
    orders: [],
    plate: [],
    prep: null,
    near: null,
    score: 0,
    level: 1,
    hearts: LIVES,
    combo: 0,
    served: 0,
    elapsed: 0,
    over: false,
    message: '',
    messageTime: 0,
    recent: [],
  };

  function setMessage(message) {
    state.message = message;
    state.messageTime = 2.6;
  }

  function nearestStation() {
    let best = null;
    let bestDistance = Infinity;
    for (const station of ALL_STATIONS) {
      const distance = distanceToStation(player.x, player.y, station);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = station;
      }
    }
    return bestDistance <= INTERACT_RANGE ? best : null;
  }

  function targetComplexity() {
    return targetComplexityFor(state.level);
  }

  function refillOrders() {
    while (!state.over && state.orders.length < ORDER_SLOTS) {
      const recipe = pickRecipe(
        { targetComplexity: targetComplexity(), recent: state.recent, level: state.level },
        random,
      );
      state.orders.push(makeOrder(recipe, state.level));
      state.recent.push(recipe.id);
      if (state.recent.length > RECENT_MEMORY) state.recent.shift();
    }
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = 340;
    player.facing = { x: 0, y: 1 };
    player.carry = [];
    player.walking = false;
    player.stepPhase = 0;
    state.orders = [];
    state.plate = [];
    state.prep = null;
    state.near = null;
    state.score = 0;
    state.level = 1;
    state.hearts = LIVES;
    state.combo = 0;
    state.served = 0;
    state.elapsed = 0;
    state.over = false;
    state.message = 'Grab ingredients and build the orders on the board.';
    state.messageTime = 3.4;
    state.recent = [];
    refillOrders();
  }

  function movement(direction, dt) {
    const length = Math.hypot(direction.x, direction.y);
    if (length > 0) {
      player.x += (direction.x / length) * PLAYER.speed * dt;
      player.y += (direction.y / length) * PLAYER.speed * dt;
      player.facing.x = direction.x;
      player.facing.y = direction.y;
      player.walking = true;
      player.stepPhase += dt * 10;
    } else {
      player.walking = false;
    }
    player.x = clamp(player.x, PLAYER.margin, FIELD.width - PLAYER.margin);
    player.y = clamp(player.y, 138, 648);
  }

  function advancePrep(dt) {
    if (state.prep === null) return 0;
    const near = nearestStation();
    const requiredStation = state.prep.kind === 'chop' ? 'board' : 'stove';
    if (near === null || near.kind !== requiredStation) {
      state.prep = null;
      setMessage('Prep cancelled — stay at the station.');
      return EVENT_CANCEL;
    }
    state.prep.progress += dt / state.prep.duration;
    if (state.prep.progress < 1) return 0;
    const item = player.carry[state.prep.handIndex];
    let events = 0;
    if (item !== undefined) {
      if (state.prep.kind === 'chop') {
        item.prep = CHOPPED;
        events |= EVENT_CHOP;
        setMessage(`Chopped the ${INGREDIENTS[item.ingredient].name.toLowerCase()}.`);
      } else {
        item.prep = COOKED;
        events |= EVENT_COOK;
        setMessage(`Cooked the ${INGREDIENTS[item.ingredient].name.toLowerCase()}.`);
      }
    }
    state.prep = null;
    return events;
  }

  function advanceOrders(dt) {
    let events = 0;
    for (let index = state.orders.length - 1; index >= 0; index -= 1) {
      const order = state.orders[index];
      order.timeLeft -= dt;
      if (order.timeLeft > 0) continue;
      state.orders.splice(index, 1);
      state.hearts -= 1;
      state.combo = 0;
      events |= EVENT_EXPIRE;
      setMessage(`Order lost: ${order.recipe.name}.`);
      if (state.hearts <= 0) {
        state.hearts = 0;
        state.over = true;
        events |= EVENT_OVER;
        return events;
      }
    }
    refillOrders();
    return events;
  }

  function step(dt, direction, harmless = false) {
    if (state.over) return 0;
    if (state.messageTime > 0) state.messageTime = Math.max(0, state.messageTime - dt);
    state.elapsed += dt;
    movement(direction, dt);
    state.near = nearestStation();
    if (harmless) return 0;
    let events = advancePrep(dt);
    events |= advanceOrders(dt);
    return events;
  }

  function startPrep(kind, duration) {
    const capability = kind === 'chop' ? 'chop' : 'cook';
    const index = player.carry.findIndex(
      (item) => item.prep === RAW && INGREDIENTS[item.ingredient][capability],
    );
    if (index < 0) {
      setMessage(kind === 'chop' ? 'Nothing here can be chopped.' : 'Nothing here can be cooked.');
      return 0;
    }
    state.prep = { kind, handIndex: index, progress: 0, duration };
    setMessage(kind === 'chop' ? 'Chopping…' : 'Cooking…');
    return 0;
  }

  function useBin(station) {
    if (player.carry.length >= MAX_CARRY) {
      setMessage(`Hands full — plate something first (${MAX_CARRY} max).`);
      return 0;
    }
    player.carry.push({ ingredient: station.ingredient, prep: RAW });
    setMessage(`Picked up ${INGREDIENTS[station.ingredient].name.toLowerCase()}.`);
    return EVENT_PICK;
  }

  function usePlate() {
    if (player.carry.length > 0) {
      const room = MAX_PLATE - state.plate.length;
      if (room <= 0) {
        setMessage('The plate is full — serve it or clear it.');
        return 0;
      }
      const moved = player.carry.splice(0, room);
      state.plate.push(...moved);
      setMessage(`Plated ${moved.length} ingredient${moved.length === 1 ? '' : 's'}.`);
      return EVENT_PLATE;
    }
    if (state.plate.length > 0) {
      state.plate.length = 0;
      setMessage('Plate cleared.');
      return EVENT_PLATE;
    }
    setMessage('The plate is empty.');
    return 0;
  }

  function serve() {
    if (state.plate.length === 0) {
      setMessage('Bring a plated dish to the window.');
      return 0;
    }
    let chosen = null;
    for (const order of state.orders) {
      if (plateMatches(state.plate, order.recipe) && (chosen === null || order.timeLeft < chosen.timeLeft)) {
        chosen = order;
      }
    }
    if (chosen === null) {
      setMessage('No order wants that plate. Clear it at the plate station.');
      return 0;
    }
    const fraction = clamp(chosen.timeLeft / chosen.totalTime, 0, 1);
    const tip = Math.round(chosen.reward * 0.6 * Math.max(0, fraction - 0.15));
    const multiplier = 1 + Math.min(5, state.combo) * 0.2;
    const gained = Math.round((chosen.reward + tip) * multiplier);
    state.score += gained;
    state.combo += 1;
    state.served += 1;
    state.plate.length = 0;
    state.orders.splice(state.orders.indexOf(chosen), 1);
    const nextLevel = 1 + Math.floor(state.served / ORDERS_PER_LEVEL);
    if (nextLevel !== state.level) {
      state.level = nextLevel;
      setMessage(`Level ${state.level}! The tickets come faster.`);
    } else {
      setMessage(`Served ${chosen.recipe.name} +${gained}${state.combo > 1 ? `  ·  combo ${state.combo}` : ''}`);
    }
    refillOrders();
    return EVENT_SERVE;
  }

  function interact() {
    if (state.over) return 0;
    const near = nearestStation();
    state.near = near;
    if (near === null) {
      setMessage('Stand beside a counter first.');
      return 0;
    }
    if (state.prep !== null) {
      setMessage('Finish the prep first.');
      return 0;
    }
    if (near.kind === 'bin') return useBin(near);
    if (near.kind === 'board') return startPrep('chop', CHOP_SECONDS);
    if (near.kind === 'stove') return startPrep('cook', COOK_SECONDS);
    if (near.kind === 'plate') return usePlate();
    if (near.kind === 'window') return serve();
    return 0;
  }

  reset();
  return { state, reset, step, interact };
}
