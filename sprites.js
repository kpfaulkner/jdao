/* sprites.js — procedurally drawn FNAF-style animatronics.
   Each builder paints onto an offscreen canvas with a transparent
   background, then we extract the raw RGBA buffer so the raycaster
   can billboard it (sampling per-column / per-row, skipping alpha==0).

   Canvas is "feet at the bottom, head at the top", roughly humanoid
   so it reads like a DOOM monster when drawn as a vertical billboard. */

const SPR_W = 96;
const SPR_H = 128;

function makeSpriteCanvas() {
  const c = document.createElement('canvas');
  c.width = SPR_W;
  c.height = SPR_H;
  return c;
}

// A white-tinted copy used for the damage flash when an enemy is hit.
function makeFlash(src) {
  const f = document.createElement('canvas');
  f.width = src.width; f.height = src.height;
  const fx = f.getContext('2d');
  fx.drawImage(src, 0, 0);
  fx.globalCompositeOperation = 'source-atop'; // tint only the opaque pixels
  fx.fillStyle = 'rgb(255,235,235)';
  fx.fillRect(0, 0, f.width, f.height);
  return f;
}

// Keep the live canvas (fast drawImage billboarding) plus its flash copy.
function extract(canvas) {
  return { w: canvas.width, h: canvas.height, canvas, flash: makeFlash(canvas) };
}

// little helpers ---------------------------------------------------
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Generic animatronic body. cfg lets each character vary.
function drawAnimatronic(ctx, cfg) {
  const cx = SPR_W / 2;
  const body = cfg.body;
  const belly = cfg.belly || cfg.body;
  const accent = cfg.accent;

  // --- torso ---
  px(ctx, cx - 26, 64, 52, 50, body);
  // belly patch
  px(ctx, cx - 16, 74, 32, 34, belly);
  // arms
  px(ctx, cx - 36, 66, 12, 40, body);
  px(ctx, cx + 24, 66, 12, 40, body);
  // hands
  px(ctx, cx - 37, 100, 14, 12, cfg.hand || body);
  px(ctx, cx + 23, 100, 14, 12, cfg.hand || body);
  // legs
  px(ctx, cx - 18, 112, 14, 14, body);
  px(ctx, cx + 4, 112, 14, 14, body);

  // bowtie / bib accent on chest
  if (cfg.bowtie) {
    px(ctx, cx - 10, 66, 20, 8, accent);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx, 70); ctx.lineTo(cx - 12, 62); ctx.lineTo(cx - 12, 78); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, 70); ctx.lineTo(cx + 12, 62); ctx.lineTo(cx + 12, 78); ctx.closePath(); ctx.fill();
  }
  if (cfg.bib) {
    px(ctx, cx - 18, 72, 36, 22, '#f2c14e');
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 9px monospace';
    ctx.fillText("LET'S", cx - 16, 82);
    ctx.fillText("EAT", cx - 11, 92);
  }

  // --- head ---
  const hy = 38;
  // ears / extras behind head
  if (cfg.ears === 'round') {
    ellipse(ctx, cx - 22, hy - 22, 11, 11, body);
    ellipse(ctx, cx + 22, hy - 22, 11, 11, body);
    ellipse(ctx, cx - 22, hy - 22, 5, 5, belly);
    ellipse(ctx, cx + 22, hy - 22, 5, 5, belly);
  } else if (cfg.ears === 'long') {
    px(ctx, cx - 20, hy - 46, 11, 36, body);
    px(ctx, cx + 9, hy - 46, 11, 36, body);
    px(ctx, cx - 18, hy - 42, 6, 28, cfg.inner || belly);
    px(ctx, cx + 11, hy - 42, 6, 28, cfg.inner || belly);
  } else if (cfg.ears === 'pointy') {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(cx - 24, hy - 8); ctx.lineTo(cx - 14, hy - 34); ctx.lineTo(cx - 6, hy - 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 24, hy - 8); ctx.lineTo(cx + 14, hy - 34); ctx.lineTo(cx + 6, hy - 10); ctx.closePath(); ctx.fill();
  }

  // head block
  ellipse(ctx, cx, hy, 28, 26, body);
  // muzzle / lower face
  ellipse(ctx, cx, hy + 12, 18, 13, belly);

  // top hat (Freddy)
  if (cfg.hat) {
    px(ctx, cx - 22, hy - 30, 44, 6, '#111');
    px(ctx, cx - 14, hy - 50, 28, 22, '#111');
    px(ctx, cx - 14, hy - 34, 28, 4, accent);
  }
  // eyepatch (Foxy)
  if (cfg.eyepatch) {
    px(ctx, cx + 4, hy - 6, 16, 16, '#111');
  }

  // eyes (glowing)
  const eyeGlow = cfg.eyeGlow || '#fff';
  ellipse(ctx, cx - 10, hy - 2, 7, 8, '#fff');
  ellipse(ctx, cx + 10, hy - 2, 7, 8, '#fff');
  ellipse(ctx, cx - 10, hy - 1, 3.5, 4, eyeGlow);
  ellipse(ctx, cx + 10, hy - 1, 3.5, 4, eyeGlow);
  ellipse(ctx, cx - 10, hy - 1, 1.6, 2, '#000');
  ellipse(ctx, cx + 10, hy - 1, 1.6, 2, '#000');

  // snout / beak / nose
  if (cfg.beak) {
    ctx.fillStyle = '#f08a1d';
    ctx.beginPath();
    ctx.moveTo(cx - 10, hy + 8); ctx.lineTo(cx + 10, hy + 8); ctx.lineTo(cx, hy + 18); ctx.closePath(); ctx.fill();
  } else {
    ellipse(ctx, cx, hy + 8, 4, 3, '#1a1a1a');
  }

  // mouth — animatronic teeth
  px(ctx, cx - 14, hy + 16, 28, 8, '#1a1a1a');
  for (let i = 0; i < 5; i++) {
    px(ctx, cx - 13 + i * 6, hy + 16, 4, 4, '#f7f3df');
  }
}

const CHARACTERS = {
  freddy: { body: '#7a4a23', belly: '#9c6a3c', accent: '#101010', ears: 'round', hat: true, bowtie: true, eyeGlow: '#cfe8ff', hand: '#623a1c' },
  bonnie: { body: '#6b4fb0', belly: '#9b86d6', accent: '#d23b3b', ears: 'long', inner: '#d6a8c8', bowtie: true, eyeGlow: '#ff5d5d' },
  chica:  { body: '#e7c43a', belly: '#f2db7a', accent: '#f08a1d', ears: 'none', beak: true, bib: true, eyeGlow: '#bff' },
  foxy:   { body: '#a83a2a', belly: '#c96b4a', accent: '#caa15a', ears: 'pointy', eyepatch: true, eyeGlow: '#ffd34d', hand: '#888' },
};

// Build all sprite buffers once at load.
const SPRITES = {};
for (const [name, cfg] of Object.entries(CHARACTERS)) {
  const c = makeSpriteCanvas();
  const ctx = c.getContext('2d');
  drawAnimatronic(ctx, cfg);
  SPRITES[name] = extract(c);
}

// Ammo boxes — bullets (green) and shotgun shells (red).
(function buildPickups() {
  const cx = SPR_W / 2;

  // bullets box
  let c = makeSpriteCanvas(); let ctx = c.getContext('2d');
  px(ctx, cx - 16, 84, 32, 34, '#2e6f3a');
  px(ctx, cx - 16, 84, 32, 7, '#58c172');
  px(ctx, cx - 4, 78, 8, 6, '#cfcfcf');
  ctx.fillStyle = '#eaffea'; ctx.font = 'bold 16px monospace';
  ctx.fillText('9mm', cx - 14, 106);
  SPRITES.bullets = extract(c);

  // shells box
  c = makeSpriteCanvas(); ctx = c.getContext('2d');
  px(ctx, cx - 16, 84, 32, 34, '#6e2424');
  px(ctx, cx - 16, 84, 32, 7, '#c0392b');
  // little shotgun shells poking out the top
  for (let i = 0; i < 3; i++) {
    px(ctx, cx - 12 + i * 9, 76, 6, 10, '#d23b3b');
    px(ctx, cx - 12 + i * 9, 76, 6, 4, '#caa15a'); // brass cap
  }
  ctx.fillStyle = '#ffecec'; ctx.font = 'bold 16px monospace';
  ctx.fillText('12g', cx - 12, 108);
  SPRITES.shells = extract(c);
})();

// Foxy's projectile — a small glowing orb (own small canvas for tight aspect).
(function buildOrb() {
  const s = 32;
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.4, '#ff8a1d');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
  SPRITES.orb = extract(c);
})();

// ---- Level-2 enemies: Pac-Man ghosts + a Pac-Man miniboss --------
// Ghosts: a domed head with a wavy skirt and two big eyes (the classic
// arcade silhouette). Pac-Man: a yellow disc with a wedge mouth.
function drawGhost(ctx, color) {
  const cx = SPR_W / 2, top = 30, r = 30, by = top + 64;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r, by);
  ctx.lineTo(cx - r, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0);            // domed head
  ctx.lineTo(cx + r, by);
  const n = 4, fw = (2 * r) / n;                   // wavy skirt
  for (let i = 0; i < n; i++) {
    const xR = cx + r - i * fw;
    ctx.quadraticCurveTo(xR - fw / 2, by - 12, xR - fw, by);
  }
  ctx.closePath();
  ctx.fill();
  // eyes (whites + blue pupils)
  ellipse(ctx, cx - 11, top + 22, 8, 10, '#fff');
  ellipse(ctx, cx + 11, top + 22, 8, 10, '#fff');
  ellipse(ctx, cx - 11, top + 24, 4, 5, '#2a2adf');
  ellipse(ctx, cx + 11, top + 24, 4, 5, '#2a2adf');
}

function drawPacman(ctx) {
  const cx = SPR_W / 2, cy = 70, r = 46;
  ctx.fillStyle = '#ffe21f';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, 0.30 * Math.PI, 1.70 * Math.PI);  // wedge mouth (faces right)
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, cx - 6, cy - 28, 4, 6, '#1a1a1a');      // eye
}

const GHOSTS = { blinky: '#ff2b2b', pinky: '#ff9ddb', inky: '#34dff0', clyde: '#ff9a2b' };
for (const [name, color] of Object.entries(GHOSTS)) {
  const c = makeSpriteCanvas();
  drawGhost(c.getContext('2d'), color);
  SPRITES[name] = extract(c);
}
(function () {
  const c = makeSpriteCanvas();
  drawPacman(c.getContext('2d'));
  SPRITES.pacman = extract(c);
})();

// ---- pickups: SMG ammo (blue box) + health (medkit) --------------
(function buildMorePickups() {
  const cx = SPR_W / 2;
  // SMG ammo
  let c = makeSpriteCanvas(); let ctx = c.getContext('2d');
  px(ctx, cx - 16, 84, 32, 34, '#2b3a55');
  px(ctx, cx - 16, 84, 32, 7, '#5b7fb3');
  px(ctx, cx - 4, 78, 8, 6, '#cfcfcf');
  ctx.fillStyle = '#dce9ff'; ctx.font = 'bold 14px monospace';
  ctx.fillText('SMG', cx - 13, 106);
  SPRITES.smg = extract(c);
  // health medkit
  c = makeSpriteCanvas(); ctx = c.getContext('2d');
  px(ctx, cx - 18, 82, 36, 32, '#f4f4f4');
  px(ctx, cx - 18, 82, 36, 6, '#d23b3b');
  px(ctx, cx - 3, 90, 6, 18, '#d23b3b');   // cross
  px(ctx, cx - 11, 96, 22, 6, '#d23b3b');
  SPRITES.health = extract(c);
})();

// ---- projectiles: player tracers + Pac-Man's heavy orb -----------
(function buildProjectiles() {
  function dot(size, inner, mid, outer) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2 - 1);
    g.addColorStop(0, inner); g.addColorStop(0.5, mid); g.addColorStop(1, outer);
    x.fillStyle = g;
    x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); x.fill();
    return extract(c);
  }
  SPRITES.shot   = dot(14, '#ffffff', '#ffe66b', 'rgba(255,200,40,0)');  // pistol / smg tracer
  SPRITES.pellet = dot(12, '#fff0c0', '#ff9a3d', 'rgba(255,120,0,0)');   // shotgun pellet
  SPRITES.bigorb = dot(48, '#ffffff', '#ff5a2a', 'rgba(200,0,0,0)');     // Pac-Man heavy shot
})();

// ---- Level-3 enemies: Wolfenstein soldier + DOOM Hell Knight -----
// A grey-uniformed guard with a rifle.
function drawSoldier(ctx) {
  const cx = SPR_W / 2;
  px(ctx, cx - 11, 104, 9, 22, '#2f333b');   // legs
  px(ctx, cx + 2, 104, 9, 22, '#2f333b');
  px(ctx, cx - 12, 124, 11, 4, '#111');       // boots
  px(ctx, cx + 1, 124, 11, 4, '#111');
  px(ctx, cx - 18, 64, 36, 44, '#4a5168');    // torso uniform
  px(ctx, cx - 18, 98, 36, 6, '#23262e');     // belt
  px(ctx, cx - 22, 68, 8, 34, '#4a5168');     // left arm
  px(ctx, cx + 14, 70, 8, 30, '#4a5168');     // right arm
  px(ctx, cx + 16, 84, 28, 5, '#222');        // rifle barrel
  px(ctx, cx + 16, 80, 6, 9, '#3a2a1a');      // rifle stock
  ellipse(ctx, cx, 46, 13, 14, '#d9b48f');    // face
  px(ctx, cx - 14, 30, 28, 11, '#5b6172');    // helmet brim
  ellipse(ctx, cx, 36, 15, 9, '#5b6172');     // helmet dome
  ellipse(ctx, cx - 5, 46, 2, 2.5, '#222');   // eyes
  ellipse(ctx, cx + 5, 46, 2, 2.5, '#222');
}

// A hulking horned brute. Its menace comes from the attack telegraph
// (a colored glow applied at render time), not the base sprite.
function drawHellKnight(ctx) {
  const cx = SPR_W / 2;
  px(ctx, cx - 16, 100, 13, 26, '#6b5a48');   // legs
  px(ctx, cx + 3, 100, 13, 26, '#6b5a48');
  px(ctx, cx - 17, 124, 15, 4, '#2a2118');    // feet
  px(ctx, cx + 2, 124, 15, 4, '#2a2118');
  px(ctx, cx - 24, 58, 48, 46, '#7a6552');    // torso
  px(ctx, cx - 24, 58, 48, 8, '#9c8468');     // chest highlight
  px(ctx, cx - 14, 70, 28, 26, '#5a4a3a');    // ab plates
  px(ctx, cx - 34, 60, 12, 40, '#6b5a48');    // arms
  px(ctx, cx + 22, 60, 12, 40, '#6b5a48');
  px(ctx, cx - 36, 96, 16, 14, '#4a3c2e');    // fists
  px(ctx, cx + 20, 96, 16, 14, '#4a3c2e');
  ellipse(ctx, cx, 40, 20, 20, '#6b5a48');    // head
  ctx.fillStyle = '#e8e2d0';                  // horns
  ctx.beginPath(); ctx.moveTo(cx - 18, 28); ctx.lineTo(cx - 30, 6); ctx.lineTo(cx - 10, 22); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 18, 28); ctx.lineTo(cx + 30, 6); ctx.lineTo(cx + 10, 22); ctx.closePath(); ctx.fill();
  ellipse(ctx, cx - 8, 40, 4, 5, '#ffd34d');  // glowing eyes
  ellipse(ctx, cx + 8, 40, 4, 5, '#ffd34d');
  px(ctx, cx - 10, 52, 20, 6, '#2a1a12');     // mouth
  for (let i = 0; i < 4; i++) px(ctx, cx - 9 + i * 6, 52, 3, 4, '#e8e2d0');
}

{ const c = makeSpriteCanvas(); drawSoldier(c.getContext('2d')); SPRITES.soldier = extract(c); }
{ const c = makeSpriteCanvas(); drawHellKnight(c.getContext('2d')); SPRITES.hellknight = extract(c); }

// ---- the Grim Reaper: a hooded cloak, glowing eyes, and a scythe ---
function drawReaper(ctx) {
  const cx = SPR_W / 2;
  ctx.fillStyle = '#15151a';                  // cloak body
  ctx.beginPath();
  ctx.moveTo(cx - 10, 26); ctx.lineTo(cx + 10, 26);
  ctx.lineTo(cx + 30, 126); ctx.lineTo(cx - 30, 126);
  ctx.closePath(); ctx.fill();
  px(ctx, cx - 30, 52, 10, 42, '#101015');    // sleeve
  ctx.fillStyle = '#0c0c10';                  // hood
  ctx.beginPath(); ctx.ellipse(cx, 30, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';                      // face void
  ctx.beginPath(); ctx.ellipse(cx, 34, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
  ellipse(ctx, cx - 5, 34, 3, 4, '#ff2b2b');  // glowing eyes
  ellipse(ctx, cx + 5, 34, 3, 4, '#ff2b2b');
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 4;   // scythe shaft
  ctx.beginPath(); ctx.moveTo(cx + 26, 16); ctx.lineTo(cx + 18, 120); ctx.stroke();
  ctx.fillStyle = '#cfd3d8';                        // scythe blade
  ctx.beginPath();
  ctx.moveTo(cx + 26, 16);
  ctx.quadraticCurveTo(cx + 58, 18, cx + 50, 0);
  ctx.quadraticCurveTo(cx + 40, 10, cx + 26, 10);
  ctx.closePath(); ctx.fill();
}
{ const c = makeSpriteCanvas(); drawReaper(c.getContext('2d')); SPRITES.reaper = extract(c); }
