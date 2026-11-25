// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 logical
// kitchen is scaled to fit the window and centred, the margin filled with the backdrop colour.
// Food, counters, the chef and the order board are canvas paths and text, so the game loads no
// images or fonts. Text that holds a number is rebuilt only when the number changes.
import {
  BINS,
  FIELD,
  FONT,
  INGREDIENTS,
  LIVES,
  PALETTE,
  STATIONS,
} from './config.js';
import { CHOPPED, COOKED, RAW } from './recipes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CARD = { width: 400, height: 100, gap: 16, top: 16, left: 24 };

function roundRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function drawSteam(context, cx, cy, size, time) {
  context.save();
  context.strokeStyle = 'rgba(255, 248, 232, 0.55)';
  context.lineWidth = Math.max(2, size * 0.09);
  context.lineCap = 'round';
  for (let wisp = 0; wisp < 3; wisp += 1) {
    const phase = time * 2.4 + wisp * 1.7;
    const rise = (phase % 2.4) / 2.4;
    const x = cx + (wisp - 1) * size * 0.22 + Math.sin(phase * 2) * size * 0.08;
    const y = cy - rise * size * 0.7;
    context.globalAlpha = 0.6 * (1 - rise);
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + size * 0.12, y - size * 0.2, x, y - size * 0.38);
    context.stroke();
  }
  context.restore();
}

/** One pantry ingredient at (cx, cy), `size` pixels tall, drawn for its raw/chopped/cooked state. */
function drawIngredient(context, id, cx, cy, size, prep, time) {
  const s = size;
  context.save();
  context.translate(cx, cy);
  if (id === 'tomato') {
    if (prep === CHOPPED) {
      context.fillStyle = '#c9403a';
      for (const [dx, dy] of [[-0.22, -0.18], [0.2, -0.22], [0.02, 0.16], [-0.12, 0.3]]) {
        roundRect(context, dx * s - s * 0.13, dy * s - s * 0.13, s * 0.26, s * 0.26, s * 0.05);
        context.fill();
      }
      context.fillStyle = '#ff8a7d';
      context.fillRect(-s * 0.3, -s * 0.24, s * 0.08, s * 0.08);
    } else {
      context.fillStyle = '#d94b42';
      context.beginPath();
      context.arc(0, s * 0.04, s * 0.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ff8a7d';
      context.beginPath();
      context.arc(-s * 0.12, -s * 0.1, s * 0.12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4caf50';
      for (const angle of [-0.6, 0, 0.6]) {
        context.beginPath();
        context.ellipse(Math.sin(angle) * s * 0.18, -s * 0.34, s * 0.13, s * 0.07, angle, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (id === 'lettuce') {
    if (prep === CHOPPED) {
      context.strokeStyle = '#6fcf87';
      context.lineWidth = Math.max(2, s * 0.11);
      context.lineCap = 'round';
      for (const [dx, dy, tilt] of [[-0.2, -0.2, -0.4], [0.14, -0.24, 0.5], [0.02, 0.14, 0.1], [0.24, 0.24, -0.3]]) {
        context.beginPath();
        context.moveTo(dx * s - s * 0.12, dy * s);
        context.quadraticCurveTo(dx * s, dy * s + tilt * s * 0.3, dx * s + s * 0.16, dy * s - s * 0.05);
        context.stroke();
      }
    } else {
      context.fillStyle = '#58b96a';
      for (let leaf = 0; leaf < 5; leaf += 1) {
        const angle = (leaf / 5) * Math.PI * 2;
        context.beginPath();
        context.ellipse(Math.cos(angle) * s * 0.2, Math.sin(angle) * s * 0.18, s * 0.19, s * 0.13, angle, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#8ede9a';
      context.beginPath();
      context.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === 'mushroom') {
    if (prep === CHOPPED) {
      context.fillStyle = '#b98a58';
      for (const [dx, dy] of [[-0.2, -0.16], [0.18, -0.2], [0, 0.16], [-0.1, 0.3]]) {
        roundRect(context, dx * s - s * 0.12, dy * s - s * 0.1, s * 0.24, s * 0.2, s * 0.05);
        context.fill();
      }
      context.fillStyle = '#f0dfc4';
      context.fillRect(-s * 0.26, -s * 0.24, s * 0.09, s * 0.08);
    } else {
      context.fillStyle = '#f0dfc4';
      roundRect(context, -s * 0.13, -s * 0.02, s * 0.26, s * 0.38, s * 0.08);
      context.fill();
      context.fillStyle = '#b98a58';
      context.beginPath();
      context.ellipse(0, -s * 0.06, s * 0.4, s * 0.28, 0, Math.PI, Math.PI * 2);
      context.fill();
      context.fillStyle = '#d8b98f';
      context.beginPath();
      context.ellipse(-s * 0.12, -s * 0.16, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === 'cheese') {
    context.fillStyle = '#f2c14e';
    context.beginPath();
    context.moveTo(-s * 0.4, s * 0.28);
    context.lineTo(s * 0.42, s * 0.28);
    context.lineTo(s * 0.42, -s * 0.16);
    context.lineTo(-s * 0.4, s * 0.02);
    context.closePath();
    context.fill();
    context.fillStyle = '#d9a635';
    for (const [dx, dy, r] of [[-0.16, 0.08, 0.07], [0.12, 0.13, 0.05], [0.22, -0.02, 0.04]]) {
      context.beginPath();
      context.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === 'dough') {
    context.fillStyle = prep === COOKED ? '#d9a25c' : '#e6c79c';
    context.beginPath();
    context.ellipse(0, s * 0.04, s * 0.42, s * 0.32, 0, 0, Math.PI * 2);
    context.fill();
    if (prep === COOKED) {
      context.strokeStyle = '#a86d32';
      context.lineWidth = Math.max(2, s * 0.08);
      for (const dx of [-0.18, 0, 0.18]) {
        context.beginPath();
        context.moveTo(dx * s, -s * 0.16);
        context.lineTo(dx * s, s * 0.22);
        context.stroke();
      }
    } else {
      context.fillStyle = '#f3e2c6';
      context.beginPath();
      context.ellipse(-s * 0.1, -s * 0.04, s * 0.14, s * 0.09, 0, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === 'egg') {
    context.fillStyle = prep === COOKED ? '#fff8e8' : '#f7f1df';
    context.beginPath();
    context.ellipse(0, s * 0.04, s * 0.4, s * 0.31, 0, 0, Math.PI * 2);
    context.fill();
    if (prep === COOKED) {
      context.strokeStyle = '#e0b05a';
      context.lineWidth = Math.max(2, s * 0.07);
      context.stroke();
    }
    context.fillStyle = '#f2b93b';
    context.beginPath();
    context.arc(0, s * 0.02, s * 0.16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd86e';
    context.beginPath();
    context.arc(-s * 0.04, -s * 0.02, s * 0.06, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  if (prep === COOKED) drawSteam(context, cx, cy - size * 0.42, size, time);
}

function drawHeart(context, x, y, size, filled) {
  context.save();
  context.translate(x, y);
  context.beginPath();
  context.moveTo(0, size * 0.35);
  context.bezierCurveTo(-size * 0.9, -size * 0.2, -size * 0.45, -size * 0.85, 0, -size * 0.35);
  context.bezierCurveTo(size * 0.45, -size * 0.85, size * 0.9, -size * 0.2, 0, size * 0.35);
  context.closePath();
  context.fillStyle = filled ? PALETTE.bad : 'rgba(255, 255, 255, 0.14)';
  context.fill();
  context.restore();
}

/** A short verb for the station under the chef's nose, for the prompt pill. */
function verbFor(kind) {
  if (kind === 'bin') return 'grab';
  if (kind === 'board') return 'chop';
  if (kind === 'stove') return 'cook';
  if (kind === 'plate') return 'plate / clear';
  return 'serve';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('Level ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const servedLabel = cachedLabel('Orders served ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = 'bold') {
    const key = `${weight} ${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floorA;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const tile = 64;
    context.fillStyle = PALETTE.floorB;
    for (let row = 0; row * tile < FIELD.height; row += 1) {
      for (let col = 0; col < FIELD.width / tile; col += 1) {
        if ((row + col) % 2 === 0) continue;
        context.fillRect(col * tile, row * tile, tile, tile);
      }
    }
    // A woven runner down the middle of the kitchen softens the tiled floor.
    context.fillStyle = 'rgba(150, 72, 47, 0.22)';
    roundRect(context, 470, 250, 340, 190, 22);
    context.fill();
    context.strokeStyle = 'rgba(255, 196, 120, 0.28)';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 128);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 124, FIELD.width, 6);
  }

  function drawBin(bin, state, isNear, time) {
    const { x, y, w, h } = bin;
    context.fillStyle = PALETTE.shadow;
    roundRect(context, x + 4, y + 8, w, h, 14);
    context.fill();
    context.fillStyle = PALETTE.counter;
    roundRect(context, x, y, w, h, 14);
    context.fill();
    context.fillStyle = PALETTE.counterTop;
    roundRect(context, x + 5, y + 5, w - 10, h - 26, 10);
    context.fill();
    context.fillStyle = PALETTE.counterEdge;
    context.fillRect(x + 6, y + h - 20, w - 12, 14);

    drawIngredient(context, bin.ingredient, x + w / 2 - 22, y + 38, 30, RAW, time);
    drawIngredient(context, bin.ingredient, x + w / 2 + 18, y + 44, 26, RAW, time);
    drawIngredient(context, bin.ingredient, x + w / 2 - 2, y + 56, 24, RAW, time);

    const name = INGREDIENTS[bin.ingredient].name;
    context.textBaseline = 'alphabetic';
    text(name, x + w / 2, y + h - 6, 14, PALETTE.text, 'center');
    if (isNear) {
      context.strokeStyle = PALETTE.accent;
      context.lineWidth = 4;
      roundRect(context, x - 2, y - 2, w + 4, h + 4, 16);
      context.stroke();
    }
  }

  /** A prep meter floats above the chef's hat, so a counter or the chef's own body never hides it. */
  function drawPrepMeter(state) {
    const prep = state.prep;
    if (prep === null) return;
    const width = 150;
    const x = state.player.x - width / 2;
    const y = state.player.y - 136;
    context.fillStyle = 'rgba(26, 18, 12, 0.86)';
    roundRect(context, x - 9, y - 22, width + 18, 46, 12);
    context.fill();
    context.strokeStyle = 'rgba(255, 179, 92, 0.7)';
    context.lineWidth = 2;
    context.stroke();
    text(prep.kind === 'chop' ? 'CHOPPING' : 'COOKING', state.player.x, y - 5, 12, PALETTE.text, 'center');
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    roundRect(context, x, y + 4, width, 12, 6);
    context.fill();
    context.fillStyle = prep.kind === 'chop' ? PALETTE.accent : PALETTE.flame;
    roundRect(context, x, y + 4, width * Math.min(1, prep.progress), 12, 6);
    context.fill();
  }

  function drawBoardStation(station, isNear, state) {
    const { x, y, w, h } = station;
    context.fillStyle = PALETTE.board;
    roundRect(context, x + 18, y + 30, w - 36, h - 58, 12);
    context.fill();
    context.strokeStyle = PALETTE.boardEdge;
    context.lineWidth = 5;
    context.stroke();
    // The knife rests at an angle across the top of the board.
    context.save();
    context.translate(x + w / 2 + 24, y + 62);
    context.rotate(-0.28);
    context.fillStyle = '#d7dde6';
    context.beginPath();
    context.moveTo(-44, -7);
    context.lineTo(20, -9);
    context.lineTo(34, 0);
    context.lineTo(20, 9);
    context.lineTo(-44, 7);
    context.closePath();
    context.fill();
    context.fillStyle = '#3a2a22';
    roundRect(context, 32, -8, 34, 16, 6);
    context.fill();
    context.restore();
    if (state.prep !== null && state.prep.kind === 'chop') {
      for (const [dx, dy] of [[-36, 40], [-18, 52], [10, 38]]) {
        context.fillStyle = '#d94b42';
        context.fillRect(x + w / 2 + dx, y + dy, 9, 9);
      }
    }
    void isNear;
  }

  function drawStoveStation(station, isNear, state, time) {
    const { x, y, w, h } = station;
    context.fillStyle = PALETTE.stove;
    roundRect(context, x + 18, y + 28, w - 36, h - 54, 12);
    context.fill();
    for (const offset of [-52, 52]) {
      const cx = x + w / 2 + offset;
      const cy = y + 88;
      context.fillStyle = PALETTE.burner;
      context.beginPath();
      context.ellipse(cx, cy, 38, 20, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#20242c';
      context.lineWidth = 4;
      context.beginPath();
      context.ellipse(cx, cy, 26, 13, 0, 0, Math.PI * 2);
      context.stroke();
      const cooking = state.prep !== null && state.prep.kind === 'cook';
      if (cooking) {
        for (let flame = 0; flame < 5; flame += 1) {
          const wobble = Math.sin(time * 12 + flame) * 3;
          context.fillStyle = flame % 2 === 0 ? PALETTE.flame : '#ffd166';
          context.beginPath();
          context.moveTo(cx - 12 + flame * 6, cy + 2);
          context.quadraticCurveTo(cx - 8 + flame * 6 + wobble, cy - 18, cx - 4 + flame * 6, cy + 2);
          context.fill();
        }
      }
    }
    context.fillStyle = '#1d2026';
    for (const offset of [-70, 70]) {
      context.beginPath();
      context.arc(x + w / 2 + offset, y + h - 44, 7, 0, Math.PI * 2);
      context.fill();
    }
    void isNear;
  }

  function drawPlateStation(station, isNear, state) {
    const { x, y, w, h } = station;
    const cx = x + w / 2;
    const cy = y + 82;
    context.fillStyle = PALETTE.plateRim;
    context.beginPath();
    context.ellipse(cx, cy + 4, 96, 44, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.plate;
    context.beginPath();
    context.ellipse(cx, cy, 90, 39, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.plateRim;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(cx, cy, 64, 27, 0, 0, Math.PI * 2);
    context.stroke();
    const items = state.plate;
    for (let index = 0; index < items.length; index += 1) {
      const row = Math.floor(index / 4);
      const column = index % 4;
      const dx = (column - (Math.min(4, items.length) - 1) / 2) * 34;
      const dy = (row - 0.5) * 26;
      drawIngredient(context, items[index].ingredient, cx + dx, cy + dy, 26, items[index].prep, state.elapsed);
    }
    if (items.length === 0) {
      text('empty', cx, cy + 6, 15, '#c9b79a', 'center', '600');
    }
    void isNear;
  }

  function drawWindowStation(station, isNear, state, time) {
    const { x, y, w, h } = station;
    context.fillStyle = '#241a14';
    roundRect(context, x + 24, y + 30, w - 48, h - 62, 10);
    context.fill();
    context.fillStyle = 'rgba(255, 179, 92, 0.2)';
    roundRect(context, x + 30, y + 36, w - 60, h - 74, 8);
    context.fill();
    const cx = x + w / 2;
    context.fillStyle = '#f2c14e';
    context.beginPath();
    context.arc(cx, y + 78, 20, Math.PI, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d9a635';
    context.fillRect(cx - 22, y + 78, 44, 7);
    context.beginPath();
    context.arc(cx, y + 61, 4, 0, Math.PI * 2);
    context.fill();
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    context.globalAlpha = pulse;
    text('SERVE', cx, y + 118, 22, PALETTE.accent, 'center');
    context.globalAlpha = 1;
    void state;
    void isNear;
  }

  function drawStation(station, state, isNear, time) {
    const { x, y, w, h } = station;
    context.fillStyle = PALETTE.shadow;
    roundRect(context, x + 4, y + 9, w, h, 16);
    context.fill();
    context.fillStyle = PALETTE.counter;
    roundRect(context, x, y, w, h, 16);
    context.fill();
    context.fillStyle = PALETTE.counterTop;
    roundRect(context, x + 6, y + 6, w - 12, h - 34, 12);
    context.fill();
    context.fillStyle = PALETTE.counterEdge;
    context.fillRect(x + 8, y + h - 28, w - 16, 20);
    context.textBaseline = 'alphabetic';
    text(station.label.toUpperCase(), x + w / 2, y + h - 11, 14, PALETTE.text, 'center', '700');

    if (station.kind === 'board') drawBoardStation(station, isNear, state);
    else if (station.kind === 'stove') drawStoveStation(station, isNear, state, time);
    else if (station.kind === 'plate') drawPlateStation(station, isNear, state);
    else drawWindowStation(station, isNear, state, time);

    if (isNear) {
      context.strokeStyle = PALETTE.accent;
      context.lineWidth = 4;
      roundRect(context, x - 2, y - 2, w + 4, h + 4, 18);
      context.stroke();
    }
  }

  function drawChef(player, state) {
    const bob = player.walking ? Math.sin(player.stepPhase) * 3 : Math.sin(state.elapsed * 2) * 1.2;
    context.save();
    context.translate(player.x, player.y + bob);
    context.scale(1.22, 1.22);
    context.fillStyle = PALETTE.shadow;
    context.beginPath();
    context.ellipse(0, 30, 28, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Apron and arms.
    context.fillStyle = PALETTE.chefDark;
    roundRect(context, -25, -6, 15, 36, 7);
    context.fill();
    roundRect(context, 10, -6, 15, 36, 7);
    context.fill();
    context.fillStyle = PALETTE.chef;
    roundRect(context, -21, -13, 42, 50, 13);
    context.fill();
    context.fillStyle = '#e9f7f3';
    roundRect(context, -14, 6, 28, 22, 5);
    context.fill();
    // Head and toque.
    context.fillStyle = PALETTE.skin;
    context.beginPath();
    context.arc(0, -27, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.hat;
    roundRect(context, -17, -44, 34, 13, 5);
    context.fill();
    for (const [dx, dy, r] of [[-13, -51, 11], [0, -55, 13], [13, -51, 11]]) {
      context.beginPath();
      context.arc(dx, dy, r, 0, Math.PI * 2);
      context.fill();
    }
    // Eyes look where the chef was last walking.
    const lookX = player.facing.x * 2.6;
    const lookY = Math.max(-1, player.facing.y) * 1.7;
    context.fillStyle = '#3b2417';
    context.beginPath();
    context.arc(-5.5 + lookX, -26 + lookY, 2.5, 0, Math.PI * 2);
    context.arc(5.5 + lookX, -26 + lookY, 2.5, 0, Math.PI * 2);
    context.fill();
    // Carried ingredients sit in a row above the hat.
    const carry = player.carry;
    if (carry.length > 0) {
      const spacing = 28;
      const start = -((carry.length - 1) * spacing) / 2;
      for (let index = 0; index < carry.length; index += 1) {
        context.fillStyle = 'rgba(26, 18, 12, 0.6)';
        context.beginPath();
        context.arc(start + index * spacing, -72, 14, 0, Math.PI * 2);
        context.fill();
        drawIngredient(context, carry[index].ingredient, start + index * spacing, -72, 21, carry[index].prep, state.elapsed);
      }
    }
    context.restore();
  }

  function drawPrompt(state) {
    const near = state.near;
    if (near === null) return;
    const player = state.player;
    const label = `SPACE  ${verbFor(near.kind)}`;
    context.font = `700 15px ${FONT}`;
    context.textBaseline = 'middle';
    const width = context.measureText(label).width + 26;
    const x = player.x - width / 2;
    const y = player.y + 58;
    context.fillStyle = 'rgba(26, 18, 12, 0.82)';
    roundRect(context, x, y, width, 30, 15);
    context.fill();
    context.strokeStyle = PALETTE.accent;
    context.lineWidth = 2;
    context.stroke();
    text('SPACE', x + 13, y + 16, 15, PALETTE.accent, 'left');
    text(verbFor(near.kind), x + 13 + context.measureText('SPACE').width + 8, y + 16, 15, PALETTE.text, 'left', '600');
    context.textBaseline = 'alphabetic';
  }

  function timerColor(fraction) {
    if (fraction > 0.5) return PALETTE.good;
    if (fraction > 0.22) return PALETTE.warn;
    return PALETTE.bad;
  }

  function drawOrderCard(order, index, time) {
    const x = CARD.left + index * (CARD.width + CARD.gap);
    const y = CARD.top;
    context.fillStyle = PALETTE.card;
    roundRect(context, x, y, CARD.width, CARD.height, 12);
    context.fill();
    context.strokeStyle = PALETTE.cardEdge;
    context.lineWidth = 3;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(order.recipe.name, x + 16, y + 30, 19, PALETTE.ink, 'left');
    text(`+${order.reward}`, x + CARD.width - 16, y + 30, 19, '#b06a1f', 'right');
    const items = order.recipe.items;
    for (let item = 0; item < items.length; item += 1) {
      drawIngredient(context, items[item].ingredient, x + 26 + item * 34, y + 58, 24, items[item].prep, time);
    }
    const fraction = Math.max(0, Math.min(1, order.timeLeft / order.totalTime));
    const barX = x + 16;
    const barY = y + 78;
    const barW = CARD.width - 32;
    context.fillStyle = '#e7d4b7';
    roundRect(context, barX, barY, barW, 10, 5);
    context.fill();
    context.fillStyle = timerColor(fraction);
    roundRect(context, barX, barY, Math.max(4, barW * fraction), 10, 5);
    context.fill();
    text(`${Math.ceil(order.timeLeft)}s`, x + CARD.width - 16, y + 74, 12, PALETTE.ink, 'right', '600');
  }

  function drawOrderBoard(state, time) {
    context.fillStyle = 'rgba(26, 18, 12, 0.28)';
    context.fillRect(0, 0, FIELD.width, 128);
    for (let index = 0; index < 3; index += 1) {
      const order = state.orders[index];
      if (order === undefined) {
        const x = CARD.left + index * (CARD.width + CARD.gap);
        context.fillStyle = 'rgba(255, 244, 224, 0.12)';
        roundRect(context, x, CARD.top, CARD.width, CARD.height, 12);
        context.fill();
        context.setLineDash([8, 8]);
        context.strokeStyle = 'rgba(255, 244, 224, 0.35)';
        context.lineWidth = 2;
        context.stroke();
        context.setLineDash([]);
        text('waiting for a ticket…', x + CARD.width / 2, CARD.top + 56, 15, PALETTE.muted, 'center', '600');
      } else {
        drawOrderCard(order, index, time);
      }
    }
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(26, 18, 12, 0.86)';
    context.fillRect(0, 652, FIELD.width, 68);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, 652, FIELD.width, 3);
    context.textBaseline = 'middle';
    text(scoreLabel(state.score), 26, 688, 26, PALETTE.text, 'left');
    text(levelLabel(state.level), 250, 688, 22, PALETTE.accent, 'left');
    if (state.combo > 1) text(`Combo ${state.combo}`, 386, 688, 22, '#ffcf7a', 'left');
    text('REPUTATION', FIELD.width - 30, 672, 12, PALETTE.muted, 'right', '600');
    for (let life = 0; life < LIVES; life += 1) {
      drawHeart(context, FIELD.width - 40 - life * 34, 692, 26, life < state.hearts);
    }
    context.textBaseline = 'alphabetic';
  }

  function drawToast(state) {
    if (state.messageTime <= 0 || state.message === '') return;
    const alpha = Math.min(1, state.messageTime * 2);
    context.globalAlpha = alpha;
    context.font = `700 18px ${FONT}`;
    const width = context.measureText(state.message).width + 40;
    const x = FIELD.width / 2 - width / 2;
    const y = 614;
    context.fillStyle = 'rgba(26, 18, 12, 0.86)';
    roundRect(context, x, y, width, 38, 19);
    context.fill();
    context.strokeStyle = 'rgba(255, 179, 92, 0.7)';
    context.lineWidth = 2;
    context.stroke();
    text(state.message, FIELD.width / 2, y + 25, 18, PALETTE.text, 'center');
    context.globalAlpha = 1;
  }

  function drawOverlay(alpha) {
    context.fillStyle = `rgba(20, 13, 9, ${alpha})`;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 760;
    const height = 168 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 20);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 8;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 86, 54, accent ?? PALETTE.accent, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 132 + index * 34, 20, PALETTE.text, 'center', '600');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.accent, 'center');
  }

  const TITLE_LINES = [
    'WASD or arrows to move · Space to grab, chop, cook, plate and serve',
    'Read the order board, build each dish before its clock runs out',
    'Chain served orders for a combo · lose a ticket and lose a heart',
  ];
  const OVER_LINES = ['', '', ''];

  function draw(state, screen, best) {
    const time = state.elapsed;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    for (const bin of BINS) drawBin(bin, state, state.near === bin, time);
    for (const station of STATIONS) drawStation(station, state, state.near === station, time);
    drawChef(state.player, state);
    drawPrepMeter(state);
    drawPrompt(state);
    drawHud(state);
    drawOrderBoard(state, time);
    drawToast(state);
    if (screen === SCREEN_TITLE) {
      drawOverlay(0.55);
      drawPanel('SKILLET RUSH', [...TITLE_LINES, bestLabel(best)], 'Press Space or click to start', PALETTE.accent);
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay(0.5);
      drawPanel('Paused', ['The tickets will wait.', '', bestLabel(best)], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawOverlay(0.58);
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = servedLabel(state.served);
      OVER_LINES[2] = bestLabel(best);
      drawPanel('SERVICE OVER', OVER_LINES, 'Press Space or click to cook again', PALETTE.bad);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
