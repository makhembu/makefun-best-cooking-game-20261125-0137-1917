// Boot and the one loop: input is read every frame, the kitchen advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the order draw. ?shot=kitchen|prep|rush|start (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CHOP,
  EVENT_COOK,
  EVENT_EXPIRE,
  EVENT_OVER,
  EVENT_PICK,
  EVENT_PLATE,
  EVENT_SERVE,
  createWorld,
} from './world.js';
import { ACTION_PAUSE, ACTION_PRIMARY, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const STILL = { x: 0, y: 0 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and the rush.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.start();
    announce(`Playing. ${LIVES} hearts. Read the order board.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.over();
    announce(`Service over. Score ${world.state.score}. Best ${best}.`);
  }

  function react(events) {
    if (events & EVENT_PICK) audio.pick();
    if (events & EVENT_CHOP) audio.chop();
    if (events & EVENT_COOK) audio.cook();
    if (events & EVENT_PLATE) audio.plate();
    if (events & EVENT_SERVE) audio.serve();
    if (events & EVENT_EXPIRE) audio.miss();
    if (events & EVENT_OVER) {
      endGame();
      return;
    }
    if (events & (EVENT_SERVE | EVENT_EXPIRE)) announce(world.state.message);
  }

  function handleActions() {
    const actions = input.takeActions();
    let events = 0;
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_PRIMARY && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PRIMARY && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_PRIMARY && screen === SCREEN_PLAY) {
      events |= world.interact();
    }
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let events = handleActions();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, STILL, true);
    } else if (screen === SCREEN_PLAY) {
      const direction = input.direction();
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        events |= world.step(STEP, direction, false);
        accumulator -= STEP;
        if (events & EVENT_OVER) break;
      }
    } else {
      accumulator = 0;
    }
    react(events);
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting tickets burn unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Skillet Rush. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
