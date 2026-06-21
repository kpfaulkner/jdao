# SCHOOLNIGHTS — Design

## Concept

A web-based, DOOM-1993-style 3D shooter:

- **Rendering** reminiscent of *DOOM* (1993) — a software-style raycaster, first-person.
- **Three levels**: ① a *Baldi's Basics*-style schoolhouse with *Five Nights at Freddy's* animatronics (Freddy, Bonnie, Chica, Foxy); ② a blue *Pac-Man* lattice maze with the four ghosts (Blinky, Pinky, Inky, Clyde) and a **Pac-Man miniboss that only wakes once the ghosts are dead**; ③ a **WW2 bunker** with *Wolfenstein* soldiers and fast, parry-able *DOOM* **Hell Knights**.
- **Arsenal**: pistol, shotgun, full-auto SMG, and a melee chainsaw — every gun fires a visible travelling projectile, and **chainsaw kills scavenge ammo for every gun**. Level 3 is **knife-only**, with a right-click **block** that deflects bullets back at their shooter and parries Hell Knights.
- **AI**: enemies chase on sight and **wander to search** when they lose line of sight.
- **Progression**: clear every enemy on a level to unlock its **red exit door**. The moment it unlocks, an immortal, instant-kill **Grim Reaper** spawns and hunts you to the door. Clear the last level to win.

The whole game runs in the browser from three files with no build step or dependencies.

---

## Files

| File | Role |
|------|------|
| `index.html` | Page shell, CSS, HUD/overlay DOM, and the `<canvas>`. Loads the two scripts. |
| `sprites.js` | Procedurally draws every sprite (animatronics, ghosts, Pac-Man, ammo/health pickups, projectiles) onto offscreen canvases at load time. Exposes the global `SPRITES`. |
| `game.js` | Everything else: the map, raycaster, player/enemy/projectile logic, input, audio, HUD, and the game loop. Wrapped in an IIFE. |

`index.html` loads `sprites.js` **before** `game.js`, so the `SPRITES` table exists before the renderer references it.

---

## `index.html`

- A single fixed-size canvas (`960 × 600`) scaled to fill the viewport with `object-fit: contain` and `image-rendering: pixelated` for a crisp, low-res pixel-art look.
- **HUD** (`#hud`): three readouts — `HEALTH`, current `WEAPON` + ammo, and enemies `LEFT`. Updated by `updateHud()`.
- **Overlays**: `#startScreen` (title + controls) and `#endScreen` (win/lose). Toggled via the `.hidden` class.
- `#msg`: a transient center-top toast for events (pickups, doors, kills, jumpscares), faded in/out by `flashMsg()`.

---

## `sprites.js` — procedural sprites

No image assets exist. Every sprite is drawn with canvas 2D primitives onto a transparent offscreen canvas, then stored so the raycaster can billboard it.

- Sprite canvases are `96 × 128` (`SPR_W × SPR_H`), shaped "feet at bottom, head at top" so they read like a vertical DOOM monster.
- `drawAnimatronic(ctx, cfg)` paints a generic humanoid animatronic — torso, belly patch, arms, hands, legs, head, glowing eyes, animatronic teeth — and varies details from a `cfg`: ears (`round`/`long`/`pointy`/`none`), top hat, bowtie, bib, beak, eyepatch, and colors.
- `CHARACTERS` defines the four animatronics:
  - **freddy** — brown bear, round ears, top hat, bowtie.
  - **bonnie** — purple bunny, long ears, bowtie.
  - **chica** — yellow chicken, beak, `LET'S EAT` bib.
  - **foxy** — red fox, pointy ears, eyepatch.
- `drawGhost()` paints the level-2 Pac-Man ghosts (`blinky`/`pinky`/`inky`/`clyde`) — a domed head, wavy skirt, and big eyes. `drawPacman()` paints the miniboss as a yellow disc with a wedge mouth.
- `drawSoldier()` paints the level-3 Wolfenstein guard (grey uniform, helmet, rifle). `drawHellKnight()` paints the horned brute — its attack telegraph is a render-time glow on the **fists** only, not the base sprite. `drawReaper()` paints the hooded Grim Reaper with glowing eyes and a scythe.
- `extract(canvas)` returns `{ w, h, canvas, flash }`. `makeFlash()` creates a white-tinted copy (using `source-atop` so only opaque pixels are tinted) shown briefly when an enemy is hit.
- Pickup sprites: `bullets` (green "9mm"), `shells` (red "12g"), `smg` (blue "SMG" box), and `health` (white medkit with a red cross).
- Projectile sprites (small radial-gradient dots): `shot` (pistol/SMG tracer), `pellet` (shotgun), `orb` (Foxy), and `bigorb` (Pac-Man's heavy shot).

All of this runs once at load; the result is the global `SPRITES` map keyed by name.

---

## `game.js`

### Levels, maps & themes

The game has three levels, defined in `LEVELS` (each carries its map, theme, enemy roster, ammo/health counts, and an optional `knifeOnly` flag). `loadLevel(i)` sets the active `MAP`, dimensions, and palette (and forces the knife on knife-only levels).

Each map is an array of strings where each character is a tile code:

| Code | Meaning | Color theme |
|------|---------|-------------|
| `0` | open floor (hallway / room) | — |
| `1` | standard wall | green (school) / blue (arcade) |
| `2` | locker wall | grey metal |
| `3` | chalkboard wall | dark classroom green |
| `4` | exit door marker | yellow |
| `5` | openable door (starts closed) | wood/brass |
| `6` | **red level-exit door** | red |

- **Level 1** (`SCHOOL_MAP`, `school` theme): six classrooms (chalkboard back walls) off a central east-west hallway, doors (`5`) into each room, lockers (`2`) lining the hall — the *Baldi's Basics* feel. A red exit door (`6`) sits at the east end of the hallway.
- **Level 2** (`genArcadeMap()`, `arcade` theme): a procedurally generated *Pac-Man*-style lattice — 2×2 wall blocks separated by a connected grid of corridors, blue walls, dark floor/ceiling, with a red exit door on the east wall.
- **Level 3** (`genBunkerMap()`, `bunker` theme): a WW2 bunker — a large concrete room with 2×2 cover pillars (`2`) and partial interior dividers (with gaps so it stays traversable), grey walls, and a red exit door on the east wall.

`THEMES` maps each theme to its wall palette (`{x,y}` face shades per code) and flat ceiling/floor colors.

Helpers:
- `cell(x, y)` returns the code at a tile (out-of-bounds → `1`, treated as wall).
- `isWall(x, y)` is `true` for any non-zero tile **except** an open door — so open doors are passable; the red exit door (`6`) is solid and handled via interaction.

### Raycasting renderer (`render`)

Classic DDA grid raycaster, one ray per screen column (`W = 960` columns):

1. Fill ceiling (top half) and floor (bottom half) with flat colors — the bright, fluorescent-lit school look (no textured floors/ceilings).
2. Build a camera/direction basis from `player.dir` and `player.fov` (60°); the camera plane is perpendicular to the view direction, scaled by `tan(fov/2)`.
3. For each column, cast a ray and step through the grid (DDA) until it hits a wall tile (open doors are skipped — you can see through them).
4. Compute **perpendicular** distance (not euclidean) to avoid the fisheye effect; store it in `zBuffer[col]` for sprite occlusion.
5. Draw a vertical wall slice whose height ∝ `1/distance`. Color comes from `WALL_COLORS[code]`, with `x`/`y` variants giving slightly different shades to N–S vs E–W faces, then darkened by distance via `shadeColor()` (a cheap distance-fog/shading effect).

### Sprite rendering (`renderSprites`)

Enemies, pickups, and projectiles are billboards drawn after the walls:

1. Collect all live sprites, compute squared distance to the player, and sort far→near (painter's algorithm).
2. Transform each sprite into camera space using the inverse of the direction/plane matrix to get its on-screen X and depth.
3. Pre-shade the sprite by distance into an offscreen buffer (`spriteBuf`) using `source-atop`, so only opaque pixels darken — no black box around the transparent sprite.
4. Draw the sprite one 1px-wide vertical slice at a time, **skipping any column where the sprite's depth is behind `zBuffer[col]`** — so walls correctly occlude enemies.
5. Hurt enemies (`hurt > 0`) draw their white `flash` canvas instead of the normal one.

### Player & input

`player` holds position, direction, `fov`, `hp`, current `weapon`, and `bullets`/`shells` ammo.

- **Movement** (`updatePlayer`): WASD / arrows for move+strafe, mouse (pointer lock) or arrow keys to turn, Shift to sprint (1.7×). `tryMove()` does axis-separated collision against `isWall` with a small padding so the player slides along walls instead of sticking.
- **Pointer lock**: clicking the canvas requests pointer lock; once locked, mouse movement turns the view and clicks shoot. ESC releases.
- **Keys**: `Space`/click shoot, `E` interact with doors, `Tab` toggle automap, `1`/`2` select weapon, `Q`/mouse-wheel swap weapon.
- **Pickups**: walking within 0.5 tiles of an ammo box collects it (+12 bullets or +4 shells).

### Weapons & shooting (`shoot`)

Five weapons in `WEAPONS`. Guns `1`–`4` are selected with keys `1`–`4` or cycled with `Q` / mouse wheel (`WORDER`); the knife is forced on level 3 only. Each has a fire cooldown `cd`, recoil `kick`, `muzzle` flash duration, and an `auto` flag:

| Weapon | Key | Ammo | Fire | Notes |
|--------|-----|------|------|-------|
| pistol | `1` | bullets | semi | single fast tracer, 2 dmg |
| shotgun | `2` | shells | semi | 7 spread pellets, 2 dmg each |
| SMG | `3` | smgAmmo | **full-auto** | rapid tracers, 1 dmg |
| chainsaw | `4` | — (∞) | **auto melee** | continuous short-range damage |
| knife | — (L3) | — (∞) | melee + **block** | left-click swing; right-click guard |

- **Projectiles, not hitscan.** Each gun shot spawns one or more small visible projectiles (`pellets` count, fanned by `spread`) that travel at `projSpd` and damage the first enemy they touch. They're added to the shared `projectiles` array with `friendly: true`.
- **Full-auto.** Holding the trigger (`triggerHeld`) re-fires `auto` weapons every frame, gated by `playerFireCd`; semi-auto weapons fire once per press.
- **Melee** (`chainsawHit`, shared by chainsaw and knife) deals damage to enemies within `range` in a forward `cone`, checked against `wallBetween()`. The chainsaw is auto + buzzes; the knife is one swing per click. A **chainsaw kill scavenges ammo** for every gun (+8 bullets, +3 shells, +20 SMG).
- **Block / parry / deflect** (knife only, right-click → `blocking`, gated by `isBlocking()`): see *Blocking* below.

`killCheck()` marks enemies dead at ≤0 HP. `renderGun()` draws the active weapon (pistol, double-barrel shotgun, boxy SMG, chainsaw with scrolling teeth, or the knife — raised into a guard while blocking), the muzzle flash, the crosshair, and a contextual `[E]` prompt for the door/exit in front of you.

### Blocking, deflecting & parrying (level 3)

Holding right-click sets `blocking`; it only takes effect with the knife (`isBlocking()`).

- **Deflect** (`updateProjectiles` → `deflect`): a hostile projectile that reaches the player while they're blocking *and facing it* is flipped to `friendly`, re-aimed **back at the enemy that originally fired it** (each shot stores its `owner`), sped up, and marked `deflected`. A deflected shot is a **one-shot kill** and only harms its original shooter. Blocking while facing without deflecting still softens a hit to 40%.
- **Parry / mistimed block** (Hell Knight FSM, below): blocking during the knight's **yellow** window parries (damage + stagger); blocking during the earlier **green** window is punished — **40 damage and a half-second red screen flash** (`redFlash`).

### Enemies & AI (`updateEnemies`)

`ENEMY_STATS` gives each archetype its HP, speed, and (for ranged/boss types) projectile stats:

| Enemy | Level | HP | Speed | Behavior |
|-------|-------|----|-------|----------|
| freddy | 1 | 6 | 0.7 | slow, tanky stalker |
| bonnie | 1 | 3 | 1.25 | quick stalker |
| chica | 1 | 4 | 1.0 | steady stalker |
| foxy | 1 | 3 | 1.7 | fast **ranged** runner |
| blinky/pinky/inky/clyde | 2 | 3–4 | 1.0–1.35 | Pac-Man ghosts; stalkers |
| **pacman** | 2 | 30 | 0.6 | **miniboss** (`boss`): deferred — wakes only after the ghosts die; lumbers in, fires a slow heavy (34 dmg) orb |
| soldier | 3 | 4 | 1.05 | Wolfenstein guard; **ranged**, fires deflectable bullets |
| **hellknight** | 3 | 14 | 1.55 | fast brute; telegraphed strike you **parry** |
| **reaper** | all | ∞ | 2.2 | immortal, omniscient, instant-kill; spawns at exit unlock |

- Enemies act when they have **line of sight** (`!wallBetween` to the player); when they lose sight they **wander** (`wander()` — roam in a random direction, repicking on a timer or when they hit a wall) instead of standing still, so they search for you.
- **Melee** archetypes (animatronics + ghosts) stalk straight toward the player; on contact they deal continuous damage and flash `JUMPSCARE!` (`PAC-MAN CHOMP!` for the boss).
- **Ranged** enemies fire on a cooldown (`fireProjectile`). Foxy and soldiers kite/advance; Pac-Man (`boss`) lumbers in while lobbing slow heavy orbs at `scale` 1.9×.
- **Hell Knight** (`updateHellKnight`, a small FSM): approaches until within `HK_RANGE`, then telegraphs a strike — **green** windup → **yellow** parry window → strike. The glow is a render-time tint applied only to the **fists** (`HK_FISTS` regions), not the whole body. Blocking-and-facing during **yellow** parries it (damage + **red** stagger); blocking during **green** is punished (40 dmg + red flash); otherwise the strike lands (heavy, softened if you block). The knife can also whittle it down normally.
- **Deferred boss**: a level may name a `boss` (Pac-Man). It is held back until the rest of the roster is dead, then `spawnBoss()` wakes it (`PAC-MAN AWAKENS`).
- **Grim Reaper**: the instant every enemy is cleared, `exitReady` is set, the red door unlocks, and `spawnReaper()` drops an immortal Reaper at a random tile away from both the player and the exit. It ignores line-of-sight (always charges you), can't be damaged (`immortal` — shots and melee skip it), is excluded from the `LEFT` count, and kills on contact. You must reach the exit before it reaches you.

### Projectiles (`updateProjectiles`)

A single `projectiles` array holds **both** player shots (`friendly: true`) and enemy shots. Each carries direction, speed, lifetime, damage, sprite key, and render `scale`. Per frame they advance, expire on lifetime or wall hit, and:
- **friendly** → damage the first enemy within its (scale-aware) hit radius, then despawn (a `deflected` shot kills outright and only hits its `owner`; immortal enemies are skipped);
- **hostile** → if the player is blocking and facing it, `deflect()` it back at its `owner`; otherwise damage the player (full, or 40% if blocking) and despawn.

Dead projectiles are filtered out each frame. `fireProjectile(e)` aims an enemy's shot straight at the player and records `owner: e`.

### Doors & the level exit (`frontCell`, `interact`, `nextLevel`)

- `doorState` maps `"x,y"` → open/closed. All doors start closed each level.
- `frontCell()` scans a short distance ahead of the player for a door (`5`) or red exit (`6`) tile. `interact()` (key `E`) handles both:
  - door (`5`) → toggle open/closed and play the door sound;
  - red exit (`6`) → if every enemy is dead, `nextLevel()`; otherwise flash "exit locked".
- Open doors are passable (`isWall`) and see-through (raycaster + sprite rays skip them); the red exit is a solid wall you trigger by interaction.
- `nextLevel()` advances `levelIndex`, loads the next level and respawns it (carrying over the player's HP, ammo, and weapon), or wins the game past the last level.

### Audio (Web Audio synthesis)

No audio files — sounds are synthesized live:
- `playDoorSound()` — a low mechanical groan approximating DOOM's door sample (sawtooth + sine through a lowpass, with an envelope).
- `playShotSound()` — a short blip used for gunfire (`playGunSound` picks the pitch per weapon) and enemy shots.
- `playChainsawTick()` — a gritty sawtooth buzz pulsed while the chainsaw is firing.
- `playKnifeSound()` — a quick swoosh for the knife swing; `playParrySound()` — a metallic ping for deflects and parries.
- `initAudio()` lazily creates/resumes the `AudioContext` on the first user gesture (start button), satisfying browser autoplay rules.

### Automap (`drawMap`, TAB)

A full-screen overlay drawing the grid (color-coded by tile, red exit included), pickups (green ammo / red health dots), enemies (red dots, yellow square for the boss), and the player position + facing arrow.

### Spawning (`spawnEntities`)

Randomized each level from the level config:
- `openCells()` lists every floor-tile center, so nothing can spawn inside a wall.
- `take(minD, refs)` picks a distinct open tile at least `minD` tiles from given reference points (with a fallback to any free tile).
- The player spawns at a random tile/facing; the level's `roster` of enemies spawns ≥6 tiles away; ammo boxes (random bullets/shells/SMG) and health medkits spawn per the level's counts.

### Game loop (`frame`)

`requestAnimationFrame` loop with delta-time (`dt`) clamped to 0.05s to survive hitches. When `running`, it decays the fire cooldown, auto-fires held auto-weapons, updates player/enemies/projectiles, decays recoil/muzzle/message timers, then always renders (so the menu shows a frozen 3D view behind the overlay).

- `startGame()` resets to level 1, restores full stats/loadout, spawns entities, closes all doors, unlocks audio, shows the HUD, and requests pointer lock.
- `endGame(won)` stops the loop, releases the mouse, and shows the appropriate end screen (`YOU ESCAPED` or `GAME OVER`).

---

## Controls

| Input | Action |
|-------|--------|
| WASD / arrows | move & strafe |
| Mouse (pointer lock) / ← → | look |
| L-click / Space | attack (hold for full-auto / chainsaw) |
| R-click (hold) | block · deflect bullets · parry (knife / level 3) |
| 1 / 2 / 3 / 4 | pistol / shotgun / SMG / chainsaw |
| Q / mouse wheel | cycle weapon |
| E | open/close door · use red exit |
| Tab | toggle automap |
| Shift | sprint |
| Esc | release mouse |

## Running it

Open `index.html` in a browser (ideally via a local static server so pointer lock and audio behave). No build, bundler, or dependencies.

## Game features

All of the following are implemented:

- ✅ **Fully automatic SMG** — weapon `3`, holds-to-fire, its own `smgAmmo` pool.
- ✅ **Visible projectiles for every gun** — pistol/shotgun/SMG fire travelling tracer/pellet sprites (no more pure hitscan).
- ✅ **Chainsaw melee** — weapon `4`, no ammo, continuous close-range damage with a forward cone.
- ✅ **Red exit door → next level** — clearing a level unlocks the red door (`6`); using it advances to the next level (or wins the game).
- ✅ **Level 2** — Pac-Man ghosts (Blinky/Pinky/Inky/Clyde) plus a **Pac-Man miniboss** with a slow, heavy-damage projectile, in a blue maze.
- ✅ **Health pickups** — medkits spawn on every level (`+25` HP, capped at 100).
- ✅ **Searching AI** — enemies wander to hunt for you when they lose line of sight instead of standing still (`wander()`).
- ✅ **Level 3 — knife only** — left-click swing, right-click block (`knife` weapon, `knifeOnly` level flag).
- ✅ **Deflect** — blocking while facing a bullet sends it back as a friendly **one-shot-kill** projectile (`deflect()`).
- ✅ **WW2 bunker** — level 3 is a concrete bunker with Wolfenstein **soldiers** firing deflectable bullets.
- ✅ **Hell Knights** — DOOM brutes that telegraph green → **yellow** (parry window) → strike; blocking on yellow damages them and turns them **red** (`updateHellKnight`).
- ✅ **Deflect returns to sender** — a deflected projectile homes back at the enemy that fired it (tracked via `owner`) and only harms that enemy.
- ✅ **Faster Hell Knights** — speed `1.55` (up from `0.5`), so they close in and pressure the parry.
- ✅ **Mistimed-block punish** — blocking a Hell Knight during its **green** windup (too early) deals **40 damage** and flashes the screen red for ½ s (`redFlash`).
- ✅ **Chainsaw scavenges ammo** — a chainsaw kill grants +8 bullets, +3 shells, +20 SMG.
- ✅ **No ammo boxes on level 3** — the bunker carries only health medkits (`ammo: 0`, read with `??`).
- ✅ **Deferred Pac-Man** — the miniboss (`boss: 'pacman'`) wakes only once every ghost is dead (`spawnBoss`).
- ✅ **Grim Reaper** — on exit unlock, an immortal, omniscient, instant-kill Reaper spawns away from you and the exit and hunts you down; slightly slower than you, so you can just outrun it to the door (`spawnReaper`).