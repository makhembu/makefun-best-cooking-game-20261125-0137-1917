// Skillet Rush's hand-in program (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request). This program copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json with the vendored make.fun library.
//
// Before it writes the dossier it re-checks the entry against the sealed gate's own rules: plain
// files under the caps, a regular index.html, screenshots that are 3-4 real PNG/JPEG images of the
// right size, every reference resolving to a file inside game/, a usable import map, and a
// dossier that rebuilds byte for byte. A broken entry fails here with a precise message instead of
// wasting a grade.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INDEX_HTML,
  INDEX_HTML_MAX_BYTES,
  buildDossier,
  htmlFacts,
  importMapMatch,
  importMapOf,
  importOrder,
  isRelativeRef,
  isRelativeSpecifier,
  readGameTree,
  resolveGamePath,
  sourceImports,
} from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');

// The scorer's own caps (reference/gate.json). text_max_bytes shapes the dossier; the others
// refuse exactly what the scorer refuses.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const DOSSIER_GATE_MAX = 1572864;
const OUTPUT_MAX_ENTRIES = 1000;
const OUTPUT_MAX_BYTES = 67108864;
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const SCREENSHOT_MIN_COUNT = 3;
const SCREENSHOT_LONG_MAX = 1280;
const SCREENSHOT_SHORT_MIN = 480;

function gateFail(message) {
  console.error(`gate: ${message}`);
  process.exit(1);
}

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The pixel size a PNG header declares, or null when the bytes are not a whole PNG. */
function pngSize(bytes) {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  for (let i = 0; i < magic.length; i += 1) if (bytes[i] !== magic[i]) return null;
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
  const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/** The pixel size of a JPEG's first start-of-frame marker, or null when it is not a whole JPEG. */
function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const size = (bytes[i + 2] << 8) | bytes[i + 3];
    if (size < 2) return null;
    const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isFrame) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + size;
  }
  return null;
}

/** Check screenshots/ holds 3-4 whole, correctly sized PNG/JPEG images and return their names. */
function validateScreenshots(dir) {
  let stats;
  try {
    stats = statSync(dir);
  } catch {
    gateFail(`screenshots/: no such directory (3 or 4 renders of the game are required)`);
  }
  if (!stats.isDirectory()) gateFail('screenshots/: not a directory');
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort(byCodeUnit);
  if (names.length < SCREENSHOT_MIN_COUNT || names.length > CAPS.screenshots.max) {
    gateFail(`screenshots/: ${names.length} images, the gate needs ${SCREENSHOT_MIN_COUNT} to ${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    if (!IMAGE_NAME.test(name)) gateFail(`screenshots/${name}: invalid image name`);
    const path = join(dir, name);
    const size = statSync(path).size;
    if (size > CAPS.screenshots.max_bytes) gateFail(`screenshots/${name}: ${size} bytes is over 256 KiB`);
    const bytes = new Uint8Array(readFileSync(path));
    const pixels = pngSize(bytes) ?? jpegSize(bytes);
    if (pixels === null) gateFail(`screenshots/${name}: not a whole PNG or JPEG`);
    const long = Math.max(pixels.width, pixels.height);
    const short = Math.min(pixels.width, pixels.height);
    if (long > SCREENSHOT_LONG_MAX) gateFail(`screenshots/${name}: long side ${long} is over ${SCREENSHOT_LONG_MAX}`);
    if (short < SCREENSHOT_SHORT_MIN) gateFail(`screenshots/${name}: short side ${short} is under ${SCREENSHOT_SHORT_MIN}`);
  }
  return names;
}

/** Check one page or module reference names a data: URI or a real file inside game/. */
function checkReference(ref, from, files) {
  if (typeof ref !== 'string') gateFail(`${from}: a reference is not a string`);
  if (ref.startsWith('data:')) return;
  if (ref.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) {
    gateFail(`${from}: reference ${JSON.stringify(ref)} leaves game/`);
  }
  let target;
  if (ref.startsWith('/')) {
    target = ref.split(/[?#]/)[0].slice(1);
  } else {
    target = resolveGamePath(ref, from);
  }
  if (target === null || !files.has(target)) {
    gateFail(`${from}: reference ${JSON.stringify(ref)} names no file inside game/`);
  }
}

/** Rebuild the gate's references row from the output tree, reading modules as the page loads them. */
function validateReferences(gameDir, tree) {
  const files = new Set(tree.files.map((file) => file.path));
  const index = tree.files.find((file) => file.path === INDEX_HTML);
  if (index === undefined) gateFail('game/index.html: missing');
  if (index.bytes > INDEX_HTML_MAX_BYTES) gateFail(`game/index.html: over ${INDEX_HTML_MAX_BYTES} bytes`);
  const html = new TextDecoder('utf-8').decode(new Uint8Array(readFileSync(join(gameDir, INDEX_HTML))));
  const facts = htmlFacts(html);
  const mapRead = importMapOf(facts);
  if (mapRead.error !== null) gateFail(mapRead.error);
  const map = mapRead.map;

  for (const script of facts.scripts) if (script.src !== null) checkReference(script.src, INDEX_HTML, files);
  for (const link of facts.links) checkReference(link.href, INDEX_HTML, files);
  for (const resource of facts.resources) checkReference(resource.src, INDEX_HTML, files);
  if (map !== null) {
    for (const value of Object.values(map.imports)) if (value !== null) checkReference(value, INDEX_HTML, files);
    for (const scoped of Object.values(map.scopes)) {
      for (const value of Object.values(scoped)) if (value !== null) checkReference(value, INDEX_HTML, files);
    }
  }

  const sources = tree.files
    .filter((file) => file.cls === 'source' && /\.(?:js|mjs)$/i.test(file.path))
    .map((file) => ({ path: file.path, bytes: new Uint8Array(readFileSync(join(gameDir, file.path))) }));
  const byPath = new Map(sources.map((source) => [source.path, source]));
  for (const path of importOrder(sources, facts)) {
    const source = byPath.get(path);
    if (source === undefined) continue;
    const moduleText = new TextDecoder('utf-8').decode(source.bytes);
    for (const specifier of sourceImports(moduleText)) {
      if (specifier.startsWith('data:')) continue;
      if (isRelativeSpecifier(specifier)) {
        const target = resolveGamePath(specifier, path);
        if (target === null || !files.has(target)) {
          gateFail(`game/${path}: import ${JSON.stringify(specifier)} names no file inside game/`);
        }
        continue;
      }
      if (specifier.startsWith('node:')) gateFail(`game/${path}: static import of ${specifier}`);
      const match = importMapMatch(map, specifier, path);
      if (!match.found || match.value === null) {
        gateFail(`game/${path}: bare import ${JSON.stringify(specifier)} is not mapped`);
      }
      checkReference(match.value, INDEX_HTML, files);
    }
  }
}

/** Count /output's entries and bytes the way the platform caps them. */
function measureOutput(dir) {
  let entries = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) gateFail(`${path}: a symbolic link in /output`);
      if (entry.isDirectory()) {
        entries += 1;
        stack.push(path);
      } else if (entry.isFile()) {
        entries += 1;
        bytes += statSync(path).size;
      } else {
        gateFail(`${path}: a special file in /output`);
      }
    }
  }
  return { entries, bytes };
}

function main() {
  if (!existsSync(gameSrc)) gateFail('game/: no such directory');
  if (!existsSync(shotsSrc)) gateFail('screenshots/: no such directory');

  // Validate the source before touching /output, so a bad edit never leaves a half-written entry.
  let sourceTree;
  try {
    sourceTree = readGameTree(gameSrc, CAPS);
  } catch (error) {
    gateFail(error instanceof Error ? error.message : String(error));
  }
  const sourceShots = validateScreenshots(shotsSrc);

  mkdirSync(out, { recursive: true });
  rmSync(join(out, 'game'), { recursive: true, force: true });
  rmSync(join(out, 'screenshots'), { recursive: true, force: true });
  cpSync(gameSrc, join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });

  let tree;
  try {
    tree = readGameTree(join(out, 'game'), CAPS);
  } catch (error) {
    gateFail(error instanceof Error ? error.message : String(error));
  }
  validateReferences(join(out, 'game'), tree);
  const outputShots = validateScreenshots(join(out, 'screenshots'));
  if (outputShots.join('|') !== sourceShots.join('|')) gateFail('screenshots/: the copy differs from the source');

  let dossier;
  try {
    dossier = buildDossier(out, CAPS);
  } catch (error) {
    gateFail(error instanceof Error ? error.message : String(error));
  }
  if (dossier.length > DOSSIER_GATE_MAX) gateFail(`dossier.json: ${dossier.length} bytes is over ${DOSSIER_GATE_MAX}`);
  writeFileSync(join(out, 'dossier.json'), dossier);

  // A second independent build must agree byte for byte with what is on disk: the gate's
  // dossier_matches row then holds for the same reason the scorer's check will.
  let rebuilt;
  try {
    rebuilt = buildDossier(out, CAPS);
  } catch (error) {
    gateFail(error instanceof Error ? error.message : String(error));
  }
  const onDisk = new Uint8Array(readFileSync(join(out, 'dossier.json')));
  if (Buffer.compare(Buffer.from(rebuilt), Buffer.from(onDisk)) !== 0) gateFail('dossier.json does not rebuild byte for byte');
  if (Buffer.compare(Buffer.from(dossier), Buffer.from(onDisk)) !== 0) gateFail('dossier.json differs from the built dossier');

  const measured = measureOutput(out);
  if (measured.entries > OUTPUT_MAX_ENTRIES) gateFail(`/output: ${measured.entries} entries is over ${OUTPUT_MAX_ENTRIES}`);
  if (measured.bytes > OUTPUT_MAX_BYTES) gateFail(`/output: ${measured.bytes} bytes is over ${OUTPUT_MAX_BYTES}`);

  const sourceBytes = tree.files.filter((file) => file.cls === 'source').length;
  console.log(
    `valid: ${tree.files.length} game files (${sourceBytes} source), ${outputShots.length} screenshots, ` +
      `${dossier.length} byte dossier, ${measured.entries} output entries, ${measured.bytes} output bytes`,
  );
}

main();
