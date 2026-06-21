/* game.js — SCHOOLNIGHTS
   A DOOM-1993-style raycasting FPS prototype.
   - Walls: textureless solid-color raycasting with distance shading.
   - Enemies: billboarded procedural sprites (FNAF animatronics on L1,
              Pac-Man ghosts + a Pac-Man miniboss on L2).
   - Guns: travelling visible projectiles (pistol / shotgun / full-auto
           SMG) plus a melee chainsaw.
   - Levels: clear every enemy to unlock the red exit door, which leads
             to the next level.
*/

(() => {
'use strict';

// ---- canvas ------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---- levels ------------------------------------------------------
// Level 1: the Baldi's-Basics-style schoolhouse — six classrooms
// (chalkboard back walls) off a central hallway lined with lockers (2)
// and doors (5). A red exit door (6) sits at the east end of the hall.
//   0 floor  1 wall  2 locker  3 chalkboard  4 exit-marker
//   5 openable door (press E)  6 red level-exit door
const SCHOOL_MAP = [
  '111111111111111111111111', //  0 outer wall
  '133333331333333313333331', //  1 classroom back walls (chalkboard)
  '100000001000000010000001', //  2 top classrooms
  '100000001000000010000001', //  3
  '100000001000000010000001', //  4
  '100000001000000010000001', //  5
  '100000001000000010000001', //  6
  '112151211121512111215121', //  7 hallway wall: doors (5) + lockers (2)
  '100000000000000000000001', //  8 central hallway
  '100000000000000000000006', //  9 central hallway (red exit door, east)
  '100000000000000000000001', // 10 central hallway
  '112151211121512111215121', // 11 hallway wall: doors (5) + lockers (2)
  '100000001000000010000001', // 12 bottom classrooms
  '100000001000000010000001', // 13
  '100000001000000010000001', // 14
  '100000001000000010000001', // 15
  '100000001000000010000001', // 16
  '133333331333333313333331', // 17 classroom back walls (chalkboard)
  '111111111111111111111111', // 18 outer wall
];

// Level 2: a Pac-Man-style lattice maze — 2×2 blocks separated by a
// connected grid of corridors. Blue walls, a red exit door on the east.
function genArcadeMap() {
  const w = 24, h = 19, rows = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) s += '1';
      else s += (x % 3 === 0 || y % 3 === 0) ? '0' : '1';
    }
    rows.push(s);
  }
  rows[9] = rows[9].slice(0, w - 1) + '6'; // red exit door on a corridor row
  return rows;
}

// Level 3: a WW2 bunker — a large concrete room with 2×2 cover pillars
// (code 2) and partial interior dividers (code 1, with gaps). The big
// open footprint keeps it fully traversable; a red exit door sits east.
function genBunkerMap() {
  const w = 24, h = 19, g = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++)
      row.push((x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '1' : '0');
    g.push(row);
  }
  const blocks = [[4, 4], [4, 13], [10, 8], [16, 4], [16, 13], [19, 9]]; // cover
  for (const [bx, by] of blocks)
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) g[by + dy][bx + dx] = '2';
  for (let y = 1; y <= 6; y++) if (y !== 3 && y !== 4) g[y][8] = '1';       // partial dividers
  for (let y = 12; y <= 17; y++) if (y !== 14 && y !== 15) g[y][15] = '1';
  g[9][w - 1] = '6';                                                        // red exit
  return g.map(r => r.join(''));
}

// Per-theme wall palette ({x,y} = N-S vs E-W face shades) + flat
// ceiling/floor colors.
const THEMES = {
  school: {
    ceil: '#26303a', floor: '#3a3026',
    walls: {
      1: { x: '#7d9e6c', y: '#9bc086' }, // institutional green
      2: { x: '#8a8f96', y: '#b3b8bf' }, // lockers (grey)
      3: { x: '#2f4a35', y: '#3c6044' }, // chalkboard green
      4: { x: '#c9a227', y: '#f2c84b' }, // exit marker (yellow)
      5: { x: '#9b7536', y: '#caa15a' }, // openable door (wood/brass)
      6: { x: '#8a1f1f', y: '#c43a3a' }, // red exit door
    },
  },
  arcade: {
    ceil: '#04040f', floor: '#08081a',
    walls: {
      1: { x: '#15238a', y: '#2c44d6' }, // Pac-Man maze blue
      5: { x: '#9b7536', y: '#caa15a' },
      6: { x: '#8a1f1f', y: '#c43a3a' },
    },
  },
  bunker: {
    ceil: '#1a1712', floor: '#23201a',
    walls: {
      1: { x: '#5a5a52', y: '#73736a' }, // concrete
      2: { x: '#46443a', y: '#5c5a4c' }, // darker cover blocks
      5: { x: '#9b7536', y: '#caa15a' },
      6: { x: '#8a1f1f', y: '#c43a3a' },
    },
  },
};

const LEVELS = [
  { theme: 'school', map: SCHOOL_MAP,
    roster: ['freddy', 'bonnie', 'chica', 'foxy', 'freddy', 'bonnie', 'chica', 'foxy'],
    ammo: 5, health: 2 },
  { theme: 'arcade', map: genArcadeMap(),
    roster: ['blinky', 'pinky', 'inky', 'clyde', 'blinky', 'pinky', 'inky', 'clyde'],
    boss: 'pacman',   // wakes only once every ghost is dead
    ammo: 6, health: 3 },
  { theme: 'bunker', map: genBunkerMap(),
    roster: ['soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'hellknight', 'hellknight', 'hellknight'],
    ammo: 0, health: 3, knifeOnly: true },
];

// active level state, set by loadLevel()
let MAP, MAP_W, MAP_H, WALL_COLORS, CEIL, FLOOR;
let levelIndex = 0;
let exitReady = false;      // true once every enemy on the level is dead
let levelKnifeOnly = false; // level 3: knife only, with block/parry
let pendingBoss = null;     // a boss that wakes only after the roster is cleared
let bossSpawned = false;

function loadLevel(i) {
  const L = LEVELS[i];
  MAP = L.map.slice();
  MAP_W = MAP[0].length;
  MAP_H = MAP.length;
  const th = THEMES[L.theme];
  WALL_COLORS = th.walls; CEIL = th.ceil; FLOOR = th.floor;
  exitReady = false;
  levelKnifeOnly = !!L.knifeOnly;
  if (levelKnifeOnly) player.weapon = 'knife';
}

function cell(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 1;
  return MAP[y | 0].charCodeAt(x | 0) - 48;
}
function isWall(x, y) {
  const c = cell(x, y);
  return c > 0 && !(c === 5 && doorIsOpen(x, y)); // open doors are passable; red door (6) is solid
}

// ---- player ------------------------------------------------------
const player = {
  x: 3.5, y: 3.5,
  dir: 0,            // radians
  speed: 3.2,        // tiles / sec
  fov: Math.PI / 3,  // 60deg
  hp: 100,
  weapon: 'pistol',
  bullets: 24,
  shells: 6,
  smgAmmo: 60,
};

// ---- weapons -----------------------------------------------------
// All guns fire travelling projectiles. cd = seconds between shots;
// auto = fires while the trigger is held. pellets/spread shape the cone.
const WEAPONS = {
  pistol:   { name: 'PISTOL',   ammo: 'bullets', cd: 0.30, kick: 6,  muzzle: 0.16,
              auto: false, pellets: 1, spread: 0.01, projSpd: 20, projScale: 0.16, spr: 'shot',   dmg: 2 },
  shotgun:  { name: 'SHOTGUN',  ammo: 'shells',  cd: 0.75, kick: 16, muzzle: 0.28,
              auto: false, pellets: 7, spread: 0.22, projSpd: 16, projScale: 0.14, spr: 'pellet', dmg: 2 },
  smg:      { name: 'SMG',      ammo: 'smgAmmo', cd: 0.085, kick: 5, muzzle: 0.10,
              auto: true,  pellets: 1, spread: 0.05, projSpd: 22, projScale: 0.16, spr: 'shot',   dmg: 1 },
  chainsaw: { name: 'CHAINSAW', ammo: null,      cd: 0.10, kick: 2,  muzzle: 0,
              auto: true,  melee: true, range: 1.6, cone: 0.5, dmg: 2 },
  knife:    { name: 'KNIFE',    ammo: null,      cd: 0.38, kick: 4,  muzzle: 0,
              auto: false, melee: true, range: 1.35, cone: 0.4, dmg: 4 },
};
const WORDER = ['pistol', 'shotgun', 'smg', 'chainsaw']; // knife is level-3 only

// ---- enemy archetypes --------------------------------------------
// ranged enemies carry their own projectile stats. boss = bigger sprite
// + heavier hitbox. ghosts behave like melee stalkers.
const ENEMY_STATS = {
  // Level 1 — FNAF animatronics
  freddy: { hp: 6, speed: 0.7 },
  bonnie: { hp: 3, speed: 1.25 },
  chica:  { hp: 4, speed: 1.0 },
  foxy:   { hp: 3, speed: 1.7, ranged: true, fireRate: 1.6, projDmg: 12, projSpd: 5, projSpr: 'orb', projScale: 0.4 },
  // Level 2 — Pac-Man ghosts
  blinky: { hp: 3, speed: 1.35 },
  pinky:  { hp: 3, speed: 1.2 },
  inky:   { hp: 3, speed: 1.15 },
  clyde:  { hp: 4, speed: 1.0 },
  // Level 2 — Pac-Man miniboss: slow, tanky, slow heavy projectile
  pacman: { hp: 30, speed: 0.6, scale: 1.9, boss: true, ranged: true,
            fireRate: 2.4, projDmg: 34, projSpd: 3.0, projSpr: 'bigorb', projScale: 0.85 },
  // Level 3 — Wolfenstein soldier: fires deflectable bullets
  soldier: { hp: 4, speed: 1.05, ranged: true, fireRate: 1.4, projDmg: 9, projSpd: 8, projSpr: 'shot', projScale: 0.16 },
  // Level 3 — DOOM Hell Knight: telegraphs a heavy strike you parry
  hellknight: { hp: 14, speed: 1.55, scale: 1.45, knight: true },
  // The Grim Reaper — immortal, omniscient, instant-kill; spawns at the exit unlock
  reaper: { hp: 99999, speed: 2.2, scale: 1.3, reaper: true, immortal: true },
};

// ---- input -------------------------------------------------------
const keys = {};
let mouseLocked = false;
let triggerHeld = false;
let blocking = false;   // right mouse held
function isBlocking() { return blocking && player.weapon === 'knife'; }
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { triggerHeld = true; shoot(); } }
  if (e.code === 'KeyE') { e.preventDefault(); interact(); }
  if (e.code === 'Tab') { e.preventDefault(); if (running) mapVisible = !mapVisible; }
  if (e.code === 'Digit1') setWeapon('pistol');
  if (e.code === 'Digit2') setWeapon('shotgun');
  if (e.code === 'Digit3') setWeapon('smg');
  if (e.code === 'Digit4') setWeapon('chainsaw');
  if (e.code === 'KeyQ') cycleWeapon(1);
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') triggerHeld = false;
});
canvas.addEventListener('wheel', e => {
  if (!running) return;
  e.preventDefault();
  cycleWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: false });
function setWeapon(w) {
  if (!WEAPONS[w] || player.weapon === w) return;
  if (levelKnifeOnly && w !== 'knife') return;  // level 3 is knife-only
  player.weapon = w;
  playerFireCd = 0.15;
  flashMsg(WEAPONS[w].name);
  updateHud();
}
function cycleWeapon(d) {
  if (levelKnifeOnly) return;
  const i = (WORDER.indexOf(player.weapon) + d + WORDER.length) % WORDER.length;
  setWeapon(WORDER[i]);
}

canvas.addEventListener('contextmenu', e => e.preventDefault()); // right-click = block
canvas.addEventListener('mousedown', e => {
  if (!running) return;
  if (e.button === 2) { blocking = true; return; }              // right: block
  if (!mouseLocked) { canvas.requestPointerLock(); return; }
  triggerHeld = true;
  shoot();
});
window.addEventListener('mouseup', e => {
  if (e.button === 2) blocking = false;
  else triggerHeld = false;
});
document.addEventListener('pointerlockchange', () => {
  mouseLocked = (document.pointerLockElement === canvas);
  if (!mouseLocked) { triggerHeld = false; blocking = false; }
});
document.addEventListener('mousemove', e => {
  if (mouseLocked) player.dir += e.movementX * 0.0026;
});

// ---- doors / level exit ------------------------------------------
let mapVisible = false;
const doorState = {};            // "x,y" -> true when open
function doorIsOpen(x, y) { return !!doorState[(x | 0) + ',' + (y | 0)]; }

// the door/exit tile in front of the player (within reach), or null
function frontCell() {
  const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
  for (let k = 0.3; k <= 1.7; k += 0.15) {
    const cx = (player.x + dirX * k) | 0, cy = (player.y + dirY * k) | 0;
    const c = cell(cx, cy);
    if (c === 5 || c === 6) return { x: cx, y: cy, c };
  }
  return null;
}
function interact() {
  if (!running) return;
  const f = frontCell();
  if (!f) { flashMsg('nothing to use here'); return; }
  if (f.c === 6) {                                  // red level-exit door
    if (!exitReady) { flashMsg('exit locked — clear the level'); return; }
    nextLevel();                                    // the Reaper doesn't count
    return;
  }
  const key = f.x + ',' + f.y;                      // openable door
  doorState[key] = !doorState[key];
  playDoorSound();
  flashMsg(doorState[key] ? 'door opened' : 'door closed');
}

function nextLevel() {
  levelIndex++;
  if (levelIndex >= LEVELS.length) { endGame(true); return; }
  loadLevel(levelIndex);
  for (const k in doorState) delete doorState[k];
  spawnEntities(LEVELS[levelIndex]);                // repositions player, keeps hp/ammo/weapon
  mapVisible = false;
  flashMsg('LEVEL ' + (levelIndex + 1));
  updateHud();
}

// ---- audio (Web Audio synthesis) ---------------------------------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playDoorSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o1 = audioCtx.createOscillator(); o1.type = 'sawtooth';
  o1.frequency.setValueAtTime(150, t);
  o1.frequency.exponentialRampToValueAtTime(85, t + 0.4);
  const o2 = audioCtx.createOscillator(); o2.type = 'sine';
  o2.frequency.setValueAtTime(72, t);
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(520, t); lp.Q.value = 7;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  o1.start(t); o2.start(t); o1.stop(t + 0.6); o2.stop(t + 0.6);
}
// short blip — gun fire and enemy shots
function playShotSound(freq, dur, type, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.5), t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol || 0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function playGunSound(w) {
  if (w.name === 'SHOTGUN') playShotSound(180, 0.18, 'square', 0.22);
  else if (w.name === 'SMG') playShotSound(520, 0.05, 'square', 0.12);
  else playShotSound(430, 0.08, 'square', 0.16);
}
// gritty chainsaw buzz (noisy sawtooth through a band-ish lowpass)
function playChainsawTick() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(90, t + 0.09);
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = 900; lp.Q.value = 3;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.10, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.12);
}
// quick knife swoosh
function playKnifeSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(280, t + 0.1);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.14);
}
// metallic ping — deflect / parry
function playParrySound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type = 'square';
  o.frequency.setValueAtTime(1500, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.2);
}

// ---- enemies / pickups / projectiles -----------------------------
let enemies = [];
let pickups = [];
let projectiles = [];   // both friendly (player) and hostile (enemy) shots

function openCells() {
  const list = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (cell(x, y) === 0) list.push([x + 0.5, y + 0.5]);
  return list;
}

// Randomised spawns from the level config: pick distinct open tiles,
// keeping a minimum distance from reference points.
function spawnEntities(L) {
  const open = openCells();
  const used = new Set();
  function take(minD, refs) {
    for (let t = 0; t < 300; t++) {
      const [x, y] = open[(Math.random() * open.length) | 0];
      const key = (x | 0) + ',' + (y | 0);
      if (used.has(key)) continue;
      let ok = true;
      for (const r of refs) if (Math.hypot(x - r.x, y - r.y) < minD) { ok = false; break; }
      if (!ok) continue;
      used.add(key);
      return { x, y };
    }
    for (const [x, y] of open) {
      const key = (x | 0) + ',' + (y | 0);
      if (!used.has(key)) { used.add(key); return { x, y }; }
    }
    return { x: open[0][0], y: open[0][1] };
  }

  // player first, random position + facing
  const p = take(0, []);
  player.x = p.x; player.y = p.y; player.dir = Math.random() * Math.PI * 2;

  enemies = L.roster.map(type => makeEnemy(type, take(6, [player])));
  pendingBoss = L.boss || null;
  bossSpawned = false;

  // pickups: ammo boxes (random type) + health medkits
  pickups = [];
  for (let i = 0; i < (L.ammo ?? 5); i++) {       // ?? so ammo: 0 means none (level 3)
    const pos = take(3, [player]);
    const r = Math.random();
    const kind = r < 0.45 ? 'bullets' : r < 0.75 ? 'shells' : 'smg';
    pickups.push({ x: pos.x, y: pos.y, kind, taken: false });
  }
  for (let i = 0; i < (L.health ?? 2); i++) {
    const pos = take(3, [player]);
    pickups.push({ x: pos.x, y: pos.y, kind: 'health', taken: false });
  }

  projectiles = [];
  exitReady = false;
}

// build one enemy of the given archetype at a position
function makeEnemy(type, pos) {
  const st = ENEMY_STATS[type];
  return {
    x: pos.x, y: pos.y, type,
    hp: st.hp, speed: st.speed,
    ranged: !!st.ranged, boss: !!st.boss, knight: !!st.knight,
    reaper: !!st.reaper, immortal: !!st.immortal, scale: st.scale || 1,
    fireRate: st.fireRate || 1.6, projDmg: st.projDmg || 12,
    projSpd: st.projSpd || 5, projSpr: st.projSpr || 'orb', projScale: st.projScale || 0.4,
    dead: false, hurt: 0, dist: 0,
    fireCd: 0.5 + Math.random() * 1.5,
    wanderDir: Math.random() * Math.PI * 2, wanderCd: Math.random() * 2,  // search behaviour
    atkState: null, atkTimer: 0, atkCd: 0, glow: null,                    // Hell Knight parry FSM
    punished: false,
  };
}

// the red exit-door tile centre, or null
function exitPos() {
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (cell(x, y) === 6) return { x: x + 0.5, y: y + 0.5 };
  return null;
}

// spawn the deferred boss at a random tile away from the player
function spawnBoss(type) {
  const open = openCells();
  for (let t = 0; t < 400; t++) {
    const [x, y] = open[(Math.random() * open.length) | 0];
    if (Math.hypot(x - player.x, y - player.y) >= 6) { enemies.push(makeEnemy(type, { x, y })); return; }
  }
  enemies.push(makeEnemy(type, { x: open[0][0], y: open[0][1] }));
}

// spawn the Grim Reaper away from both the player and the exit gate
function spawnReaper() {
  const ex = exitPos(), open = openCells();
  for (let t = 0; t < 500; t++) {
    const [x, y] = open[(Math.random() * open.length) | 0];
    if (Math.hypot(x - player.x, y - player.y) < 6) continue;
    if (ex && Math.hypot(x - ex.x, y - ex.y) < 4) continue;
    enemies.push(makeEnemy('reaper', { x, y }));
    return;
  }
  for (const [x, y] of open)
    if (Math.hypot(x - player.x, y - player.y) >= 5) { enemies.push(makeEnemy('reaper', { x, y })); return; }
}

// ---- depth buffer (per screen column) ----------------------------
const zBuffer = new Float32Array(W);

const spriteBuf = document.createElement('canvas');
const spriteBufCtx = spriteBuf.getContext('2d');
spriteBufCtx.imageSmoothingEnabled = false;

// ---- rendering ---------------------------------------------------
function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = CEIL; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = FLOOR; ctx.fillRect(0, H / 2, W, H / 2);

  const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
  const planeScale = Math.tan(player.fov / 2);
  const planeX = -dirY * planeScale, planeY = dirX * planeScale;

  for (let col = 0; col < W; col++) {
    const camX = 2 * col / W - 1;
    const rayX = dirX + planeX * camX;
    const rayY = dirY + planeY * camX;

    let mapX = player.x | 0, mapY = player.y | 0;
    const deltaX = Math.abs(1 / rayX), deltaY = Math.abs(1 / rayY);
    let stepX, stepY, sideX, sideY;
    if (rayX < 0) { stepX = -1; sideX = (player.x - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - player.x) * deltaX; }
    if (rayY < 0) { stepY = -1; sideY = (player.y - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - player.y) * deltaY; }

    let hit = 0, side = 0, c = 0, guard = 0;
    while (!hit && guard++ < 64) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      c = cell(mapX, mapY);
      if (c > 0 && !(c === 5 && doorIsOpen(mapX, mapY))) hit = 1;
    }

    let perp;
    if (side === 0) perp = (mapX - player.x + (1 - stepX) / 2) / rayX;
    else perp = (mapY - player.y + (1 - stepY) / 2) / rayY;
    if (perp < 0.0001) perp = 0.0001;
    zBuffer[col] = perp;

    const lineH = Math.floor(H / perp);
    let y0 = Math.floor(-lineH / 2 + H / 2);
    let y1 = Math.floor(lineH / 2 + H / 2);
    if (y0 < 0) y0 = 0;
    if (y1 > H) y1 = H;

    const pal = WALL_COLORS[c] || WALL_COLORS[1];
    let color = side === 1 ? pal.y : pal.x;
    const shade = Math.max(0.25, Math.min(1, 1.6 / perp));
    ctx.fillStyle = shadeColor(color, shade);
    ctx.fillRect(col, y0, 1, y1 - y0);
  }

  renderSprites(dirX, dirY, planeX, planeY);
  renderGun();
  if (redFlash > 0) {                               // damage / mistimed-block flash
    ctx.fillStyle = `rgba(180,0,0,${0.55 * Math.min(1, redFlash / 0.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (mapVisible) drawMap();
}

function drawMap() {
  const pad = 24;
  const cs = Math.floor(Math.min((W - pad * 2) / MAP_W, (H - pad * 2) / MAP_H));
  const ox = Math.floor((W - cs * MAP_W) / 2);
  const oy = Math.floor((H - cs * MAP_H) / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const c = cell(x, y);
      let col;
      if (c === 0) col = '#161b20';
      else if (c === 5) col = doorIsOpen(x, y) ? '#3a2e1a' : '#caa15a';
      else if (c === 6) col = '#e23b3b';
      else col = (WALL_COLORS[c] || WALL_COLORS[1]).y;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * cs, oy + y * cs, cs - 1, cs - 1);
    }
  }

  for (const p of pickups) if (!p.taken) {
    ctx.fillStyle = p.kind === 'health' ? '#ff6b6b' : '#58c172';
    ctx.fillRect(ox + p.x * cs - 3, oy + p.y * cs - 3, 6, 6);
  }
  for (const e of enemies) if (!e.dead) {
    ctx.fillStyle = e.boss ? '#ffe21f' : '#ff4d4d';
    const r = e.boss ? 5 : 3;
    ctx.fillRect(ox + e.x * cs - r, oy + e.y * cs - r, r * 2, r * 2);
  }

  const px2 = ox + player.x * cs, py2 = oy + player.y * cs;
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(px2, py2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px2, py2);
  ctx.lineTo(px2 + Math.cos(player.dir) * 16, py2 + Math.sin(player.dir) * 16);
  ctx.stroke();

  ctx.fillStyle = '#ffd34d';
  ctx.font = '16px monospace';
  ctx.fillText('AUTOMAP  —  TAB to close', ox, Math.max(18, oy - 8));
}

function shadeColor(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, r * f) | 0; g = Math.min(255, g * f) | 0; b = Math.min(255, b * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// Hell Knight fist rectangles in sprite space (must match drawHellKnight)
// — the attack telegraph glows only on the fists.
const HK_FISTS = [[12, 96, 16, 14], [68, 96, 16, 14]];

// billboarded sprites (enemies + pickups + projectiles), sorted far→near
function renderSprites(dirX, dirY, planeX, planeY) {
  const list = [];
  for (const e of enemies) if (!e.dead) list.push({ ref: e, spr: SPRITES[e.type] });
  for (const p of pickups) if (!p.taken) list.push({ ref: p, spr: SPRITES[p.kind] || SPRITES.bullets });
  for (const pr of projectiles) list.push({ ref: pr, spr: SPRITES[pr.spr] || SPRITES.orb });

  for (const o of list) {
    const dx = o.ref.x - player.x, dy = o.ref.y - player.y;
    o.ref.dist = dx * dx + dy * dy;
  }
  list.sort((a, b) => b.ref.dist - a.ref.dist);

  const invDet = 1 / (planeX * dirY - dirX * planeY);

  for (const o of list) {
    const spr = o.spr;
    if (!spr) continue;
    const relX = o.ref.x - player.x;
    const relY = o.ref.y - player.y;
    const transX = invDet * (dirY * relX - dirX * relY);
    const transY = invDet * (-planeY * relX + planeX * relY); // depth
    if (transY <= 0.2) continue;

    const sc = o.ref.scale || 1;
    const screenX = Math.floor((W / 2) * (1 + transX / transY));
    const sprH = Math.abs(Math.floor(H / transY)) * sc;
    const sprW = Math.floor(sprH * (spr.w / spr.h));
    if (sprW <= 0) continue;

    const drawStartY = Math.floor(-sprH / 2 + H / 2);
    const drawStartX = Math.floor(-sprW / 2 + screenX);

    const img = (o.ref.hurt && o.ref.hurt > 0) ? spr.flash : spr.canvas;
    const fog = 1 - Math.max(0.4, Math.min(1, 2.0 / transY));
    const srcStep = spr.w / sprW;

    spriteBuf.width = spr.w; spriteBuf.height = spr.h;
    spriteBufCtx.drawImage(img, 0, 0);
    if (fog > 0.02) {
      spriteBufCtx.globalCompositeOperation = 'source-atop';
      spriteBufCtx.fillStyle = `rgba(0,0,0,${fog})`;
      spriteBufCtx.fillRect(0, 0, spr.w, spr.h);
      spriteBufCtx.globalCompositeOperation = 'source-over';
    }
    // attack-telegraph glow (Hell Knight): green → yellow → red, fists only
    if (o.ref.glow) {
      spriteBufCtx.globalCompositeOperation = 'source-atop';
      spriteBufCtx.fillStyle = o.ref.glow;
      for (const [fx, fy, fw, fh] of HK_FISTS) spriteBufCtx.fillRect(fx, fy, fw, fh);
      spriteBufCtx.globalCompositeOperation = 'source-over';
    }

    for (let sx = 0; sx < sprW; sx++) {
      const col = drawStartX + sx;
      if (col < 0 || col >= W) continue;
      if (transY >= zBuffer[col]) continue;
      ctx.drawImage(spriteBuf, sx * srcStep, 0, srcStep, spr.h, col, drawStartY, 1, sprH);
    }
  }
}

// ---- the gun (first-person weapon) -------------------------------
let gunKick = 0;
let muzzle = 0;
let redFlash = 0;   // full-screen red flash (heavy damage / mistimed block)
function renderGun() {
  const s = H / 400;
  const cx = W / 2;
  const baseY = H - 4 + gunKick;

  if (player.weapon === 'shotgun') {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(cx - 28 * s, baseY - 50 * s, 56 * s, 50 * s);
    ctx.fillStyle = '#5a4326';
    ctx.fillRect(cx - 28 * s, baseY - 50 * s, 56 * s, 8 * s);
    ctx.fillStyle = '#222';
    ctx.fillRect(cx - 22 * s, baseY - 96 * s, 18 * s, 50 * s);
    ctx.fillRect(cx + 4 * s, baseY - 96 * s, 18 * s, 50 * s);
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 22 * s, baseY - 98 * s, 44 * s, 6 * s);
    if (muzzle > 0) {
      ctx.fillStyle = muzzle > 0.12 ? '#fff3b0' : '#ffcc33';
      const r = (18 + muzzle * 80) * s;
      ctx.beginPath(); ctx.arc(cx - 13 * s, baseY - 100 * s, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 13 * s, baseY - 100 * s, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (player.weapon === 'smg') {
    // boxy SMG body with a stick magazine
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(cx - 18 * s, baseY - 64 * s, 36 * s, 64 * s);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(cx - 18 * s, baseY - 64 * s, 36 * s, 7 * s);   // top rail
    ctx.fillStyle = '#15171b';
    ctx.fillRect(cx - 6 * s, baseY - 86 * s, 12 * s, 26 * s);   // barrel/shroud
    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(cx - 26 * s, baseY - 40 * s, 12 * s, 40 * s);  // magazine
    if (muzzle > 0) {
      ctx.fillStyle = muzzle > 0.05 ? '#fff3b0' : '#ffcc33';
      const r = (9 + muzzle * 70) * s;
      ctx.beginPath(); ctx.arc(cx, baseY - 90 * s, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (player.weapon === 'chainsaw') {
    // body + a toothed bar; teeth scroll while the trigger is held
    ctx.fillStyle = '#9c2a2a';
    ctx.fillRect(cx - 26 * s, baseY - 44 * s, 52 * s, 44 * s);  // engine body
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(cx - 26 * s, baseY - 44 * s, 52 * s, 8 * s);
    ctx.fillStyle = '#777';
    ctx.fillRect(cx - 10 * s, baseY - 104 * s, 20 * s, 64 * s); // bar
    // chain teeth
    const moving = triggerHeld ? (gunKick * 4) : 0;
    ctx.fillStyle = '#d8d8d8';
    for (let i = 0; i < 8; i++) {
      const ty = baseY - 100 * s + (((i * 9 + moving) % 64)) * s;
      ctx.fillRect(cx - 14 * s, ty, 6 * s, 5 * s);
      ctx.fillRect(cx + 8 * s, ty, 6 * s, 5 * s);
    }
  } else if (player.weapon === 'knife') {
    if (isBlocking()) {
      // raised guard: blade held high
      ctx.fillStyle = '#cfd3d8';
      ctx.fillRect(cx - 44 * s, baseY - 150 * s, 96 * s, 12 * s);  // blade (horizontal)
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(cx + 50 * s, baseY - 154 * s, 16 * s, 20 * s);  // handle
    } else {
      // swing: the blade lunges forward as gunKick decays
      const off = gunKick * 6 * s;
      ctx.save();
      ctx.translate(cx + 26 * s - off, baseY - 6 * s - off);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-8 * s, -8 * s, 16 * s, 46 * s);               // handle
      ctx.fillStyle = '#cfd3d8';                                  // blade
      ctx.beginPath();
      ctx.moveTo(-7 * s, -8 * s); ctx.lineTo(7 * s, -8 * s); ctx.lineTo(0, -72 * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else {
    // pistol
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(cx - 16 * s, baseY - 60 * s, 32 * s, 60 * s);
    ctx.fillStyle = '#444';
    ctx.fillRect(cx - 10 * s, baseY - 78 * s, 20 * s, 22 * s);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(cx - 5 * s, baseY - 84 * s, 10 * s, 8 * s);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 14 * s, baseY - 56 * s, 6 * s, 50 * s);
    if (muzzle > 0) {
      ctx.fillStyle = muzzle > 0.05 ? '#fff3b0' : '#ffcc33';
      const r = (10 + muzzle * 60) * s;
      ctx.beginPath(); ctx.arc(cx, baseY - 88 * s, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (muzzle <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(cx - 6, H / 2, 12, 1);
    ctx.fillRect(cx, H / 2 - 6, 1, 12);
  }

  // contextual prompt for the door/exit in front of you
  if (running) {
    const f = frontCell();
    if (f) {
      let label = null;
      if (f.c === 5) label = doorIsOpen(f.x, f.y) ? '[E] close door' : '[E] open door';
      else if (f.c === 6) label = exitReady ? '[E] exit to next level' : '[E] exit (locked)';
      if (label) {
        ctx.fillStyle = f.c === 6 ? '#ff6b6b' : '#ffd34d';
        ctx.font = `${Math.round(16 * s)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, H / 2 + 28 * s);
        ctx.textAlign = 'left';
      }
    }
  }
}

// ---- shooting ----------------------------------------------------
let playerFireCd = 0;
function killCheck(e) {
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.glow = null;
    if (e.boss) flashMsg('PAC-MAN DESTROYED');
    else if (e.knight) flashMsg('HELL KNIGHT slain');
    else if (e.type === 'soldier') flashMsg('soldier down');
    else flashMsg(e.type.toUpperCase() + ' decommissioned');
  }
}
function shoot() {
  if (!running || playerFireCd > 0) return;
  const w = WEAPONS[player.weapon];

  if (w.melee) {                       // chainsaw / knife
    playerFireCd = w.cd;
    gunKick = w.kick;
    chainsawHit(w);
    if (player.weapon === 'knife') playKnifeSound();
    else playChainsawTick();
    return;
  }

  if (player[w.ammo] <= 0) { flashMsg('*click* — out of ammo'); playerFireCd = 0.25; return; }
  player[w.ammo]--;
  muzzle = w.muzzle;
  gunKick = w.kick;
  playerFireCd = w.cd;

  for (let i = 0; i < w.pellets; i++) {
    const ang = player.dir + (Math.random() * 2 - 1) * w.spread;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    projectiles.push({
      x: player.x + dx * 0.35, y: player.y + dy * 0.35,
      dx, dy, spd: w.projSpd, life: 1.4, dmg: w.dmg,
      friendly: true, spr: w.spr, scale: w.projScale, dist: 0,
    });
  }
  playGunSound(w);
  updateHud();
}

function chainsawHit(w) {
  const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
  for (const e of enemies) {
    if (e.dead || e.immortal) continue;          // the Reaper can't be cut
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    if (dist > w.range) continue;
    const dot = (dx / dist) * dirX + (dy / dist) * dirY;
    if (dot < w.cone) continue;
    if (wallBetween(player.x, player.y, e.x, e.y)) continue;
    const wasAlive = !e.dead;
    e.hp -= w.dmg; e.hurt = 0.12;
    killCheck(e);
    // chainsaw kills scavenge ammo for every gun
    if (player.weapon === 'chainsaw' && wasAlive && e.dead) {
      player.bullets += 8; player.shells += 3; player.smgAmmo += 20;
      flashMsg('ammo scavenged!');
      updateHud();
    }
  }
}

function wallBetween(x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

// ---- movement & collision ----------------------------------------
function tryMove(nx, ny) {
  const pad = 0.18;
  if (!isWall(nx + Math.sign(nx - player.x) * pad, player.y)) player.x = nx;
  if (!isWall(player.x, ny + Math.sign(ny - player.y) * pad)) player.y = ny;
}

function updatePlayer(dt) {
  let fwd = 0, strafe = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
  if (keys['KeyA']) strafe -= 1;
  if (keys['KeyD']) strafe += 1;
  if (keys['ArrowLeft']) player.dir -= 2.2 * dt;
  if (keys['ArrowRight']) player.dir += 2.2 * dt;

  const sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.7 : 1;
  const spd = player.speed * sprint * dt;
  const dirX = Math.cos(player.dir), dirY = Math.sin(player.dir);
  const nx = player.x + (dirX * fwd - dirY * strafe) * spd;
  const ny = player.y + (dirY * fwd + dirX * strafe) * spd;
  if (fwd || strafe) tryMove(nx, ny);

  for (const p of pickups) {
    if (p.taken) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 0.5) {
      p.taken = true;
      if (p.kind === 'shells') { player.shells += 4; flashMsg('+4 shells'); }
      else if (p.kind === 'smg') { player.smgAmmo += 30; flashMsg('+30 SMG ammo'); }
      else if (p.kind === 'health') { player.hp = Math.min(100, player.hp + 25); flashMsg('+25 health'); }
      else { player.bullets += 12; flashMsg('+12 bullets'); }
      updateHud();
    }
  }
}

function moveEnemy(e, ux, uy, step) {
  const mx = e.x + ux * step, my = e.y + uy * step;
  if (!isWall(mx, e.y)) e.x = mx;
  if (!isWall(e.x, my)) e.y = my;
}

// out of sight: roam, repicking direction on a timer or when blocked
function wander(e, dt) {
  e.wanderCd -= dt;
  if (e.wanderCd <= 0) { e.wanderDir = Math.random() * Math.PI * 2; e.wanderCd = 1 + Math.random() * 2.5; }
  const bx = e.x, by = e.y;
  moveEnemy(e, Math.cos(e.wanderDir), Math.sin(e.wanderDir), e.speed * 0.5 * dt);
  if (e.x === bx && e.y === by) e.wanderCd = 0;   // hit a wall → turn next frame
}

// is the player facing (roughly toward) this enemy? — for block/parry
function playerFacing(e) {
  const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1e-6;
  return (dx / d) * Math.cos(player.dir) + (dy / d) * Math.sin(player.dir) > 0.3;
}

function hurtPlayer(amount, msg) {
  player.hp -= amount;
  flashMsg(msg);
  if (player.hp <= 0) { player.hp = 0; endGame(false); }
  updateHud();
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.hurt > 0) e.hurt -= dt;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / dist, uy = dy / dist;
    const sees = !wallBetween(e.x, e.y, player.x, player.y);

    if (e.reaper) {
      // immortal, omniscient: always charges you; touch = instant death
      if (dist > 0.5) moveEnemy(e, ux, uy, e.speed * dt);
      if (dist < 0.7) { player.hp = 0; flashMsg('THE REAPER CLAIMS YOU'); endGame(false); }
      continue;
    }

    if (e.knight) {
      updateHellKnight(e, dt, dist, ux, uy, sees);
      continue;
    }

    if (e.ranged) {
      if (sees) {
        if (e.boss) {
          if (dist > 2.4) moveEnemy(e, ux, uy, e.speed * dt);          // lumber toward you
        } else {
          if (dist > 6.5) moveEnemy(e, ux, uy, e.speed * dt);          // close in
          else if (dist < 3) moveEnemy(e, -ux, -uy, e.speed * dt);     // back off
        }
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < (e.boss ? 18 : 12)) { fireProjectile(e); e.fireCd = e.fireRate; }
      } else {
        wander(e, dt);                                                 // search
      }
    } else if (sees) {
      if (dist > 0.6) moveEnemy(e, ux, uy, e.speed * dt);              // stalk
    } else {
      wander(e, dt);                                                   // search
    }

    // melee contact damage (knights handle their own attacks)
    const reach = 0.6 * (e.scale || 1);
    if (dist < reach) {
      hurtPlayer((e.boss ? 40 : 22) * dt, e.boss ? 'PAC-MAN CHOMP!' : 'JUMPSCARE!');
    }
  }

  // when the roster is down, either wake the boss or unlock the exit (+ Reaper)
  if (!exitReady && enemies.length && enemies.every(e => e.dead || e.reaper)) {
    if (pendingBoss && !bossSpawned) {
      bossSpawned = true;
      spawnBoss(pendingBoss);
      flashMsg('PAC-MAN AWAKENS');
      updateHud();
    } else {
      exitReady = true;
      flashMsg('EXIT UNLOCKED — RUN! the Reaper is coming');
      spawnReaper();
      updateHud();
    }
  }
}

// Hell Knight: approach, then a slow telegraphed strike you can parry.
//   green  (windup)  → yellow (parry window) → strike or, if parried, red (stagger).
// Blocking during the yellow window deals damage and turns it red.
const HK_RANGE = 1.7;
function updateHellKnight(e, dt, dist, ux, uy, sees) {
  if (e.atkState === null) {
    if (e.atkCd > 0) e.atkCd -= dt;
    if (sees && e.atkCd <= 0 && dist <= HK_RANGE) {
      e.atkState = 'green'; e.atkTimer = 0.75; e.glow = 'rgba(40,255,80,0.5)';   // telegraph
    } else if (sees) {
      moveEnemy(e, ux, uy, e.speed * dt);                                        // approach
    } else {
      wander(e, dt);
    }
    return;
  }

  if (e.atkState === 'green') {
    // blocking too early (during the green windup) is punished hard
    if (isBlocking() && playerFacing(e) && dist < HK_RANGE + 0.9) {
      redFlash = 0.5;
      hurtPlayer(40, 'TOO EARLY!');
      e.atkState = null; e.atkCd = 1.4; e.glow = null;
      return;
    }
    e.atkTimer -= dt;
    if (e.atkTimer <= 0) { e.atkState = 'yellow'; e.atkTimer = 0.55; e.glow = 'rgba(255,220,40,0.55)'; }
  } else if (e.atkState === 'yellow') {
    e.atkTimer -= dt;
    if (isBlocking() && playerFacing(e) && dist < HK_RANGE + 0.9) {
      e.hp -= 8; e.hurt = 0.2;                          // PARRIED — punish it
      e.atkState = 'red'; e.atkTimer = 1.2; e.glow = 'rgba(255,40,40,0.6)';
      flashMsg('PARRY!'); playParrySound();
      killCheck(e);
    } else if (e.atkTimer <= 0) {                       // strike lands
      if (dist < HK_RANGE + 0.4) {
        const dmg = (isBlocking() && playerFacing(e)) ? 12 : 30;   // blocking still softens it
        hurtPlayer(dmg, 'Hell Knight strikes!');
      }
      e.atkState = null; e.atkCd = 1.6; e.glow = null;
    }
  } else if (e.atkState === 'red') {                    // staggered after a parry
    e.atkTimer -= dt;
    if (e.atkTimer <= 0) { e.atkState = null; e.atkCd = 1.0; e.glow = null; }
  }
}

// ---- projectiles (player + enemy) --------------------------------
function fireProjectile(e) {
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
  projectiles.push({
    x: e.x, y: e.y, dx: dx / d, dy: dy / d, spd: e.projSpd, life: 5,
    dmg: e.projDmg, friendly: false, spr: e.projSpr, scale: e.projScale, dist: 0,
    owner: e,                              // who fired it — a deflect returns to sender
  });
  playShotSound(e.boss ? 110 : 220, e.boss ? 0.3 : 0.12, e.boss ? 'sawtooth' : 'square', 0.2);
}

function updateProjectiles(dt) {
  let dirty = false;
  for (const p of projectiles) {
    p.x += p.dx * p.spd * dt;
    p.y += p.dy * p.spd * dt;
    p.life -= dt;
    if (p.life <= 0 || isWall(p.x, p.y)) { p.dead = true; dirty = true; continue; }

    if (p.friendly) {
      for (const e of enemies) {
        if (e.dead || e.immortal) continue;   // the Reaper is untouchable
        // a deflected shot only harms the enemy that originally fired it
        if (p.deflected && p.owner && e !== p.owner) continue;
        const hitR = 0.45 * (e.scale || 1);
        if (Math.hypot(p.x - e.x, p.y - e.y) < hitR) {
          if (p.deflected) e.hp = 0;          // a deflected shot is a guaranteed kill
          else { e.hp -= p.dmg; e.hurt = 0.18; }
          killCheck(e);
          p.dead = true; dirty = true;
          break;
        }
      }
    } else if (Math.hypot(p.x - player.x, p.y - player.y) < 0.55) {
      // facing it while blocking → deflect it back; otherwise take the hit
      const toPx = (p.x - player.x), toPy = (p.y - player.y);
      const td = Math.hypot(toPx, toPy) || 1e-6;
      const facing = (toPx / td) * Math.cos(player.dir) + (toPy / td) * Math.sin(player.dir) > 0.3;
      if (isBlocking() && facing) {
        deflect(p);
      } else {
        p.dead = true; dirty = true;
        const dmg = (isBlocking() && facing) ? p.dmg * 0.4 : p.dmg;
        hurtPlayer(dmg, 'hit! -' + Math.round(dmg));
      }
    }
  }
  if (dirty) projectiles = projectiles.filter(p => !p.dead);
}

// turn a hostile shot into a friendly, one-shot-kill projectile that
// homes straight back at whoever fired it (reverses if the shooter is gone)
function deflect(p) {
  if (p.owner && !p.owner.dead) {
    const dx = p.owner.x - p.x, dy = p.owner.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.dx = dx / d; p.dy = dy / d;
  } else {
    p.dx = -p.dx; p.dy = -p.dy;
  }
  p.friendly = true; p.deflected = true; p.spd *= 1.6; p.life = 3;
  flashMsg('DEFLECT!'); playParrySound();
}

// ---- HUD & messages ----------------------------------------------
const hpEl = document.getElementById('hp');
const ammoEl = document.getElementById('ammo');
const weaponEl = document.getElementById('weapon');
const leftEl = document.getElementById('left');
const levelEl = document.getElementById('level');
const msgEl = document.getElementById('msg');
let msgTimer = 0;
function updateHud() {
  const w = WEAPONS[player.weapon];
  hpEl.textContent = Math.ceil(player.hp);
  weaponEl.textContent = w.name;
  ammoEl.textContent = w.ammo ? player[w.ammo] : '∞'; // ∞ for chainsaw / knife
  leftEl.textContent = enemies.filter(e => !e.dead && !e.reaper).length;
  if (levelEl) levelEl.textContent = (levelIndex + 1);
}
function flashMsg(t) { msgEl.textContent = t; msgEl.style.opacity = 1; msgTimer = 1.4; }

// ---- game loop ---------------------------------------------------
let running = false;
let last = 0;
function frame(t) {
  if (!last) last = t;
  let dt = (t - last) / 1000;
  last = t;
  if (dt > 0.05) dt = 0.05;

  if (running) {
    if (playerFireCd > 0) playerFireCd -= dt;
    if (triggerHeld && WEAPONS[player.weapon].auto) shoot(); // full-auto / chainsaw
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    if (gunKick > 0) gunKick = Math.max(0, gunKick - 60 * dt);
    if (muzzle > 0) muzzle -= dt;
    if (redFlash > 0) redFlash -= dt;
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) msgEl.style.opacity = 0; }
  }
  render();
  requestAnimationFrame(frame);
}

// ---- screens -----------------------------------------------------
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const hud = document.getElementById('hud');

function startGame() {
  levelIndex = 0;
  loadLevel(0);
  player.hp = 100;
  player.weapon = 'pistol';
  player.bullets = 24;
  player.shells = 6;
  player.smgAmmo = 60;
  triggerHeld = false;
  playerFireCd = 0;
  spawnEntities(LEVELS[0]);
  for (const k in doorState) delete doorState[k];
  mapVisible = false;
  initAudio();
  updateHud();
  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  running = true;
  canvas.requestPointerLock();
}

function endGame(won) {
  running = false;
  triggerHeld = false;
  document.exitPointerLock();
  document.getElementById('endTitle').textContent = won ? 'YOU ESCAPED' : 'GAME OVER';
  document.getElementById('endText').textContent = won
    ? 'Every floor cleared — animatronics and arcade alike. The night is yours.'
    : 'They got you. Try again?';
  endScreen.classList.remove('hidden');
  hud.classList.add('hidden');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// kick off the render loop (menu renders a frozen view too)
loadLevel(0);
spawnEntities(LEVELS[0]);
requestAnimationFrame(frame);

})();
