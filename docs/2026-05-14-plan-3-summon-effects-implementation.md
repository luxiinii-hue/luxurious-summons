# Plan 3 — Summon-effect catalog + presentation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Luxurious Summons roster from 1 to 8 templates (Simulacrum + Find Familiar / Pact of the Chain / Animate Dead / Mage Hand / Unseen Servant / Echo Knight Echo / Summon Dragon), add a spawn-effect audiovisual layer, and replace the single-column Spawn dialog with a flat 8-card gallery + 2-column variant-picker modal. Ship as v0.4.0.

**Architecture:** Four source modes (`clone` existing + `compendium` / `inline-synthesized` / `compendium-scaled` new) feed a unified `effects: { motion, spawn, death }` template descriptor. Spawn animations live in a new `scripts/spawn-animations.js` paralleling `death-animations.js`, sharing a `tween.js` helper and a PIXI texture cache. The Spawn dialog gallery and variant-picker modal are two new ApplicationV2 + HandlebarsApplicationMixin classes; the picker reuses Plan 2's `summon-details.hbs` partial. Foundry V13/V14 strictness (single-root PARTS, partial pre-registration, action delegation) is paid for in every UI surface.

**Tech Stack:** Foundry VTT V13 build 351 / V14 verified; dnd5e 5.2.1; ApplicationV2 + HandlebarsApplicationMixin; PIXI.js (Foundry's bundled version); node:test for unit tests; PowerShell for ZIP build.

**Design doc:** `docs/2026-05-14-plan-3-summon-effects-design.md` (697 lines). Read §3 (roster), §5 (override table), §7 (data model), §8 (animation registries) before starting.

---

## File structure

### New files (created in this plan)

| Path | Purpose |
|---|---|
| `scripts/tween.js` | Shared `tweenWithTicker(durationMs, onTick)` helper extracted from `death-animations.js`. Mid-animation mesh-destroyed guard preserved from v0.3.3. |
| `scripts/spawn-animations.js` | Spawn-effect registry: `belleBloom`, `hexCrystalForm`, `mageHandSparks`, `infernalBloom`, `boneRise`, `echoStep`. Parameter-driven variants share core implementations. |
| `scripts/effect-textures.js` | PIXI texture registry — `setEffectTextures(map)` / `getEffectTextures()`. Loaded at module `ready` for 4 effect SVGs. |
| `scripts/source-modes.js` | Pure-logic + Foundry resolution for each source mode: `clone`, `compendium`, `inline-synthesized`, `compendium-scaled`. Exports `resolveActorData(template, variant, ctx)`. |
| `scripts/variant-eligibility.js` | Pure-logic `filterVariants(template, caster)` — applies `variant.requires` gates. |
| `scripts/spawn-trigger-anim.js` | `maybeRunSpawnAnimation(token)` hook handler — reads actor's `spawnState` flag, plays the right effect, clears the flag. |
| `scripts/spawn-gallery-app.js` | Gallery dialog (ApplicationV2). 640 × 480 px, 3-col grid of 8 template cards. |
| `scripts/variant-picker-app.js` | Variant-picker modal (ApplicationV2). 720 × 500 px, 2-column. Includes cast-level selector + multi-spawn counter. |
| `templates/spawn-gallery.hbs` | Single-root template for the gallery dialog. |
| `templates/variant-picker.hbs` | Single-root template for the variant picker. |
| `templates/partials/template-gallery-card.hbs` | One template card in the gallery. |
| `templates/partials/variant-card.hbs` | One variant card in the picker grid. |
| `styles/spawn-gallery.css` | Gallery dialog styling — Belle Époque chrome, family-stripe edge, hover lift. |
| `styles/variant-picker.css` | Picker dialog styling — 2-column layout, variant grid, cast-level selector, multi-spawn counter. |
| `assets/effects/hex-shard.svg` | Cyan crystal shard, 12 × 12 viewBox. Hand-authored. |
| `assets/effects/gold-mote.svg` | Gold particle mote, 8 × 8 viewBox. Hand-authored. |
| `assets/effects/ember.svg` | Red-orange ember, 8 × 8 viewBox. Hand-authored. |
| `assets/effects/bone-mote.svg` | Bone-white mote, 8 × 8 viewBox. Hand-authored. |
| `tests/lux-source-modes.test.js` | Pure-logic tests for each source mode's data resolution. |
| `tests/lux-variant-eligibility.test.js` | Pure-logic tests for `requires` gating. |
| `tests/lux-effects-fallback.test.js` | Pure-logic tests for `readEffects(template)` migration helper. |
| `tests/lux-spawn-multispawn.test.js` | Pure-logic tests for Animate Dead multi-placement counter. |
| `previews/spawn-gallery.html` | Standalone preview of gallery + variant picker. Mock data, no Foundry. |
| `previews/spawn-gallery-preview.js` | Vanilla JS wiring for the preview. |

### Modified files

| Path | Change |
|---|---|
| `scripts/data-model.js` | Add `readEffects(template)` helper; accept new companion-record fields (`variantId`, `castSlotLevel`); validate new source modes. |
| `scripts/death-animations.js` | Remove `tweenWithTicker` (now in `tween.js`); add 6 new entries: `belleFade`, `hexShatter`, `mageHandDissolve`, `echoCollapse`, `infernalFade`, `boneCollapse`. Each new entry under ~30 lines. |
| `scripts/templates-builtin.js` | Migrate Simulacrum to new `source` + `effects` shape; add 7 new templates: Find Familiar, Pact of the Chain, Animate Dead, Mage Hand, Unseen Servant, Echo Knight Echo, Summon Dragon. |
| `scripts/spawn-engine.js` | Replace `actor.toObject()` clone logic with `resolveActorData(...)` from `source-modes.js`. Tag spawned actor with `spawnState: "pending-spawn"` after token creation. Plumb `variantId` and `castSlotLevel` into companion-record flag. |
| `scripts/spawn-flow.js` | Replace single-template spawn dialog open with gallery / picker flow. Add `runVariantPickerFlow(template, ctx)` for cast-driven entry. |
| `scripts/spell-trigger.js` | Match on `trigger.name` (new field) instead of `triggerSpell` (legacy). Pass `usageConfig.level` into the picker as `castSlotLevel`. |
| `scripts/main.js` | Add SVG textures load to ready hook; register new Handlebars partials; wire `maybeRunSpawnAnimation` to `drawToken`. |
| `scripts/manager-app.js` | "Spawn New" tab CTA opens `SpawnGalleryApp` (instead of the legacy `SpawnApp`). |
| `lang/en.json` | Strings for gallery title, picker title, cast-level selector, multi-spawn counter, all new template + variant names + taglines. |
| `module.json` | Bump version to 0.4.0. |
| `CLAUDE.md` | Add v0.4.0 status table row; note new source modes; note spawn-effect layer; update architecture quick-reference. |

### Deprecated / removed

| Path | Reason |
|---|---|
| `scripts/spawn-app.js` | Replaced by `spawn-gallery-app.js` + `variant-picker-app.js`. Delete in task 27. |
| `templates/spawn.hbs` | Replaced. Delete in task 27. |

---

# Phase 1 — Foundation (no Foundry coupling)

Phase 1 is preview-first. Every task here either ships pure-logic tested code, hand-authors an asset, or builds the HTML preview. **STOP at the end of Phase 1 for user visual review.**

---

### Task 1: Hand-author `hex-shard.svg`

**Files:**
- Create: `assets/effects/hex-shard.svg`

- [ ] **Step 1: Create the SVG file**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="#5cd3e8">
  <path d="M6 0 L11 3 L11 9 L6 12 L1 9 L1 3 Z" opacity="0.92"/>
  <path d="M6 1.5 L9.5 3.5 L9.5 8.5 L6 10.5 L2.5 8.5 L2.5 3.5 Z" opacity="0.4" fill="#9eecf5"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add assets/effects/hex-shard.svg
git commit -m "feat: hex shard effect asset (Plan 3 task 1)"
```

---

### Task 2: Hand-author `gold-mote.svg`

**Files:**
- Create: `assets/effects/gold-mote.svg`

- [ ] **Step 1: Create the SVG**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" fill="#c9a14b">
  <circle cx="4" cy="4" r="3" opacity="0.85"/>
  <circle cx="4" cy="4" r="1.5" fill="#f0c97a" opacity="0.95"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add assets/effects/gold-mote.svg
git commit -m "feat: gold mote effect asset (Plan 3 task 2)"
```

---

### Task 3: Hand-author `ember.svg`

**Files:**
- Create: `assets/effects/ember.svg`

- [ ] **Step 1: Create the SVG**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" fill="#d68b3c">
  <circle cx="4" cy="4" r="3" opacity="0.9"/>
  <circle cx="4" cy="4" r="1.4" fill="#ffcc66" opacity="0.95"/>
  <circle cx="2.5" cy="3" r="0.6" fill="#ff7733" opacity="0.7"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add assets/effects/ember.svg
git commit -m "feat: ember effect asset (Plan 3 task 3)"
```

---

### Task 4: Hand-author `bone-mote.svg`

**Files:**
- Create: `assets/effects/bone-mote.svg`

- [ ] **Step 1: Create the SVG**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" fill="#e8dcc4">
  <ellipse cx="4" cy="4" rx="3" ry="2" opacity="0.85"/>
  <ellipse cx="4" cy="4" rx="1.5" ry="1" fill="#f5e9d8" opacity="0.9"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add assets/effects/bone-mote.svg
git commit -m "feat: bone-mote effect asset (Plan 3 task 4)"
```

---

### Task 5: Extract `tweenWithTicker` into shared `tween.js`

**Files:**
- Create: `scripts/tween.js`
- Modify: `scripts/death-animations.js:12-26`

- [ ] **Step 1: Create `scripts/tween.js`**

```js
// scripts/tween.js — shared PIXI ticker-based tween helper
// Used by spawn-animations.js + death-animations.js.
//
// Defensive guard against mid-animation mesh destruction (v0.3.3): when the
// onTick callback throws because the target was destroyed (e.g., a synced
// token delete arrived from the GM), bail cleanly rather than spamming the
// console per frame.

const MODULE_ID = "luxurious-summons";

export function tweenWithTicker(durationMs, onTick) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      try {
        onTick(t);
      } catch (err) {
        console.log(`[${MODULE_ID}] tween aborted: ${err.message ?? err}`);
        PIXI.Ticker.shared.remove(tick);
        resolve();
        return;
      }
      if (t >= 1) {
        PIXI.Ticker.shared.remove(tick);
        resolve();
      }
    };
    PIXI.Ticker.shared.add(tick);
  });
}

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
```

- [ ] **Step 2: Update `scripts/death-animations.js` to import from `tween.js`**

Remove lines 12-26 (the local `tweenWithTicker` + `easeOutCubic`) and replace with:

```js
import { tweenWithTicker, easeOutCubic } from "./tween.js";
```

- [ ] **Step 3: Syntax-check both files**

Run: `node --check scripts/tween.js && node --check scripts/death-animations.js`
Expected: no output (success).

- [ ] **Step 4: Run existing tests to confirm no regression**

Run: `npm test`
Expected: `# pass 42 # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/tween.js scripts/death-animations.js
git commit -m "refactor: extract tweenWithTicker into shared tween.js (Plan 3 task 5)"
```

---

### Task 6: Effect-texture registry module

**Files:**
- Create: `scripts/effect-textures.js`

- [ ] **Step 1: Create the registry module**

```js
// scripts/effect-textures.js — module-scoped registry of preloaded PIXI textures
// for spawn / death animation effects. Populated once at module ready in main.js.
//
// We use a module-scoped Map instead of a window global to avoid cross-module
// pollution. Foundry plugins coexist in one global scope; named module imports
// give us isolation.

const _textures = new Map();

export function setEffectTextures(map) {
  for (const [k, v] of Object.entries(map)) _textures.set(k, v);
}

export function getEffectTexture(name) {
  return _textures.get(name);
}

export function hasEffectTextures() {
  return _textures.size > 0;
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check scripts/effect-textures.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add scripts/effect-textures.js
git commit -m "feat: effect texture registry (Plan 3 task 6)"
```

---

### Task 7: Write `spawn-animations.js` with two core animations

**Files:**
- Create: `scripts/spawn-animations.js`

- [ ] **Step 1: Create the file with the two cores + parametric variants**

```js
// scripts/spawn-animations.js — per-template PIXI spawn animations.
// Parallels death-animations.js. Each entry receives a Token and returns a
// Promise that resolves when the animation completes.
//
// Cleanup contract: do NOT touch the token document — the spawn engine has
// already created it, this just animates the visual reveal.

import { tweenWithTicker, easeOutCubic } from "./tween.js";
import { getEffectTexture } from "./effect-textures.js";

const MODULE_ID = "luxurious-summons";

/**
 * Particle bloom — N motes erupt or converge around the token. Token alpha
 * fades 0 → 1 in sync. Parameterized for palette (Belle Époque gold vs. Pact
 * ember vs. Animate Dead bone), direction (radial vs. bottom-up vs. convergent),
 * and start-scale (1.0 for normal, 0.7 for Animate Dead "rise from prone").
 */
async function particleBloom(token, opts = {}) {
  const {
    palette = "gold",
    direction = "radial",
    scaleFrom = 0.95,
    durationMs = 1200,
    moteCount = 24,
    moteSpread = 80,
    smokeWisp = false
  } = opts;

  if (!token?.mesh) return;
  const mesh = token.mesh;
  const startAlpha = mesh.alpha;
  mesh.alpha = 0;
  mesh.scale.set(mesh.scale.x * scaleFrom);
  const finalScaleFactor = 1 / scaleFrom;

  const textureName = palette === "ember" ? "ember"
                    : palette === "bone"  ? "boneMote"
                    : "goldMote";
  const texture = getEffectTexture(textureName);
  if (!texture) {
    console.warn(`[${MODULE_ID}] particleBloom: texture "${textureName}" not loaded`);
    mesh.alpha = startAlpha;
    return;
  }

  const layer = canvas.interface;
  const cx = token.center.x;
  const cy = token.center.y;
  const motes = [];
  for (let i = 0; i < moteCount; i++) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = cx;
    sprite.y = cy;
    const angle = (i / moteCount) * Math.PI * 2;
    let vx = Math.cos(angle) * moteSpread;
    let vy = Math.sin(angle) * moteSpread;
    if (direction === "bottom-up") {
      vx *= 0.4;
      vy = -Math.abs(vy) * 1.2;
    } else if (direction === "convergent") {
      sprite.x = cx + vx;
      sprite.y = cy + vy;
      vx = -vx;
      vy = -vy;
    }
    sprite._vx = vx;
    sprite._vy = vy;
    sprite._initX = sprite.x;
    sprite._initY = sprite.y;
    layer.addChild(sprite);
    motes.push(sprite);
  }

  await tweenWithTicker(durationMs, (t) => {
    const eased = easeOutCubic(t);
    mesh.alpha = startAlpha * eased;
    mesh.scale.set(mesh.scale.x * (1 + (finalScaleFactor - 1) * eased / Math.max(0.0001, eased)));
    for (const sprite of motes) {
      sprite.x = sprite._initX + sprite._vx * eased;
      sprite.y = sprite._initY + sprite._vy * eased;
      sprite.alpha = direction === "convergent" ? eased : (1 - eased);
    }
  });

  // Restore the final scale crisply (avoid accumulated float drift)
  mesh.scale.set(mesh.scale.x * finalScaleFactor / (1 + (finalScaleFactor - 1)));
  mesh.alpha = startAlpha;
  for (const sprite of motes) {
    layer.removeChild(sprite);
    sprite.destroy();
  }
}

/**
 * Crystal-form — 6 cyan SVG shards spawn at radial offsets and converge on
 * the token center. Token alpha 0 → 1 in sync with a final scale snap-bounce
 * (1.0 → 1.08 → 1.0) at the end. Mirrored for hexShatter (in death-animations).
 */
async function crystalForm(token, opts = {}) {
  const { durationMs = 1000, shardCount = 6, shardSpread = 64 } = opts;

  if (!token?.mesh) return;
  const mesh = token.mesh;
  const startAlpha = mesh.alpha;
  const startScale = mesh.scale.x;
  mesh.alpha = 0;

  const texture = getEffectTexture("hexShard");
  if (!texture) {
    console.warn(`[${MODULE_ID}] crystalForm: hexShard texture not loaded`);
    mesh.alpha = startAlpha;
    return;
  }

  const layer = canvas.interface;
  const cx = token.center.x;
  const cy = token.center.y;
  const shards = [];
  for (let i = 0; i < shardCount; i++) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    const angle = (i / shardCount) * Math.PI * 2 + Math.PI / 6;
    sprite._startX = cx + Math.cos(angle) * shardSpread;
    sprite._startY = cy + Math.sin(angle) * shardSpread;
    sprite._endX = cx;
    sprite._endY = cy;
    sprite.x = sprite._startX;
    sprite.y = sprite._startY;
    sprite.scale.set(0.6);
    layer.addChild(sprite);
    shards.push(sprite);
  }

  await tweenWithTicker(durationMs, (t) => {
    const eased = easeOutCubic(t);
    // Token alpha + scale snap (1.0 at t<0.85, then 1.08 at t=0.92, then 1.0 at t=1.0)
    mesh.alpha = startAlpha * eased;
    if (t < 0.85) mesh.scale.set(startScale);
    else if (t < 0.92) mesh.scale.set(startScale * (1 + 0.08 * ((t - 0.85) / 0.07)));
    else mesh.scale.set(startScale * (1.08 - 0.08 * ((t - 0.92) / 0.08)));
    for (const sprite of shards) {
      sprite.x = sprite._startX + (sprite._endX - sprite._startX) * eased;
      sprite.y = sprite._startY + (sprite._endY - sprite._startY) * eased;
      sprite.alpha = 1 - eased;
      sprite.scale.set(0.6 + 0.6 * eased);
    }
  });

  mesh.scale.set(startScale);
  mesh.alpha = startAlpha;
  for (const sprite of shards) {
    layer.removeChild(sprite);
    sprite.destroy();
  }
}

/**
 * Echo step — translucent master-silhouette ghost materializes into the echo
 * over 500 ms. Unique implementation; doesn't reuse a core.
 */
async function echoStep(token) {
  if (!token?.mesh) return;
  const mesh = token.mesh;
  const startAlpha = mesh.alpha;
  mesh.alpha = 0;
  await tweenWithTicker(500, (t) => {
    const eased = easeOutCubic(t);
    mesh.alpha = startAlpha * eased;
  });
  mesh.alpha = startAlpha;
}

export const spawnAnimations = {
  belleBloom:     particleBloom,
  hexCrystalForm: crystalForm,
  mageHandSparks: (token) => particleBloom(token, { palette: "gold", direction: "convergent" }),
  infernalBloom:  (token) => particleBloom(token, { palette: "ember", smokeWisp: true }),
  boneRise:       (token) => particleBloom(token, { palette: "bone", direction: "bottom-up", scaleFrom: 0.7, durationMs: 1500 }),
  echoStep
};
```

- [ ] **Step 2: Syntax-check**

Run: `node --check scripts/spawn-animations.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add scripts/spawn-animations.js
git commit -m "feat: spawn-animations registry with two cores + 4 variants (Plan 3 task 7)"
```

---

### Task 8: Extend `death-animations.js` with 6 new entries

**Files:**
- Modify: `scripts/death-animations.js` (after `softFade`)

- [ ] **Step 1: Add the 6 new entries**

Append inside the `deathAnimations` object (after the `softFade` entry, before the final `// Plan 3:` comment which can now be removed):

```js
  /**
   * belleFade — saturation 1→0.4 + brightness 1→0.6 + alpha 1→0 over 1.0 s.
   * Wine-tinted darkening. Used by every Belle Époque template's death by default.
   */
  belleFade: async (token, opts = {}) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const cm = new PIXI.ColorMatrixFilter();
    const prevFilters = mesh.filters ?? [];
    mesh.filters = [...prevFilters, cm];
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      // Saturation toward 0.4 + brightness toward 0.6
      cm.reset();
      cm.saturate(-(1 - 0.4) * eased, true);
      cm.brightness(1 - 0.4 * eased, true);
      mesh.alpha = startAlpha * (1 - eased);
    });
    mesh.filters = prevFilters;
  },

  /**
   * hexShatter — 6 cyan SVG shards spawn at token center, drift outward,
   * fade. Token alpha 1 → 0 in sync. Mirror of hexCrystalForm.
   */
  hexShatter: async (token, opts = {}) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const texture = getEffectTexture("hexShard");
    if (!texture) {
      console.warn(`[${MODULE_ID}] hexShatter: hexShard texture not loaded`);
      mesh.alpha = 0;
      return;
    }
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const shards = [];
    for (let i = 0; i < 6; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      sprite._vx = Math.cos(angle) * 64;
      sprite._vy = Math.sin(angle) * 64;
      sprite.scale.set(1.2);
      layer.addChild(sprite);
      shards.push(sprite);
    }
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      mesh.alpha = startAlpha * (1 - eased);
      for (const sprite of shards) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
        sprite.scale.set(1.2 - 0.6 * eased);
      }
    });
    for (const sprite of shards) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * mageHandDissolve — belleFade + gold motes drift outward at the end.
   */
  mageHandDissolve: async (token) => {
    await deathAnimations.belleFade(token);
    // Brief mote-puff after the fade
    const texture = getEffectTexture("goldMote");
    if (!texture || !token?.center) return;
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 8) * Math.PI * 2;
      sprite._vx = Math.cos(angle) * 40;
      sprite._vy = Math.sin(angle) * 40;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(400, (t) => {
      const eased = easeOutCubic(t);
      for (const sprite of motes) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * echoCollapse — vertical line of motes rises up and fades. Token alpha 1→0.
   */
  echoCollapse: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const texture = getEffectTexture("goldMote");
    if (!texture) {
      mesh.alpha = 0;
      return;
    }
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 12; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx + (Math.random() - 0.5) * 8;
      sprite.y = cy;
      sprite._delay = i * 0.04;
      sprite._driftY = -64 - Math.random() * 16;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(800, (t) => {
      mesh.alpha = startAlpha * (1 - t);
      for (const sprite of motes) {
        const localT = Math.max(0, Math.min(1, (t - sprite._delay) / (1 - sprite._delay)));
        sprite.y = cy + sprite._driftY * localT;
        sprite.alpha = localT < 0.2 ? localT * 5 : (1 - (localT - 0.2) / 0.8);
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * infernalFade — belleFade + ember-puff at the end.
   */
  infernalFade: async (token) => {
    await deathAnimations.belleFade(token);
    const texture = getEffectTexture("ember");
    if (!texture || !token?.center) return;
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 10; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 10) * Math.PI * 2;
      sprite._vx = Math.cos(angle) * 32;
      sprite._vy = Math.sin(angle) * 32 - 24;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(500, (t) => {
      const eased = easeOutCubic(t);
      for (const sprite of motes) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
        sprite.scale.set(1 + 0.5 * eased);
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * boneCollapse — desaturate to bone-white + scale 1.0 → 0.7 + alpha 1 → 0.
   */
  boneCollapse: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const startScale = mesh.scale.x;
    const cm = new PIXI.ColorMatrixFilter();
    const prevFilters = mesh.filters ?? [];
    mesh.filters = [...prevFilters, cm];
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      cm.reset();
      cm.saturate(-eased, true);
      mesh.alpha = startAlpha * (1 - eased);
      mesh.scale.set(startScale * (1 - 0.3 * eased));
    });
    mesh.filters = prevFilters;
    mesh.scale.set(startScale);
  }
```

Also add this import at the top of `death-animations.js`:

```js
import { getEffectTexture } from "./effect-textures.js";
```

- [ ] **Step 2: Syntax-check**

Run: `node --check scripts/death-animations.js`
Expected: no output.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: `# pass 42 # fail 0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/death-animations.js
git commit -m "feat: 6 new death animations (Belle/Hex/Mage/Echo/Infernal/Bone) (Plan 3 task 8)"
```

---

### Task 9: HTML preview — `previews/spawn-gallery.html`

**Files:**
- Create: `previews/spawn-gallery.html`
- Create: `previews/spawn-gallery-preview.js`

- [ ] **Step 1: Create the preview HTML scaffold**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luxurious Summons — Spawn Gallery Preview</title>
  <link rel="stylesheet" href="../styles/luxurious.css">
  <link rel="stylesheet" href="../styles/spawn-gallery.css">
  <link rel="stylesheet" href="../styles/variant-picker.css">
  <link rel="stylesheet" href="../styles/summon-details.css">
  <style>
    body { background: #0a0508; padding: 40px; font-family: system-ui, sans-serif; color: #f5e9d8; }
    .preview-frame { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
    .frame-label { display: block; margin-bottom: 12px; font-size: 14px; color: #c9a14b; }
  </style>
</head>
<body>
  <h1 style="color:#c9a14b;font-family:'Cinzel',serif;">Spawn Gallery — Preview</h1>
  <div class="preview-frame">
    <section>
      <span class="frame-label">Gallery (640 × 480)</span>
      <div id="gallery-mount"></div>
    </section>
    <section>
      <span class="frame-label">Variant picker — Find Familiar (720 × 500)</span>
      <div id="picker-mount"></div>
    </section>
    <section>
      <span class="frame-label">Variant picker — Animate Dead (multi-spawn)</span>
      <div id="multispawn-mount"></div>
    </section>
  </div>
  <script type="module" src="./spawn-gallery-preview.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `previews/spawn-gallery-preview.js`**

```js
// previews/spawn-gallery-preview.js — vanilla JS wiring for the Plan 3 preview.
// Mock data, no Foundry, no PIXI. Validates layout + interaction feel only.

const templates = [
  { id: "simulacrum",      name: "Simulacrum",      family: "hextech",     tagline: "Illusory duplicate of yourself.",            variants: 1,  thumb: "..." },
  { id: "find-familiar",   name: "Find Familiar",   family: "belle-epoque",tagline: "Bind a tiny spirit-creature familiar.",      variants: 15, thumb: "..." },
  { id: "pact-of-chain",   name: "Pact of the Chain",family:"belle-epoque",tagline: "Bind a fey or fiendish familiar (Warlock).", variants: 4,  thumb: "..." },
  { id: "animate-dead",    name: "Animate Dead",    family: "belle-epoque",tagline: "Raise corpses as undead servants.",          variants: 2,  thumb: "..." },
  { id: "mage-hand",       name: "Mage Hand",       family: "hextech",     tagline: "Ethereal disembodied hand of arcane force.", variants: 1,  thumb: "..." },
  { id: "unseen-servant",  name: "Unseen Servant",  family: "hextech",     tagline: "An invisible servant carries small objects.",variants: 1,  thumb: "..." },
  { id: "echo-knight-echo",name: "Echo Knight Echo",family: "hextech",     tagline: "A translucent armored echo of yourself.",    variants: 1,  thumb: "..." },
  { id: "summon-dragon",   name: "Summon Dragon",   family: "hextech",     tagline: "Summon a draconic spirit. Pick a damage type.",variants:5, thumb: "..." }
];

const variants = {
  "find-familiar": [
    { id: "owl",  name: "Owl",  ac: 11, hp: 1, speed: { walk: 5, fly: 60 }, senses: "darkvision 120", tagline: "Flyby; advantage on Perception checks." },
    { id: "cat",  name: "Cat",  ac: 12, hp: 2, speed: { walk: 40, climb: 30 }, senses: "darkvision 60", tagline: "Stealthy; keen smell." },
    // ... etc. mocked
  ],
  "animate-dead": [
    { id: "skeleton", name: "Skeleton", ac: 13, hp: 13, damage: "shortbow 1d6+2" },
    { id: "zombie",   name: "Zombie",   ac:  8, hp: 22, damage: "slam 1d6+1; Undead Fortitude" }
  ]
};

function renderGallery(mount) {
  mount.innerHTML = `
    <div class="luxsum-spawn-gallery" style="width:640px;height:480px;border:2px solid #c9a14b;background:#1c0e1a;padding:20px;border-radius:6px;">
      <h2 style="color:#c9a14b;font-family:'Cinzel',serif;margin:0 0 16px;">Spawn New Companion</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${templates.map(t => `
          <div class="luxsum-template-card" data-family="${t.family}" style="width:180px;height:180px;background:#2a1828;border:1px solid #c9a14b;border-left:4px solid ${t.family === 'hextech' ? '#5cd3e8' : '#c9a14b'};padding:12px;border-radius:4px;cursor:pointer;">
            <div style="width:96px;height:96px;margin:0 auto 8px;background:#1a0a16;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;">${t.name.charAt(0)}</div>
            <div style="font-family:'Cinzel',serif;color:#c9a14b;font-size:14px;text-align:center;">${t.name}</div>
            <div style="font-size:11px;color:#b6a890;font-style:italic;text-align:center;margin-top:4px;">${t.tagline}</div>
            ${t.variants > 1 ? `<div style="position:absolute;top:8px;right:8px;background:#c9a14b;color:#1c0e1a;font-size:10px;padding:2px 6px;border-radius:10px;">${t.variants}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderVariantPicker(mount, templateId, multispawn = false) {
  const vlist = variants[templateId] ?? [];
  mount.innerHTML = `
    <div class="luxsum-variant-picker" style="width:720px;height:500px;border:2px solid #c9a14b;background:#1c0e1a;padding:20px;border-radius:6px;display:flex;flex-direction:column;">
      <h2 style="color:#c9a14b;font-family:'Cinzel',serif;margin:0 0 16px;">${templates.find(t => t.id === templateId)?.name ?? templateId} — Pick a variant</h2>
      <div style="display:flex;gap:24px;flex:1;">
        <div style="width:320px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start;">
          ${vlist.map(v => `
            <div class="luxsum-variant-card" data-id="${v.id}" style="width:88px;height:88px;background:#2a1828;border:1px solid #c9a14b;padding:6px;cursor:pointer;">
              <div style="width:64px;height:64px;background:#1a0a16;margin:0 auto 4px;">${v.name.charAt(0)}</div>
              <div style="font-size:11px;color:#f5e9d8;text-align:center;">${v.name}</div>
              ${multispawn ? `<div style="text-align:center;font-size:10px;color:#c9a14b;">[− 0 +]</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div style="flex:1;background:#2a1828;border:1px solid #c9a14b;padding:16px;">
          <h3 style="color:#c9a14b;font-family:'Cinzel',serif;margin:0 0 8px;">${vlist[0]?.name ?? '—'}</h3>
          <div style="font-size:12px;color:#f5e9d8;line-height:1.6;">
            AC ${vlist[0]?.ac ?? '—'} • HP ${vlist[0]?.hp ?? '—'}<br>
            ${vlist[0]?.tagline ?? '(select a variant to view stats)'}
          </div>
          <button style="margin-top:12px;background:transparent;border:1px solid #c9a14b;color:#c9a14b;padding:6px 12px;cursor:pointer;">Open Foundry Sheet</button>
        </div>
      </div>
      ${multispawn ? `<div style="margin-top:12px;color:#c9a14b;text-align:right;">Total: 0 / 4</div>` : ''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button style="background:transparent;border:1px solid #c9a14b;color:#c9a14b;padding:8px 16px;cursor:pointer;">Cancel</button>
        <button style="background:#c9a14b;border:1px solid #c9a14b;color:#1c0e1a;padding:8px 16px;cursor:pointer;">${multispawn ? 'Place 0 tokens' : 'Place'}</button>
      </div>
    </div>
  `;
}

renderGallery(document.getElementById("gallery-mount"));
renderVariantPicker(document.getElementById("picker-mount"), "find-familiar");
renderVariantPicker(document.getElementById("multispawn-mount"), "animate-dead", true);
```

- [ ] **Step 3: Open in a browser and visually verify**

Run: open `previews/spawn-gallery.html` in any browser (no server needed).
Expected: three dialog mockups side-by-side, all 720-px-wide-or-narrower, gold-on-wine palette, family-stripe edge on each gallery card.

- [ ] **Step 4: Commit**

```bash
git add previews/spawn-gallery.html previews/spawn-gallery-preview.js
git commit -m "feat: spawn-gallery HTML preview (Plan 3 task 9)"
```

- [ ] **Step 5: STOP — user visual review.**

Wait for user approval of the preview before continuing to Phase 2. Iterate on `spawn-gallery.css` + `variant-picker.css` based on feedback.

---

# Phase 2 — Data model + source modes

After Phase 1's user-approved preview, switch to data-model + source-mode work. All pure-logic, fully unit-testable.

---

### Task 10: Write `readEffects(template)` helper + tests

**Files:**
- Modify: `scripts/data-model.js` (add export)
- Create: `tests/lux-effects-fallback.test.js`

- [ ] **Step 1: Write the test first**

```js
// tests/lux-effects-fallback.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readEffects } from "../scripts/data-model.js";

test("readEffects: new shape — returns effects object as-is", () => {
  const tpl = { effects: { motion: { profile: "ethereal-drift", intensity: 1.0 }, spawn: "hex-crystal-form", death: "hex-shatter" } };
  assert.deepEqual(readEffects(tpl), tpl.effects);
});

test("readEffects: legacy shape with motion + death — translates to new shape", () => {
  const tpl = { defaults: { motionProfile: "flame-flicker", motionIntensity: 0.6 }, deathAnimation: "icyShatter" };
  const result = readEffects(tpl);
  assert.deepEqual(result.motion, { profile: "flame-flicker", intensity: 0.6 });
  assert.equal(result.spawn, null);
  assert.equal(result.death, "icyShatter");
});

test("readEffects: legacy shape without motion — uses none profile", () => {
  const tpl = { deathAnimation: "softFade" };
  const result = readEffects(tpl);
  assert.deepEqual(result.motion, { profile: "none", intensity: 0 });
  assert.equal(result.death, "softFade");
});

test("readEffects: empty template — returns sensible defaults", () => {
  const result = readEffects({});
  assert.deepEqual(result.motion, { profile: "none", intensity: 0 });
  assert.equal(result.spawn, null);
  assert.equal(result.death, "softFade");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test tests/lux-effects-fallback.test.js`
Expected: 4 failing tests, error `readEffects is not exported`.

- [ ] **Step 3: Add `readEffects` to `data-model.js`**

Append at the end of `scripts/data-model.js`:

```js
/**
 * Read a template's audiovisual effects descriptor. Plan 3 introduced the
 * unified `template.effects = { motion, spawn, death }` shape; legacy
 * (Plan 1 / Plan 2) templates have the same data scattered across
 * `defaults.motionProfile`, `defaults.motionIntensity`, and `deathAnimation`.
 *
 * Returns the new shape always — callers don't need to handle either.
 */
export function readEffects(template) {
  if (template?.effects) return template.effects;
  const defaults = template?.defaults ?? {};
  const motion = (defaults.motionProfile && defaults.motionIntensity !== undefined)
    ? { profile: defaults.motionProfile, intensity: defaults.motionIntensity }
    : { profile: "none", intensity: 0 };
  return {
    motion,
    spawn: null,    // legacy templates have no spawn layer
    death: template?.deathAnimation ?? "softFade"
  };
}
```

- [ ] **Step 4: Run tests again**

Run: `npm test`
Expected: `# pass 46 # fail 0` (42 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/data-model.js tests/lux-effects-fallback.test.js
git commit -m "feat: readEffects() migration helper + tests (Plan 3 task 10)"
```

---

### Task 11: Write `variant-eligibility.js` + tests

**Files:**
- Create: `scripts/variant-eligibility.js`
- Create: `tests/lux-variant-eligibility.test.js`

- [ ] **Step 1: Write tests first**

```js
// tests/lux-variant-eligibility.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVariants, isVariantEligible } from "../scripts/variant-eligibility.js";

const variants = [
  { id: "owl",  name: "Owl" },
  { id: "imp",  name: "Imp",  requires: { class: "warlock", subclass: "pact-of-the-chain" } },
  { id: "drake-cold", name: "Cold Drake", requires: { class: "ranger", subclass: "drakewarden", classLevel: 3 } }
];

test("isVariantEligible: no requires — always eligible", () => {
  assert.equal(isVariantEligible(variants[0], { classes: [] }), true);
});

test("isVariantEligible: matches class + subclass", () => {
  const caster = { classes: [{ name: "warlock", subclass: "pact-of-the-chain", level: 3 }] };
  assert.equal(isVariantEligible(variants[1], caster), true);
});

test("isVariantEligible: class match but subclass mismatch", () => {
  const caster = { classes: [{ name: "warlock", subclass: "fiend", level: 3 }] };
  assert.equal(isVariantEligible(variants[1], caster), false);
});

test("isVariantEligible: class mismatch", () => {
  const caster = { classes: [{ name: "wizard", level: 5 }] };
  assert.equal(isVariantEligible(variants[1], caster), false);
});

test("isVariantEligible: classLevel gate fails if too low", () => {
  const caster = { classes: [{ name: "ranger", subclass: "drakewarden", level: 2 }] };
  assert.equal(isVariantEligible(variants[2], caster), false);
});

test("isVariantEligible: classLevel gate passes at exact level", () => {
  const caster = { classes: [{ name: "ranger", subclass: "drakewarden", level: 3 }] };
  assert.equal(isVariantEligible(variants[2], caster), true);
});

test("filterVariants: returns only eligible", () => {
  const caster = { classes: [{ name: "warlock", subclass: "pact-of-the-chain", level: 3 }] };
  const result = filterVariants(variants, caster);
  assert.equal(result.length, 2);     // owl + imp
  assert.deepEqual(result.map(v => v.id), ["owl", "imp"]);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test tests/lux-variant-eligibility.test.js`
Expected: 7 failing tests.

- [ ] **Step 3: Implement `scripts/variant-eligibility.js`**

```js
// scripts/variant-eligibility.js — pure-logic variant filtering by caster
// eligibility. Used by the variant-picker modal to dim or hide variants the
// caster can't use (Pact of the Chain options for non-warlocks etc.).

export function isVariantEligible(variant, caster) {
  if (!variant?.requires) return true;
  const reqs = variant.requires;
  const classes = caster?.classes ?? [];
  if (reqs.class) {
    const match = classes.find(c => c.name === reqs.class);
    if (!match) return false;
    if (reqs.subclass && match.subclass !== reqs.subclass) return false;
    if (reqs.classLevel !== undefined && (match.level ?? 0) < reqs.classLevel) return false;
  }
  if (reqs.spellSlotLevel !== undefined) {
    const maxSlot = caster?.maxSpellSlotLevel ?? 0;
    if (maxSlot < reqs.spellSlotLevel) return false;
  }
  return true;
}

export function filterVariants(variants, caster) {
  return (variants ?? []).filter(v => isVariantEligible(v, caster));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# pass 53 # fail 0` (46 from previous + 7 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/variant-eligibility.js tests/lux-variant-eligibility.test.js
git commit -m "feat: variant-eligibility pure-logic filter + 7 tests (Plan 3 task 11)"
```

---

### Task 12: Write `source-modes.js` — clone + inline-synthesized + tests

**Files:**
- Create: `scripts/source-modes.js`
- Create: `tests/lux-source-modes.test.js`

This task ships two of the four modes (the two without async I/O). `compendium` and `compendium-scaled` follow in task 13.

- [ ] **Step 1: Tests first**

```js
// tests/lux-source-modes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCloneData, resolveInlineData } from "../scripts/source-modes.js";

test("resolveCloneData: copies actor data, strips _id, applies name prefix/suffix", () => {
  const sourceActor = { id: "abc", name: "Lyra", toObject: () => ({ _id: "abc", name: "Lyra", system: { attributes: { hp: { value: 50, max: 50 } } } }) };
  const result = resolveCloneData(sourceActor, { prefix: "Simulacrum of ", suffix: "", folderId: "f1" });
  assert.equal(result._id, undefined);
  assert.equal(result.name, "Simulacrum of Lyra");
  assert.equal(result.folder, "f1");
  assert.equal(result.system.attributes.hp.value, 50);
});

test("resolveInlineData: produces actor doc from template.source.inline", () => {
  const template = {
    name: "Mage Hand",
    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        system: { attributes: { ac: { flat: 10 }, hp: { value: 1, max: 1 } } },
        prototypeToken: { name: "Mage Hand", actorLink: false }
      }
    }
  };
  const result = resolveInlineData(template, { name: "Mage Hand of Lyra", folderId: "f1" });
  assert.equal(result.type, "npc");
  assert.equal(result.name, "Mage Hand of Lyra");
  assert.equal(result.folder, "f1");
  assert.equal(result.system.attributes.hp.value, 1);
  assert.equal(result.system.attributes.ac.flat, 10);
});

test("resolveInlineData: deep-clones inline so subsequent calls don't share state", () => {
  const template = { name: "Mage Hand", source: { mode: "inline-synthesized", inline: { type: "npc", system: { attributes: { hp: { value: 1 } } } } } };
  const a = resolveInlineData(template, { name: "A", folderId: "f1" });
  const b = resolveInlineData(template, { name: "B", folderId: "f1" });
  a.system.attributes.hp.value = 99;
  assert.equal(b.system.attributes.hp.value, 1);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/lux-source-modes.test.js`
Expected: 3 failing tests.

- [ ] **Step 3: Implement the two synchronous modes in `source-modes.js`**

```js
// scripts/source-modes.js — actor-data resolution per source mode.
//
// `clone`              — duplicate the master actor's data (Simulacrum)
// `inline-synthesized` — synthesize from template.source.inline (Mage Hand etc.)
// `compendium`         — async UUID lookup (Find Familiar etc.)
// `compendium-scaled`  — async UUID lookup + per-cast-level scaling deltas (Summon Dragon)
//
// The two sync modes are pure-logic and unit-tested here.
// The two async modes need Foundry's fromUuid() — defined below but not
// unit-tested directly (covered by manual live-Foundry verification).

export function resolveCloneData(sourceActor, { prefix = "", suffix = "", folderId } = {}) {
  const data = sourceActor.toObject();
  delete data._id;
  data.name = `${prefix}${sourceActor.name}${suffix}`;
  if (folderId) data.folder = folderId;
  return data;
}

export function resolveInlineData(template, { name, folderId } = {}) {
  const inline = template?.source?.inline;
  if (!inline) throw new Error(`template "${template?.id ?? template?.name}" has no source.inline`);
  // Deep-clone via structuredClone to avoid sharing references with the template definition
  const data = structuredClone(inline);
  data.name = name ?? data.name ?? template.name;
  if (folderId) data.folder = folderId;
  return data;
}

// Foundry-side; not unit-tested
export async function resolveCompendiumData(template, variant, { name, folderId } = {}) {
  const uuid = variant?.source?.baseUuid ?? template?.source?.baseUuid;
  if (!uuid) throw new Error(`no baseUuid on template "${template?.id}" or its variant`);
  const actor = await fromUuid(uuid);
  if (!actor) throw new Error(`fromUuid("${uuid}") returned null`);
  const data = actor.toObject();
  delete data._id;
  data.name = name ?? `${data.name} of ${template?.name ?? "?"}`;
  if (folderId) data.folder = folderId;
  return data;
}

export async function resolveCompendiumScaledData(template, variant, { name, folderId, castSlotLevel } = {}) {
  const base = await resolveCompendiumData(template, variant, { name, folderId });
  const scalingTable = template?.source?.scalingTable ?? [];
  const tier = scalingTable.find(row => row.slotLevel === castSlotLevel)
            ?? scalingTable[0];
  if (!tier) return base;
  // Apply HP / damage / attack-bonus deltas
  if (base.system?.attributes?.hp) {
    base.system.attributes.hp.max = (base.system.attributes.hp.max ?? 0) + (tier.hpAdd ?? 0);
    base.system.attributes.hp.value = base.system.attributes.hp.max;
  }
  // damageAdd and attackBonus are applied per-item at spawn-engine layer (need
  // to walk items[] and mutate damage formulas / attack rolls — handled in task 13).
  return base;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# pass 56 # fail 0` (53 from previous + 3 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/source-modes.js tests/lux-source-modes.test.js
git commit -m "feat: source-modes (clone + inline-synthesized) + 3 tests (Plan 3 task 12)"
```

---

### Task 13: Source-modes — scaling table tests (compendium-scaled)

**Files:**
- Modify: `tests/lux-source-modes.test.js`

The async modes touch Foundry's `fromUuid` so can't be unit-tested directly. But the pure-logic scaling-table lookup CAN be — extract that into a pure helper.

- [ ] **Step 1: Add pure helper export to `source-modes.js`**

After `resolveInlineData`, add:

```js
/**
 * Pure-logic helper: given a scaling table and a cast slot level, return
 * the matching scaling tier (or the first tier if no match — handles
 * "cast below the spell's base level" gracefully).
 */
export function pickScalingTier(scalingTable, castSlotLevel) {
  if (!Array.isArray(scalingTable) || scalingTable.length === 0) return null;
  return scalingTable.find(row => row.slotLevel === castSlotLevel) ?? scalingTable[0];
}

/**
 * Pure-logic helper: given a base actor data and a scaling tier, apply
 * HP deltas. Mutates a deep copy of base; returns the result.
 */
export function applyScalingTier(baseData, tier) {
  if (!tier) return baseData;
  const data = structuredClone(baseData);
  if (data.system?.attributes?.hp) {
    data.system.attributes.hp.max = (data.system.attributes.hp.max ?? 0) + (tier.hpAdd ?? 0);
    data.system.attributes.hp.value = data.system.attributes.hp.max;
  }
  return data;
}
```

Update `resolveCompendiumScaledData` to use these helpers:

```js
export async function resolveCompendiumScaledData(template, variant, { name, folderId, castSlotLevel } = {}) {
  const base = await resolveCompendiumData(template, variant, { name, folderId });
  const tier = pickScalingTier(template?.source?.scalingTable ?? [], castSlotLevel);
  return applyScalingTier(base, tier);
}
```

- [ ] **Step 2: Add tests**

Append to `tests/lux-source-modes.test.js`:

```js
import { pickScalingTier, applyScalingTier } from "../scripts/source-modes.js";

const SCALING_TABLE = [
  { slotLevel: 5, hpAdd: 0,  damageAdd: 0, attackBonus: 0 },
  { slotLevel: 6, hpAdd: 10, damageAdd: 1, attackBonus: 1 },
  { slotLevel: 7, hpAdd: 20, damageAdd: 2, attackBonus: 1 },
  { slotLevel: 8, hpAdd: 30, damageAdd: 3, attackBonus: 2 }
];

test("pickScalingTier: exact slot-level match", () => {
  assert.deepEqual(pickScalingTier(SCALING_TABLE, 6), SCALING_TABLE[1]);
});

test("pickScalingTier: no match falls back to first tier", () => {
  assert.deepEqual(pickScalingTier(SCALING_TABLE, 99), SCALING_TABLE[0]);
});

test("pickScalingTier: empty table returns null", () => {
  assert.equal(pickScalingTier([], 5), null);
});

test("applyScalingTier: applies hpAdd to max + value", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  const tier = { slotLevel: 6, hpAdd: 10 };
  const result = applyScalingTier(base, tier);
  assert.equal(result.system.attributes.hp.max, 60);
  assert.equal(result.system.attributes.hp.value, 60);
});

test("applyScalingTier: null tier returns base unchanged", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  assert.equal(applyScalingTier(base, null), base);
});

test("applyScalingTier: deep-clones (mutating result doesn't touch base)", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  const result = applyScalingTier(base, { hpAdd: 10 });
  result.system.attributes.hp.value = 999;
  assert.equal(base.system.attributes.hp.value, 50);
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: `# pass 62 # fail 0` (56 + 6 new).

- [ ] **Step 4: Commit**

```bash
git add scripts/source-modes.js tests/lux-source-modes.test.js
git commit -m "feat: scaling table helpers (pickScalingTier, applyScalingTier) + 6 tests (Plan 3 task 13)"
```

---

### Task 14: Multi-spawn counter — pure-logic + tests

**Files:**
- Create: `scripts/multi-spawn-counter.js`
- Create: `tests/lux-spawn-multispawn.test.js`

The Animate Dead multi-spawn UX needs a stateful counter — increment per variant, validate total ≤ maxActive, dec on undo. Pure-logic, unit-testable.

- [ ] **Step 1: Tests first**

```js
// tests/lux-spawn-multispawn.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCounter, increment, decrement, totalCount, canIncrement } from "../scripts/multi-spawn-counter.js";

test("createCounter: empty counts", () => {
  const c = createCounter({ maxActive: 4 });
  assert.equal(totalCount(c), 0);
  assert.deepEqual(c.counts, {});
});

test("increment: increases variant's count", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  assert.equal(c.counts.skeleton, 1);
  assert.equal(totalCount(c), 1);
});

test("increment: same variant twice", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "skeleton");
  assert.equal(c.counts.skeleton, 2);
});

test("increment: caps at maxActive", () => {
  let c = createCounter({ maxActive: 4 });
  for (let i = 0; i < 5; i++) c = increment(c, "skeleton");
  assert.equal(totalCount(c), 4);
});

test("canIncrement: false at cap", () => {
  let c = createCounter({ maxActive: 2 });
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  assert.equal(canIncrement(c), false);
});

test("decrement: lowers variant's count, floor at 0", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = decrement(c, "skeleton");
  c = decrement(c, "skeleton");
  assert.equal(c.counts.skeleton, 0);
});

test("decrement: removes zero-count entries (clean shape)", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = decrement(c, "skeleton");
  assert.deepEqual(c.counts, {});
});

test("totalCount: sums all variant counts", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  assert.equal(totalCount(c), 3);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/lux-spawn-multispawn.test.js`
Expected: 8 failing tests.

- [ ] **Step 3: Implement**

```js
// scripts/multi-spawn-counter.js — pure-logic counter for Animate Dead's
// multi-variant + multi-token spawn UX. Per-variant counts that sum to ≤
// maxActive. Frozen-shape (each mutation returns a new counter).

export function createCounter({ maxActive }) {
  return { maxActive, counts: {} };
}

export function totalCount(counter) {
  return Object.values(counter.counts).reduce((a, b) => a + b, 0);
}

export function canIncrement(counter) {
  return totalCount(counter) < counter.maxActive;
}

export function increment(counter, variantId) {
  if (!canIncrement(counter)) return counter;
  return {
    ...counter,
    counts: { ...counter.counts, [variantId]: (counter.counts[variantId] ?? 0) + 1 }
  };
}

export function decrement(counter, variantId) {
  const current = counter.counts[variantId] ?? 0;
  if (current <= 1) {
    const { [variantId]: _, ...rest } = counter.counts;
    return { ...counter, counts: rest };
  }
  return { ...counter, counts: { ...counter.counts, [variantId]: current - 1 } };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# pass 70 # fail 0` (62 + 8 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/multi-spawn-counter.js tests/lux-spawn-multispawn.test.js
git commit -m "feat: multi-spawn-counter pure-logic + 8 tests (Plan 3 task 14)"
```

---

### Task 15: Migrate Simulacrum template to new shape

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Rewrite Simulacrum template**

Replace `scripts/templates-builtin.js` content (currently only Simulacrum) with the new-shape version:

```js
// scripts/templates-builtin.js — built-in shipped template definitions

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg",
    aestheticFamily: "hextech",
    trigger: { type: "spell", name: "Simulacrum" },
    triggerSpell: "Simulacrum",   // legacy alias — kept readable during migration
    source: { mode: "clone" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,
    dnd5eMods: {
      halveMaxHp: true,
      blockNaturalRecovery: true,
      snapshotSpellSlots: true,
      repairAction: { cost: 100, healFormula: "4d6+24", timeRequired: "1 hour" }
    },
    effects: {
      motion: { profile: "flame-flicker", intensity: 0.6 },
      spawn:  "hexCrystalForm",   // family default
      death:  "icyShatter"        // signature override
    },
    defaults: {
      // visual / motion defaults referenced by Restyle and per-spawn flows
      hueColor: "#88ccff",
      hueIntensity: 0.15,
      alpha: 0.85,
      saturation: 1.0,
      brightness: 1.0,
      outlineColor: "#aaffff",
      outlineThickness: 3,
      shimmer: false,
      shimmerIntensity: 0,
      namePrefix: "Simulacrum of ",
      nameSuffix: "",
      borderColor: "#88ccff",
      motionProfile: "flame-flicker",     // legacy aliases — Restyle reads these
      motionIntensity: 0.6
    },
    extraActions: [
      { id: "repair", label: "Repair", icon: "fa-solid fa-wrench", handler: "simulacrum.repair" }
    ],
    deathAnimation: "icyShatter"   // legacy alias — death-animations.js falls back to this
  }
];
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: `# pass 70 # fail 0` (no regression; new fields are additive).

- [ ] **Step 3: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "refactor: migrate Simulacrum to unified source + effects shape (Plan 3 task 15)"
```

---

# Phase 3 — Roster authoring

Each task adds one template entry to `scripts/templates-builtin.js`. Compendium UUIDs and inline stat blocks come from the dnd5e 5.2.1 SRD compendium.

---

### Task 16: Find Familiar template

**Files:**
- Modify: `scripts/templates-builtin.js`

**Pre-task verification:** Verify in dnd5e 5.2.1 that the SRD lists 15 (not 14) Find Familiar options. Open the Foundry compendium browser, filter for `Find Familiar` or `familiar`, list the matching Actor entries.

- [ ] **Step 1: Append Find Familiar template**

Add to the `templates` array in `templates-builtin.js`:

```js
{
  id: "find-familiar",
  name: "Find Familiar",
  description: "Bind a tiny spirit-creature as your familiar.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/find-familiar.png",
  aestheticFamily: "belle-epoque",
  trigger: { type: "spell", name: "Find Familiar" },
  triggerSpell: "Find Familiar",
  source: { mode: "compendium" },
  syncMode: "snapshot",
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "idle-breathing", intensity: 1.0 },
    spawn:  "belleBloom",
    death:  "belleFade"
  },
  defaults: {
    hueColor: "#c9a14b",
    hueIntensity: 0.0,
    alpha: 1.0,
    saturation: 1.0,
    brightness: 1.0,
    outlineColor: "#c9a14b",
    outlineThickness: 0,
    namePrefix: "",
    nameSuffix: "",
    borderColor: "#c9a14b",
    motionProfile: "idle-breathing",
    motionIntensity: 1.0
  },
  variants: [
    { id: "bat",       name: "Bat",      thumbnail: "modules/luxurious-summons/assets/variants/bat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.bat-uuid-tbd" } },
    { id: "cat",       name: "Cat",      thumbnail: "modules/luxurious-summons/assets/variants/cat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.cat-uuid-tbd" } },
    { id: "crab",      name: "Crab",     thumbnail: "modules/luxurious-summons/assets/variants/crab.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.crab-uuid-tbd" } },
    { id: "frog",      name: "Frog",     thumbnail: "modules/luxurious-summons/assets/variants/frog.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.frog-uuid-tbd" } },
    { id: "hawk",      name: "Hawk",     thumbnail: "modules/luxurious-summons/assets/variants/hawk.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.hawk-uuid-tbd" } },
    { id: "lizard",    name: "Lizard",   thumbnail: "modules/luxurious-summons/assets/variants/lizard.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.lizard-uuid-tbd" } },
    { id: "octopus",   name: "Octopus",  thumbnail: "modules/luxurious-summons/assets/variants/octopus.png",  source: { baseUuid: "Compendium.dnd5e.monsters.Actor.octopus-uuid-tbd" } },
    { id: "owl",       name: "Owl",      thumbnail: "modules/luxurious-summons/assets/variants/owl.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.owl-uuid-tbd" } },
    { id: "snake",     name: "Poisonous Snake", thumbnail: "modules/luxurious-summons/assets/variants/snake.png", source: { baseUuid: "Compendium.dnd5e.monsters.Actor.snake-uuid-tbd" } },
    { id: "quipper",   name: "Quipper",  thumbnail: "modules/luxurious-summons/assets/variants/quipper.png",  source: { baseUuid: "Compendium.dnd5e.monsters.Actor.quipper-uuid-tbd" } },
    { id: "rat",       name: "Rat",      thumbnail: "modules/luxurious-summons/assets/variants/rat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.rat-uuid-tbd" } },
    { id: "raven",     name: "Raven",    thumbnail: "modules/luxurious-summons/assets/variants/raven.png",    source: { baseUuid: "Compendium.dnd5e.monsters.Actor.raven-uuid-tbd" } },
    { id: "seahorse",  name: "Sea Horse",thumbnail: "modules/luxurious-summons/assets/variants/seahorse.png", source: { baseUuid: "Compendium.dnd5e.monsters.Actor.seahorse-uuid-tbd" } },
    { id: "spider",    name: "Spider",   thumbnail: "modules/luxurious-summons/assets/variants/spider.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.spider-uuid-tbd" } },
    { id: "weasel",    name: "Weasel",   thumbnail: "modules/luxurious-summons/assets/variants/weasel.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.weasel-uuid-tbd" } }
  ],
  deathAnimation: "belleFade"
}
```

**Verification:** Each `<creature>-uuid-tbd` needs replacing with the actual compendium UUID from dnd5e 5.2.1. Open Foundry, find each in the compendium browser, right-click → Copy UUID, paste.

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Find Familiar template + 15 variant scaffold (Plan 3 task 16)"
```

---

### Task 17: Pact of the Chain template

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Append the template**

```js
{
  id: "pact-of-the-chain",
  name: "Pact of the Chain",
  description: "Warlocks with the Pact of the Chain boon bind a fey or fiendish familiar.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/pact-of-the-chain.png",
  aestheticFamily: "belle-epoque",
  trigger: { type: "spell", name: "Find Familiar" },   // shares Find Familiar's trigger
  triggerSpell: "Find Familiar",
  source: { mode: "compendium" },
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "idle-breathing", intensity: 1.0 },
    spawn:  "belleBloom",
    death:  "belleFade"
  },
  defaults: {
    hueColor: "#7a1c1c",          // fiendish red tint by default
    hueIntensity: 0.15,
    alpha: 1.0,
    saturation: 1.0,
    brightness: 1.0,
    outlineColor: "#7a1c1c",
    outlineThickness: 0,
    motionProfile: "idle-breathing",
    motionIntensity: 1.0
  },
  variants: [
    { id: "imp",          name: "Imp",          thumbnail: "modules/luxurious-summons/assets/variants/imp.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.imp-uuid-tbd" },
      requires: { class: "warlock", subclass: "pact-of-the-chain" },
      spawnEffectOverride: "infernalBloom",
      deathEffectOverride: "infernalFade" },
    { id: "pseudodragon", name: "Pseudodragon", thumbnail: "modules/luxurious-summons/assets/variants/pseudodragon.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.pseudodragon-uuid-tbd" },
      requires: { class: "warlock", subclass: "pact-of-the-chain" } },
    { id: "quasit",       name: "Quasit",       thumbnail: "modules/luxurious-summons/assets/variants/quasit.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.quasit-uuid-tbd" },
      requires: { class: "warlock", subclass: "pact-of-the-chain" },
      spawnEffectOverride: "infernalBloom",
      deathEffectOverride: "infernalFade" },
    { id: "sprite",       name: "Sprite",       thumbnail: "modules/luxurious-summons/assets/variants/sprite.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.sprite-uuid-tbd" },
      requires: { class: "warlock", subclass: "pact-of-the-chain" } }
  ],
  deathAnimation: "belleFade"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Pact of the Chain template (4 variants, warlock-gated) (Plan 3 task 17)"
```

---

### Task 18: Animate Dead template

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Append the template**

```js
{
  id: "animate-dead",
  name: "Animate Dead",
  description: "Raise corpses as undead servants. Up to 4 at a time, requires re-bind every 24 hours.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/animate-dead.png",
  aestheticFamily: "belle-epoque",
  trigger: { type: "spell", name: "Animate Dead" },
  triggerSpell: "Animate Dead",
  source: { mode: "compendium" },
  maxActive: 4,
  requiresApproval: false,
  effects: {
    motion: { profile: "idle-breathing", intensity: 0.7 },
    spawn:  "boneRise",
    death:  "boneCollapse"
  },
  defaults: {
    hueColor: "#e8dcc4",          // bone-white tint
    hueIntensity: 0.10,
    alpha: 1.0,
    saturation: 0.6,
    brightness: 0.9,
    outlineColor: "#7a3a3a",      // wine ichor outline
    outlineThickness: 2,
    motionProfile: "idle-breathing",
    motionIntensity: 0.7
  },
  variants: [
    { id: "skeleton", name: "Skeleton", thumbnail: "modules/luxurious-summons/assets/variants/skeleton.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.skeleton-uuid-tbd" } },
    { id: "zombie",   name: "Zombie",   thumbnail: "modules/luxurious-summons/assets/variants/zombie.png",
      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.zombie-uuid-tbd" } }
  ],
  deathAnimation: "boneCollapse"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Animate Dead template (2 variants, maxActive=4) (Plan 3 task 18)"
```

---

### Task 19: Mage Hand template (inline-synthesized)

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Append the template**

```js
{
  id: "mage-hand",
  name: "Mage Hand",
  description: "A spectral, floating hand. Carries up to 10 lb; no attacks.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/mage-hand.png",
  aestheticFamily: "hextech",
  trigger: { type: "spell", name: "Mage Hand" },
  triggerSpell: "Mage Hand",
  source: {
    mode: "inline-synthesized",
    inline: {
      type: "npc",
      img:  "modules/luxurious-summons/assets/tokens/mage-hand.png",
      system: {
        abilities: { str: { value: 1 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 1 } },
        attributes: {
          ac:    { flat: 10 },
          hp:    { value: 1, max: 1 },
          movement: { walk: 0, fly: 30, hover: true }
        },
        details: { type: { value: "construct" }, cr: 0 }
      },
      prototypeToken: {
        name: "Mage Hand",
        actorLink: false,
        sight: { enabled: false }
      }
    }
  },
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "floating-hand", intensity: 1.0 },
    spawn:  "mageHandSparks",
    death:  "mageHandDissolve"
  },
  defaults: {
    hueColor: "#c9a14b",
    hueIntensity: 0.30,
    alpha: 0.85,
    saturation: 1.0,
    brightness: 1.2,
    outlineColor: "#5cd3e8",
    outlineThickness: 2,
    motionProfile: "floating-hand",
    motionIntensity: 1.0
  },
  deathAnimation: "mageHandDissolve"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Mage Hand template (inline-synthesized) (Plan 3 task 19)"
```

---

### Task 20: Unseen Servant template (inline-synthesized)

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Append the template**

```js
{
  id: "unseen-servant",
  name: "Unseen Servant",
  description: "An invisible, mindless servant performs simple manual tasks within 60 ft.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/unseen-servant.png",
  aestheticFamily: "hextech",
  trigger: { type: "spell", name: "Unseen Servant" },
  triggerSpell: "Unseen Servant",
  source: {
    mode: "inline-synthesized",
    inline: {
      type: "npc",
      img:  "modules/luxurious-summons/assets/tokens/unseen-servant.png",
      system: {
        abilities: { str: { value: 2 }, dex: { value: 6 }, con: { value: 10 }, int: { value: 1 }, wis: { value: 1 }, cha: { value: 1 } },
        attributes: {
          ac:    { flat: 10 },
          hp:    { value: 2, max: 2 },
          movement: { walk: 15 }
        },
        details: { type: { value: "construct" }, cr: 0 }
      },
      prototypeToken: { name: "Unseen Servant", actorLink: false, sight: { enabled: false } }
    }
  },
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "ethereal-drift", intensity: 0.4 },
    spawn:  "hexCrystalForm",
    death:  "hexShatter"
  },
  defaults: {
    hueColor: "#c8e8f0",
    hueIntensity: 0.15,
    alpha: 0.15,                  // nearly invisible per RAW
    saturation: 0.5,
    brightness: 1.2,
    outlineColor: "#5cd3e8",
    outlineThickness: 1,
    motionProfile: "ethereal-drift",
    motionIntensity: 0.4
  },
  deathAnimation: "hexShatter"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Unseen Servant template (inline-synthesized, alpha 0.15) (Plan 3 task 20)"
```

---

### Task 21: Echo Knight Echo template (inline + clone-AC, feature trigger)

**Files:**
- Modify: `scripts/templates-builtin.js`

- [ ] **Step 1: Append the template**

```js
{
  id: "echo-knight-echo",
  name: "Echo Knight Echo",
  description: "A translucent armored echo of yourself. Mirrors your AC; 1 HP; can be swapped with via class action.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/echo-knight-echo.png",
  aestheticFamily: "hextech",
  trigger: { type: "feature", name: "Manifest Echo" },
  source: {
    mode: "inline-synthesized",
    inline: {
      type: "npc",
      img:  "modules/luxurious-summons/assets/tokens/echo-knight-echo.png",
      system: {
        abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
        attributes: {
          ac:    { flat: 14 },    // overridden at spawn from caster's AC
          hp:    { value: 1, max: 1 },
          movement: { walk: 30 }
        },
        details: { type: { value: "construct" }, cr: 0 }
      },
      prototypeToken: { name: "Echo", actorLink: false, sight: { enabled: false } }
    }
  },
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "mirror-wobble", intensity: 0.4 },
    spawn:  "echoStep",
    death:  "echoCollapse"
  },
  defaults: {
    hueColor: "#7ea9ff",
    hueIntensity: 0.30,
    alpha: 0.75,
    saturation: 0.7,
    brightness: 1.1,
    outlineColor: "#7ea9ff",
    outlineThickness: 2,
    motionProfile: "mirror-wobble",
    motionIntensity: 0.4
  },
  // Custom post-spawn handler will set hp.value/max from caster's level
  // and ac.flat from caster's ac. Plumbed through extraActions in Plan 3 task 28.
  extraActions: [],
  deathAnimation: "echoCollapse"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Echo Knight Echo template (feature-trigger, inline) (Plan 3 task 21)"
```

---

### Task 22: Summon Dragon template (compendium-scaled)

**Files:**
- Modify: `scripts/templates-builtin.js`

**Pre-task verification:** Look up the Draconic Spirit actor UUID in dnd5e 5.2.1 compendium. Open Foundry, search for "Draconic Spirit" in the Actors compendium, right-click → Copy UUID.

- [ ] **Step 1: Append the template**

```js
{
  id: "summon-dragon",
  name: "Summon Dragon",
  description: "Summon a draconic spirit. Pick a damage type and the spell-slot level.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/summon-dragon.png",
  aestheticFamily: "hextech",
  trigger: { type: "spell", name: "Summon Draconic Spirit" },
  triggerSpell: "Summon Draconic Spirit",
  source: {
    mode: "compendium-scaled",
    baseUuid: "Compendium.dnd5e.monsters.Actor.draconic-spirit-uuid-tbd",
    scalingTable: [
      { slotLevel: 5, hpAdd: 0,  damageAdd: 0, attackBonus: 0 },
      { slotLevel: 6, hpAdd: 10, damageAdd: 1, attackBonus: 1 },
      { slotLevel: 7, hpAdd: 20, damageAdd: 2, attackBonus: 1 },
      { slotLevel: 8, hpAdd: 30, damageAdd: 3, attackBonus: 2 }
    ]
  },
  maxActive: 1,
  requiresApproval: false,
  effects: {
    motion: { profile: "ethereal-drift", intensity: 1.0 },
    spawn:  "hexCrystalForm",
    death:  "hexShatter"
  },
  defaults: {
    hueColor: "#5cd3e8",
    hueIntensity: 0.20,
    alpha: 0.85,
    saturation: 1.0,
    brightness: 1.0,
    outlineColor: "#5cd3e8",
    outlineThickness: 2,
    motionProfile: "ethereal-drift",
    motionIntensity: 1.0
  },
  variants: [
    { id: "acid",      name: "Acid",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-acid.png",
      defaults: { hueColor: "#9aff66", outlineColor: "#9aff66" } },
    { id: "cold",      name: "Cold",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-cold.png",
      defaults: { hueColor: "#c8e8f0", outlineColor: "#c8e8f0" } },
    { id: "fire",      name: "Fire",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-fire.png",
      defaults: { hueColor: "#ff7733", outlineColor: "#ff7733" } },
    { id: "lightning", name: "Lightning", thumbnail: "modules/luxurious-summons/assets/variants/dragon-lightning.png",
      defaults: { hueColor: "#ffee66", outlineColor: "#ffee66" } },
    { id: "poison",    name: "Poison",    thumbnail: "modules/luxurious-summons/assets/variants/dragon-poison.png",
      defaults: { hueColor: "#88dd88", outlineColor: "#88dd88" } }
  ],
  deathAnimation: "hexShatter"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates-builtin.js
git commit -m "feat: Summon Dragon template (compendium-scaled, 5 damage variants) (Plan 3 task 22)"
```

---

# Phase 4 — Spawn-dialog UX (gallery + variant picker)

The UI surfaces. Each touches ApplicationV2 + HandlebarsApplicationMixin patterns paid for in Plans 1 + 2.

---

### Task 23: Gallery dialog skeleton (`spawn-gallery-app.js` + `spawn-gallery.hbs`)

**Files:**
- Create: `scripts/spawn-gallery-app.js`
- Create: `templates/spawn-gallery.hbs`
- Create: `templates/partials/template-gallery-card.hbs`
- Create: `styles/spawn-gallery.css`

- [ ] **Step 1: Create the gallery card partial**

```hbs
{{!-- templates/partials/template-gallery-card.hbs --}}
<div class="luxsum-template-card" data-template-id="{{template.id}}" data-family="{{template.aestheticFamily}}">
  <img class="luxsum-template-thumb" src="{{template.thumbnail}}" alt="{{template.name}}" draggable="false" />
  <div class="luxsum-template-name">{{template.name}}</div>
  <div class="luxsum-template-tagline">{{template.description}}</div>
  {{#if (gt template.variants.length 1)}}
    <div class="luxsum-template-variant-badge">{{template.variants.length}}</div>
  {{/if}}
</div>
```

- [ ] **Step 2: Create the main template**

```hbs
{{!-- templates/spawn-gallery.hbs --}}
<div class="luxsum-spawn-gallery">
  <header class="luxsum-spawn-gallery-header">
    <h2>{{localize "LUXSUM.SpawnGallery.Title"}}</h2>
  </header>
  <div class="luxsum-spawn-gallery-grid">
    {{#each templates as |t|}}
      {{> "modules/luxurious-summons/templates/partials/template-gallery-card.hbs" template=t}}
    {{/each}}
  </div>
  <footer class="luxsum-spawn-gallery-footer">
    <button type="button" data-action="cancel" class="luxsum-btn-outline">{{localize "LUXSUM.Common.Cancel"}}</button>
  </footer>
</div>
```

- [ ] **Step 3: Create the CSS**

```css
/* styles/spawn-gallery.css */
.luxsum-spawn-gallery {
  width: 640px;
  min-height: 480px;
  background: var(--luxsum-bg);
  color: var(--luxsum-text);
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.luxsum-spawn-gallery-header h2 {
  font-family: "Cinzel", serif;
  color: var(--luxsum-accent);
  margin: 0 0 16px;
  font-size: 20px;
}
.luxsum-spawn-gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  flex: 1;
}
.luxsum-template-card {
  position: relative;
  width: 180px;
  height: 180px;
  background: var(--luxsum-bg-elev);
  border: 1px solid var(--luxsum-border);
  border-left-width: 4px;
  border-radius: 4px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.luxsum-template-card[data-family="hextech"]     { border-left-color: var(--luxsum-hex-accent); }
.luxsum-template-card[data-family="belle-epoque"] { border-left-color: var(--luxsum-accent); }
.luxsum-template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.45);
}
.luxsum-template-thumb {
  width: 96px;
  height: 96px;
  object-fit: contain;
  margin-bottom: 8px;
}
.luxsum-template-name {
  font-family: "Cinzel", serif;
  color: var(--luxsum-accent);
  font-size: 14px;
  text-align: center;
}
.luxsum-template-tagline {
  font-size: 11px;
  font-style: italic;
  color: var(--luxsum-text-mute);
  text-align: center;
  margin-top: 4px;
  line-height: 1.3;
}
.luxsum-template-variant-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--luxsum-accent);
  color: var(--luxsum-bg);
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
}
.luxsum-spawn-gallery-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--luxsum-accent);
  padding-top: 12px;
}
```

- [ ] **Step 4: Create the app class**

```js
// scripts/spawn-gallery-app.js — Plan 3 Spawn-dialog gallery (ApplicationV2)
//
// Entry point: Manager → Spawn New tab → opens this. Click a card → opens
// VariantPickerApp for that template (always, even for N=1 variants).
//
// V13/V14 strictness:
//   - HandlebarsApplicationMixin (else "not renderable" throw)
//   - Single-root template (else "must render a single HTML element" throw)
//   - height: "auto" + defensive _updatePosition (else null offsetWidth)
//   - render({ force: true }), not render(true)

import { templates as allTemplates } from "./templates-builtin.js";
import { openVariantPicker } from "./variant-picker-app.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SpawnGalleryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "luxsum-spawn-gallery",
    tag: "div",
    window: {
      title: "LUXSUM.SpawnGallery.Title",
      resizable: false
    },
    position: {
      width: 680,
      height: "auto"
    },
    actions: {
      cancel: SpawnGalleryApp.#onCancel
    }
  };

  static PARTS = {
    body: {
      template: "modules/luxurious-summons/templates/spawn-gallery.hbs",
      root: true
    }
  };

  async _prepareContext() {
    return { templates: allTemplates };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Wire card click → open variant picker
    this.element.querySelectorAll(".luxsum-template-card").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.templateId;
        const template = allTemplates.find(t => t.id === id);
        if (!template) return;
        openVariantPicker(template, { source: "gallery" });
        this.close();
      });
    });
  }

  _updatePosition(position) {
    if (!this.element) return position ?? this.position;
    try {
      return super._updatePosition(position);
    } catch (e) {
      console.log(`[${MODULE_ID}] SpawnGalleryApp._updatePosition suppressed: ${e.message}`);
      return position ?? this.position;
    }
  }

  static #onCancel(event, target) {
    this.close();
  }
}

let _instance = null;
export function openSpawnGallery() {
  if (!_instance || !_instance.rendered) {
    _instance = new SpawnGalleryApp();
  }
  _instance.render({ force: true });
  return _instance;
}
export function getActiveSpawnGallery() {
  return _instance?.rendered ? _instance : null;
}
```

- [ ] **Step 5: Register the partial in `main.js` init hook**

Edit `scripts/main.js` line 28-32, change the `await loader([...])` to include the new partial:

```js
await loader([
  "modules/luxurious-summons/templates/partials/companion-card.hbs",
  "modules/luxurious-summons/templates/partials/template-card.hbs",
  "modules/luxurious-summons/templates/partials/summon-details.hbs",
  "modules/luxurious-summons/templates/partials/template-gallery-card.hbs"
]);
```

- [ ] **Step 6: Add the stylesheet to `module.json`**

Edit `module.json` line 8, append the new CSS:

```json
"styles": ["styles/luxurious.css", "styles/manager.css", "styles/restyle.css", "styles/summon-details.css", "styles/spawn-gallery.css"],
```

- [ ] **Step 7: Add the `gt` Handlebars helper**

In `scripts/main.js`, in the `init` hook, register a `gt` helper for template numeric comparisons (V14 ships fewer helpers — see CLAUDE.md gotcha §Handlebars):

```js
Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
```

Add this just before the `await loader(...)` call.

- [ ] **Step 8: Syntax-check + tests**

Run: `node --check scripts/spawn-gallery-app.js && npm test`
Expected: no syntax errors; `# pass 70 # fail 0`.

- [ ] **Step 9: Commit**

```bash
git add scripts/spawn-gallery-app.js templates/spawn-gallery.hbs templates/partials/template-gallery-card.hbs styles/spawn-gallery.css scripts/main.js module.json
git commit -m "feat: SpawnGalleryApp + spawn-gallery.hbs/css + gt helper (Plan 3 task 23)"
```

---

### Task 24: Variant picker dialog (skeleton, single-variant flow)

**Files:**
- Create: `scripts/variant-picker-app.js`
- Create: `templates/variant-picker.hbs`
- Create: `templates/partials/variant-card.hbs`
- Create: `styles/variant-picker.css`

This task ships the picker for single-variant + simple multi-variant templates (no multi-spawn, no cast-level — those follow in tasks 25, 26).

- [ ] **Step 1: Create the variant-card partial**

```hbs
{{!-- templates/partials/variant-card.hbs --}}
<div class="luxsum-variant-card {{#if selected}}selected{{/if}} {{#if ineligible}}ineligible{{/if}}"
     data-variant-id="{{variant.id}}" {{#if ineligible}}title="{{ineligibilityReason}}"{{/if}}>
  <img class="luxsum-variant-thumb" src="{{variant.thumbnail}}" alt="{{variant.name}}" draggable="false" />
  <div class="luxsum-variant-name">{{variant.name}}</div>
  {{#if ineligible}}<i class="fa-solid fa-lock luxsum-variant-lock"></i>{{/if}}
</div>
```

- [ ] **Step 2: Create the main picker template**

```hbs
{{!-- templates/variant-picker.hbs --}}
<div class="luxsum-variant-picker">
  <header class="luxsum-variant-picker-header">
    <h2>{{template.name}} — {{localize "LUXSUM.VariantPicker.PickVariant"}}</h2>
  </header>
  <div class="luxsum-variant-picker-body">
    <div class="luxsum-variant-picker-left">
      <div class="luxsum-variant-grid">
        {{#each variants as |v|}}
          {{> "modules/luxurious-summons/templates/partials/variant-card.hbs"
              variant=v selected=(eq v.id selectedVariantId) ineligible=v._ineligible ineligibilityReason=v._reason}}
        {{/each}}
      </div>
    </div>
    <div class="luxsum-variant-picker-right">
      {{> "modules/luxurious-summons/templates/partials/summon-details.hbs" details=selectedDetails}}
    </div>
  </div>
  <footer class="luxsum-variant-picker-footer">
    <button type="button" data-action="cancel" class="luxsum-btn-outline">{{localize "LUXSUM.Common.Cancel"}}</button>
    <button type="button" data-action="place"  class="luxsum-btn-primary" {{#unless canPlace}}disabled{{/unless}}>{{localize "LUXSUM.VariantPicker.Place"}}</button>
  </footer>
</div>
```

- [ ] **Step 3: Create the CSS**

```css
/* styles/variant-picker.css */
.luxsum-variant-picker {
  width: 720px;
  min-height: 500px;
  background: var(--luxsum-bg);
  color: var(--luxsum-text);
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.luxsum-variant-picker-header h2 {
  font-family: "Cinzel", serif;
  color: var(--luxsum-accent);
  margin: 0 0 16px;
  font-size: 20px;
}
.luxsum-variant-picker-body {
  display: flex;
  gap: 24px;
  flex: 1;
}
.luxsum-variant-picker-left {
  width: 320px;
  flex-shrink: 0;
}
.luxsum-variant-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-content: start;
  max-height: 360px;
  overflow-y: auto;
}
.luxsum-variant-card {
  position: relative;
  width: 88px;
  height: 88px;
  background: var(--luxsum-bg-elev);
  border: 1px solid var(--luxsum-border);
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.luxsum-variant-card:hover { box-shadow: 0 0 0 2px var(--luxsum-glow); }
.luxsum-variant-card.selected { box-shadow: 0 0 0 2px var(--luxsum-accent-hi); }
.luxsum-variant-card.ineligible { opacity: 0.4; cursor: not-allowed; }
.luxsum-variant-thumb { width: 64px; height: 64px; object-fit: contain; margin-bottom: 4px; }
.luxsum-variant-name { font-size: 11px; color: var(--luxsum-text); text-align: center; }
.luxsum-variant-lock { position: absolute; top: 4px; right: 4px; font-size: 10px; color: var(--luxsum-danger); }
.luxsum-variant-picker-right {
  flex: 1;
  background: var(--luxsum-bg-elev);
  border: 1px solid var(--luxsum-accent);
  padding: 16px;
  border-radius: 4px;
}
.luxsum-variant-picker-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--luxsum-accent);
  padding-top: 12px;
}
```

- [ ] **Step 4: Create the app class**

```js
// scripts/variant-picker-app.js — Plan 3 variant-picker modal (ApplicationV2)
//
// Opens via SpawnGalleryApp click OR via spell-cast trigger. Two-column layout:
// left = variant grid, right = summon-details info card. Single-variant templates
// open with N=1 pre-selected; the user still clicks Place — consistency over
// special-casing.

import { filterVariants, isVariantEligible } from "./variant-eligibility.js";
import { runSpawnFlow } from "./spawn-flow.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "luxsum-variant-picker",
    tag: "div",
    window: { title: "LUXSUM.VariantPicker.Title", resizable: false },
    position: { width: 760, height: "auto" },
    actions: {
      cancel: VariantPickerApp.#onCancel,
      place:  VariantPickerApp.#onPlace
    }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/variant-picker.hbs", root: true }
  };

  constructor(template, ctx = {}) {
    super();
    this.template = template;
    this.ctx = ctx;
    const variants = template.variants ?? [{ id: "__default__", name: template.name }];
    // Annotate with eligibility for the active caster
    const caster = ctx.caster ?? readActiveCaster();
    this._eligibleVariants = variants.map(v => {
      const eligible = isVariantEligible(v, caster);
      return { ...v, _ineligible: !eligible, _reason: eligible ? null : "Not eligible — check class/subclass/level requirements." };
    });
    this.selectedVariantId = this._eligibleVariants.find(v => !v._ineligible)?.id ?? this._eligibleVariants[0]?.id;
  }

  async _prepareContext() {
    const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    return {
      template: this.template,
      variants: this._eligibleVariants,
      selectedVariantId: this.selectedVariantId,
      selectedDetails: await this.#buildDetailsCard(selected),
      canPlace: !!selected && !selected._ineligible
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll(".luxsum-variant-card").forEach(el => {
      if (el.classList.contains("ineligible")) return;
      el.addEventListener("click", () => {
        this.selectedVariantId = el.dataset.variantId;
        this.render({ parts: ["body"] });
      });
      el.addEventListener("dblclick", () => {
        this.selectedVariantId = el.dataset.variantId;
        VariantPickerApp.#onPlace.call(this);
      });
    });
  }

  _updatePosition(position) {
    if (!this.element) return position ?? this.position;
    try { return super._updatePosition(position); }
    catch (e) {
      console.log(`[${MODULE_ID}] VariantPickerApp._updatePosition suppressed: ${e.message}`);
      return position ?? this.position;
    }
  }

  async #buildDetailsCard(variant) {
    // Resolve actor data minimally to populate the info card. For compendium
    // variants, fromUuid the base; for inline-synthesized, read template.source.inline.
    // For Plan 3 task 24 (skeleton), return a placeholder.
    return {
      name: variant?.name ?? this.template.name,
      tagline: this.template.description,
      // ac, hp, speed, abilities — filled in by task 26
      ac: null,
      hp: null,
      speed: null,
      abilities: null
    };
  }

  static async #onCancel(event, target) {
    this.close();
  }

  static async #onPlace(event, target) {
    const variant = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    if (!variant) return;
    const placementCtx = {
      template: this.template,
      variantId: variant.id !== "__default__" ? variant.id : null,
      castSlotLevel: this.ctx.castSlotLevel ?? null,
      sourcePlayerId: game.user.id,
      sourceActor: this.ctx.sourceActor ?? game.user.character
    };
    this.close();
    await runSpawnFlow(placementCtx);
  }
}

function readActiveCaster() {
  // Snapshot the user's character into the shape variant-eligibility expects
  const char = game.user.character;
  if (!char) return { classes: [], maxSpellSlotLevel: 0 };
  // dnd5e v5 puts class info on actor.classes (a record keyed by class id)
  const classes = Object.values(char.classes ?? {}).map(cls => ({
    name:     cls.identifier?.toLowerCase() ?? cls.name?.toLowerCase(),
    subclass: cls.subclass?.identifier?.toLowerCase() ?? cls.subclass?.name?.toLowerCase(),
    level:    cls.system?.levels ?? cls.system?.level ?? 0
  }));
  return { classes, maxSpellSlotLevel: 0 };  // maxSlotLevel populated later if needed
}

let _instance = null;
export function openVariantPicker(template, ctx = {}) {
  if (_instance?.rendered) _instance.close();
  _instance = new VariantPickerApp(template, ctx);
  _instance.render({ force: true });
  return _instance;
}
export function getActiveVariantPicker() {
  return _instance?.rendered ? _instance : null;
}
```

- [ ] **Step 5: Add `variant-card.hbs` to the partial loader**

In `scripts/main.js` `init` hook, extend the partial list:

```js
await loader([
  "modules/luxurious-summons/templates/partials/companion-card.hbs",
  "modules/luxurious-summons/templates/partials/template-card.hbs",
  "modules/luxurious-summons/templates/partials/summon-details.hbs",
  "modules/luxurious-summons/templates/partials/template-gallery-card.hbs",
  "modules/luxurious-summons/templates/partials/variant-card.hbs"
]);
```

- [ ] **Step 6: Add `variant-picker.css` to `module.json`**

```json
"styles": ["styles/luxurious.css", "styles/manager.css", "styles/restyle.css", "styles/summon-details.css", "styles/spawn-gallery.css", "styles/variant-picker.css"],
```

- [ ] **Step 7: Syntax-check**

Run: `node --check scripts/variant-picker-app.js && npm test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add scripts/variant-picker-app.js templates/variant-picker.hbs templates/partials/variant-card.hbs styles/variant-picker.css scripts/main.js module.json
git commit -m "feat: VariantPickerApp skeleton (single-variant + simple multi-variant) (Plan 3 task 24)"
```

---

### Task 25: Variant picker — cast-level selector for compendium-scaled

**Files:**
- Modify: `scripts/variant-picker-app.js`
- Modify: `templates/variant-picker.hbs`
- Modify: `styles/variant-picker.css`

- [ ] **Step 1: Add cast-level selector markup to `variant-picker.hbs`**

Insert this block immediately after the closing `</div>` of `.luxsum-variant-picker-left` (i.e., between the two columns' contents) — no, actually it should be inside `.luxsum-variant-picker-left` after the grid:

```hbs
{{#if showCastLevelSelector}}
  <div class="luxsum-cast-level-row">
    <label>{{localize "LUXSUM.VariantPicker.CastLevel"}}:</label>
    <select class="luxsum-cast-level-select" data-action="cast-level-change">
      {{#each castLevelOptions as |opt|}}
        <option value="{{opt.level}}" {{#if (eq opt.level selectedCastSlotLevel)}}selected{{/if}}>{{opt.label}}</option>
      {{/each}}
    </select>
  </div>
{{/if}}
```

- [ ] **Step 2: Update `_prepareContext` in `variant-picker-app.js`**

Modify `_prepareContext`:

```js
async _prepareContext() {
  const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
  const sourceMode = this.template.source?.mode;
  const showCastLevelSelector = sourceMode === "compendium-scaled";
  const castLevelOptions = showCastLevelSelector
    ? (this.template.source.scalingTable ?? []).map(row => ({
        level: row.slotLevel,
        label: `${row.slotLevel}${row.slotLevel === 1 ? "st" : row.slotLevel === 2 ? "nd" : row.slotLevel === 3 ? "rd" : "th"} level`
      }))
    : [];
  this.selectedCastSlotLevel ??= this.ctx.castSlotLevel ?? castLevelOptions[0]?.level;
  return {
    template: this.template,
    variants: this._eligibleVariants,
    selectedVariantId: this.selectedVariantId,
    selectedDetails: await this.#buildDetailsCard(selected),
    canPlace: !!selected && !selected._ineligible,
    showCastLevelSelector,
    castLevelOptions,
    selectedCastSlotLevel: this.selectedCastSlotLevel
  };
}
```

- [ ] **Step 3: Wire the select element**

Update `_onRender`:

```js
_onRender(context, options) {
  super._onRender?.(context, options);
  this.element.querySelectorAll(".luxsum-variant-card").forEach(el => {
    if (el.classList.contains("ineligible")) return;
    el.addEventListener("click", () => {
      this.selectedVariantId = el.dataset.variantId;
      this.render({ parts: ["body"] });
    });
    el.addEventListener("dblclick", () => {
      this.selectedVariantId = el.dataset.variantId;
      VariantPickerApp.#onPlace.call(this);
    });
  });
  // Cast-level selector
  this.element.querySelector(".luxsum-cast-level-select")?.addEventListener("change", (e) => {
    this.selectedCastSlotLevel = parseInt(e.target.value, 10);
    // No re-render — info card stat scaling display lives there (task 26)
  });
}
```

- [ ] **Step 4: Plumb selected cast level into `#onPlace`**

Update `#onPlace`:

```js
static async #onPlace(event, target) {
  const variant = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
  if (!variant) return;
  const placementCtx = {
    template: this.template,
    variantId: variant.id !== "__default__" ? variant.id : null,
    castSlotLevel: this.selectedCastSlotLevel ?? this.ctx.castSlotLevel ?? null,
    sourcePlayerId: game.user.id,
    sourceActor: this.ctx.sourceActor ?? game.user.character
  };
  this.close();
  await runSpawnFlow(placementCtx);
}
```

- [ ] **Step 5: Style the selector**

Append to `styles/variant-picker.css`:

```css
.luxsum-cast-level-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
}
.luxsum-cast-level-row label { color: var(--luxsum-accent); }
.luxsum-cast-level-select {
  background: var(--luxsum-bg);
  color: var(--luxsum-text);
  border: 1px solid var(--luxsum-accent);
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 3px;
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/variant-picker-app.js templates/variant-picker.hbs styles/variant-picker.css
git commit -m "feat: cast-level selector for compendium-scaled templates (Plan 3 task 25)"
```

---

### Task 26: Variant picker — info-card stat resolution

**Files:**
- Modify: `scripts/variant-picker-app.js`

Resolve the variant's actor data (via `source-modes.js`) so the info card shows real stats.

- [ ] **Step 1: Update `#buildDetailsCard` to resolve real stats**

Replace the placeholder `#buildDetailsCard` with:

```js
async #buildDetailsCard(variant) {
  if (!variant) return { name: "—", tagline: "", ac: null, hp: null, speed: null, abilities: null };
  const sourceMode = this.template.source?.mode;
  let actorData = null;
  try {
    if (sourceMode === "compendium" || sourceMode === "compendium-scaled") {
      const { resolveCompendiumData, resolveCompendiumScaledData } = await import("./source-modes.js");
      actorData = sourceMode === "compendium-scaled"
        ? await resolveCompendiumScaledData(this.template, variant, { name: variant.name, castSlotLevel: this.selectedCastSlotLevel })
        : await resolveCompendiumData(this.template, variant, { name: variant.name });
    } else if (sourceMode === "inline-synthesized") {
      const { resolveInlineData } = await import("./source-modes.js");
      actorData = resolveInlineData(this.template, { name: variant.name ?? this.template.name });
    } else if (sourceMode === "clone") {
      const source = this.ctx.sourceActor ?? game.user.character;
      if (source) {
        const { resolveCloneData } = await import("./source-modes.js");
        actorData = resolveCloneData(source, { prefix: this.template.defaults?.namePrefix ?? "", suffix: this.template.defaults?.nameSuffix ?? "" });
      }
    }
  } catch (e) {
    console.warn(`[${MODULE_ID}] info-card data resolution failed for variant "${variant.id}":`, e);
  }
  if (!actorData) return { name: variant.name, tagline: this.template.description, ac: null, hp: null, speed: null, abilities: null };
  const sys = actorData.system ?? {};
  const speedParts = [];
  const mv = sys.attributes?.movement ?? {};
  if (mv.walk)  speedParts.push(`Walk ${mv.walk}`);
  if (mv.fly)   speedParts.push(`Fly ${mv.fly}`);
  if (mv.swim)  speedParts.push(`Swim ${mv.swim}`);
  if (mv.climb) speedParts.push(`Climb ${mv.climb}`);
  return {
    name: variant.name,
    tagline: this.template.description,
    ac: sys.attributes?.ac?.flat ?? sys.attributes?.ac?.value ?? null,
    hp: sys.attributes?.hp ? `${sys.attributes.hp.value} / ${sys.attributes.hp.max}` : null,
    speed: speedParts.length ? speedParts.join(" • ") : null,
    abilities: sys.abilities ?? null
  };
}
```

- [ ] **Step 2: Re-render on cast-level change so the info card updates**

In `_onRender`, update the cast-level handler:

```js
this.element.querySelector(".luxsum-cast-level-select")?.addEventListener("change", (e) => {
  this.selectedCastSlotLevel = parseInt(e.target.value, 10);
  this.render({ parts: ["body"] });   // re-render to refresh info card stats
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/variant-picker-app.js
git commit -m "feat: variant picker resolves real stats per variant + cast level (Plan 3 task 26)"
```

---

### Task 27: Multi-spawn flow (Animate Dead)

**Files:**
- Modify: `scripts/variant-picker-app.js`
- Modify: `templates/partials/variant-card.hbs`
- Modify: `templates/variant-picker.hbs`
- Modify: `styles/variant-picker.css`

- [ ] **Step 1: Update `variant-card.hbs` to show stepper when multispawn**

```hbs
{{!-- templates/partials/variant-card.hbs --}}
<div class="luxsum-variant-card {{#if selected}}selected{{/if}} {{#if ineligible}}ineligible{{/if}}"
     data-variant-id="{{variant.id}}" {{#if ineligible}}title="{{ineligibilityReason}}"{{/if}}>
  <img class="luxsum-variant-thumb" src="{{variant.thumbnail}}" alt="{{variant.name}}" draggable="false" />
  <div class="luxsum-variant-name">{{variant.name}}</div>
  {{#if ineligible}}<i class="fa-solid fa-lock luxsum-variant-lock"></i>{{/if}}
  {{#if showStepper}}
    <div class="luxsum-variant-stepper">
      <button type="button" data-action="dec" data-variant-id="{{variant.id}}">−</button>
      <span class="luxsum-variant-count">{{count}}</span>
      <button type="button" data-action="inc" data-variant-id="{{variant.id}}">+</button>
    </div>
  {{/if}}
</div>
```

- [ ] **Step 2: Add multispawn total + Place button text to picker template**

Modify `templates/variant-picker.hbs` — add total indicator inside `.luxsum-variant-picker-left`:

```hbs
{{#if multiSpawn}}
  <div class="luxsum-multispawn-total">
    {{localize "LUXSUM.VariantPicker.MultispawnTotal"}}: {{multispawnTotal}} / {{multispawnMax}}
  </div>
{{/if}}
```

Update the Place button:

```hbs
<button type="button" data-action="place" class="luxsum-btn-primary" {{#unless canPlace}}disabled{{/unless}}>
  {{#if multiSpawn}}{{localize "LUXSUM.VariantPicker.PlaceN" count=multispawnTotal}}{{else}}{{localize "LUXSUM.VariantPicker.Place"}}{{/if}}
</button>
```

- [ ] **Step 3: Plumb counter into the app class**

In `variant-picker-app.js`, import + initialize the counter:

```js
import { createCounter, increment, decrement, totalCount, canIncrement } from "./multi-spawn-counter.js";
```

In `constructor`, after the existing init:

```js
this.multiSpawn = template.maxActive > 1;
this.counter = this.multiSpawn ? createCounter({ maxActive: template.maxActive }) : null;
```

Update `_prepareContext`:

```js
async _prepareContext() {
  const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
  const sourceMode = this.template.source?.mode;
  const showCastLevelSelector = sourceMode === "compendium-scaled";
  const castLevelOptions = showCastLevelSelector
    ? (this.template.source.scalingTable ?? []).map(row => ({
        level: row.slotLevel,
        label: `${row.slotLevel}${row.slotLevel === 1 ? "st" : row.slotLevel === 2 ? "nd" : row.slotLevel === 3 ? "rd" : "th"} level`
      }))
    : [];
  this.selectedCastSlotLevel ??= this.ctx.castSlotLevel ?? castLevelOptions[0]?.level;
  // Multispawn: annotate variants with count
  const variantsWithCount = this._eligibleVariants.map(v => ({
    ...v,
    count: this.counter?.counts?.[v.id] ?? 0,
    showStepper: this.multiSpawn
  }));
  const multispawnTotal = this.multiSpawn ? totalCount(this.counter) : 0;
  return {
    template: this.template,
    variants: variantsWithCount,
    selectedVariantId: this.selectedVariantId,
    selectedDetails: await this.#buildDetailsCard(selected),
    canPlace: this.multiSpawn ? multispawnTotal > 0 : (!!selected && !selected._ineligible),
    showCastLevelSelector,
    castLevelOptions,
    selectedCastSlotLevel: this.selectedCastSlotLevel,
    multiSpawn: this.multiSpawn,
    multispawnTotal,
    multispawnMax: this.template.maxActive
  };
}
```

- [ ] **Step 4: Wire stepper buttons in `_onRender`**

Append inside `_onRender`:

```js
if (this.multiSpawn) {
  this.element.querySelectorAll('.luxsum-variant-stepper button[data-action="inc"]').forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.variantId;
      if (canIncrement(this.counter)) {
        this.counter = increment(this.counter, id);
        this.render({ parts: ["body"] });
      }
    });
  });
  this.element.querySelectorAll('.luxsum-variant-stepper button[data-action="dec"]').forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      this.counter = decrement(this.counter, b.dataset.variantId);
      this.render({ parts: ["body"] });
    });
  });
}
```

- [ ] **Step 5: Update `#onPlace` for multispawn**

```js
static async #onPlace(event, target) {
  if (this.multiSpawn) {
    // Build a sequence of variantIds to place (e.g., 2 skeletons + 1 zombie)
    const sequence = [];
    for (const [variantId, count] of Object.entries(this.counter.counts)) {
      for (let i = 0; i < count; i++) sequence.push(variantId);
    }
    if (sequence.length === 0) return;
    this.close();
    for (const variantId of sequence) {
      await runSpawnFlow({
        template: this.template,
        variantId,
        castSlotLevel: this.selectedCastSlotLevel ?? null,
        sourcePlayerId: game.user.id,
        sourceActor: this.ctx.sourceActor ?? game.user.character
      });
    }
    return;
  }
  // single-spawn path (unchanged from task 25)
  const variant = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
  if (!variant) return;
  this.close();
  await runSpawnFlow({
    template: this.template,
    variantId: variant.id !== "__default__" ? variant.id : null,
    castSlotLevel: this.selectedCastSlotLevel ?? this.ctx.castSlotLevel ?? null,
    sourcePlayerId: game.user.id,
    sourceActor: this.ctx.sourceActor ?? game.user.character
  });
}
```

- [ ] **Step 6: Style the stepper + total**

Append to `styles/variant-picker.css`:

```css
.luxsum-variant-stepper {
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--luxsum-accent);
}
.luxsum-variant-stepper button {
  background: transparent;
  border: 1px solid var(--luxsum-accent);
  color: var(--luxsum-accent);
  width: 16px;
  height: 16px;
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.luxsum-variant-stepper button:hover { background: var(--luxsum-accent); color: var(--luxsum-bg); }
.luxsum-variant-count { min-width: 14px; text-align: center; }
.luxsum-multispawn-total {
  margin-top: 8px;
  text-align: right;
  font-size: 12px;
  color: var(--luxsum-accent);
}
```

- [ ] **Step 7: Commit**

```bash
git add scripts/variant-picker-app.js templates/partials/variant-card.hbs templates/variant-picker.hbs styles/variant-picker.css
git commit -m "feat: multi-spawn flow for Animate Dead (stepper + total + Place N) (Plan 3 task 27)"
```

---

### Task 28: Spawn-flow refactor + source-mode integration

**Files:**
- Modify: `scripts/spawn-flow.js`
- Modify: `scripts/spawn-engine.js`

- [ ] **Step 1: Update `spawn-flow.js` to accept the new placement context**

Replace `spawn-flow.js` content (assuming the existing runSpawnFlow signature; verify with `Read` before editing):

```js
// scripts/spawn-flow.js — orchestrates placement → spawn-engine for any template.
// Plan 3: accepts the new placement context with template + variantId +
// castSlotLevel + sourcePlayerId + sourceActor.

import { checkRestrictions } from "./spawn-engine.js";
import { activatePlacement } from "./placement-overlay.js";
import { postBrokerRequest } from "./chat-broker.js";
import { performSpawn } from "./spawn-engine.js";

const MODULE_ID = "luxurious-summons";

export async function runSpawnFlow(ctx) {
  const { template, variantId = null, castSlotLevel = null, sourcePlayerId, sourceActor } = ctx;
  if (!template) throw new Error("runSpawnFlow: template is required");
  if (!sourceActor) {
    ui.notifications?.warn(`[${MODULE_ID}] no source actor — assign a character to your user first.`);
    return;
  }

  // Restriction check (per-player, per-template caps + global cap + anti-spam)
  const userFlag = game.user.flags?.[MODULE_ID];
  const active = (userFlag?.activeCompanions ?? []).filter(c => game.actors.get(c.actorId));
  const recent = userFlag?.recentSpawnTimestamps ?? [];
  const config = {
    globalCap: game.settings.get(MODULE_ID, "globalCap"),
    antispamMax: game.settings.get(MODULE_ID, "antispamMax"),
    antispamWindowSeconds: game.settings.get(MODULE_ID, "antispamWindowSeconds")
  };
  const restriction = checkRestrictions({ template, activeCompanions: active, recentSpawnTimestamps: recent, now: Date.now(), config });
  if (!restriction.allowed) {
    ui.notifications?.warn(`[${MODULE_ID}] ${restriction.message}`);
    return;
  }

  // Placement
  const placement = await activatePlacement({ gridIcon: template.thumbnail });
  if (!placement) return;

  const payload = {
    templateId: template.id,
    variantId,
    castSlotLevel,
    sourceActorId: sourceActor.id,
    sourcePlayerId,
    placements: [{ x: placement.x, y: placement.y, sceneId: placement.sceneId ?? canvas.scene.id }]
  };

  if (game.user.isGM) {
    await performSpawn(payload);
  } else {
    await postBrokerRequest("spawn", payload);
  }
}
```

- [ ] **Step 2: Update `performSpawn` in `spawn-engine.js` to use source-modes**

Read the existing `performSpawn` function in `scripts/spawn-engine.js`. Replace the body (lines 70-134 in current source) with:

```js
export async function performSpawn(payload) {
  const { templateId, variantId, castSlotLevel, sourceActorId, sourcePlayerId, placements, visualOverrides } = payload;
  const sourceActor = game.actors.get(sourceActorId);
  if (!sourceActor) throw new Error(`source actor ${sourceActorId} not found`);

  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === templateId);
  if (!template) throw new Error(`template ${templateId} not found`);

  const variant = variantId ? (template.variants ?? []).find(v => v.id === variantId) : null;

  const masterName = sourceActor.name;
  const folder = await ensureMasterFolder(masterName);

  const { resolveCloneData, resolveCompendiumData, resolveCompendiumScaledData, resolveInlineData } = await import("./source-modes.js");
  const mode = template.source?.mode;

  const createdActorIds = [];
  for (const placement of placements) {
    // 1. Resolve actor data per source mode
    const prefix = variant?.defaults?.namePrefix ?? visualOverrides?.namePrefix ?? template.defaults?.namePrefix ?? "";
    const suffix = variant?.defaults?.nameSuffix ?? visualOverrides?.nameSuffix ?? template.defaults?.nameSuffix ?? "";
    const synthName = variant
      ? `${variant.name} of ${masterName}`
      : `${prefix}${masterName}${suffix}`;

    let actorData;
    if (mode === "clone") {
      actorData = resolveCloneData(sourceActor, { prefix, suffix, folderId: folder.id });
    } else if (mode === "compendium") {
      actorData = await resolveCompendiumData(template, variant, { name: synthName, folderId: folder.id });
    } else if (mode === "compendium-scaled") {
      actorData = await resolveCompendiumScaledData(template, variant, { name: synthName, folderId: folder.id, castSlotLevel });
    } else if (mode === "inline-synthesized") {
      actorData = resolveInlineData(template, { name: synthName, folderId: folder.id });
    } else {
      throw new Error(`unknown source.mode "${mode}" on template "${template.id}"`);
    }

    // 2. Effective visual defaults (template + variant + per-spawn overrides)
    const variantDefaults = variant?.defaults ?? {};
    const effectiveDefaults = { ...template.defaults, ...variantDefaults, ...(visualOverrides ?? {}) };
    const motionDefaults = (effectiveDefaults.motionProfile && effectiveDefaults.motionIntensity !== undefined)
      ? { profile: effectiveDefaults.motionProfile, intensity: effectiveDefaults.motionIntensity }
      : null;

    // 3. Companion-record flag
    actorData.flags = { ...actorData.flags,
      [MODULE_ID]: makeCompanionFlag({
        templateId,
        sourceActorId,
        sourcePlayerId,
        sourceMode: template.syncMode ?? "snapshot",
        visualDefaults: effectiveDefaults,
        motionDefaults
      })
    };
    actorData.flags[MODULE_ID].variantId = variantId;
    actorData.flags[MODULE_ID].castSlotLevel = castSlotLevel;
    actorData.flags[MODULE_ID].spawnState = "pending-spawn";   // task 30 — drives spawn animation

    // 4. Ownership transfer
    actorData.ownership = { default: 0, [sourcePlayerId]: 3 };

    // 5. Create the actor
    const newActor = await Actor.create(actorData);
    createdActorIds.push(newActor.id);

    // 6. dnd5e mods (Simulacrum only for now — other templates may add their own in Plan 4+)
    if (template.dnd5eMods) {
      const { applyDnd5eMods } = await import("./dnd5e-mods.js");
      await applyDnd5eMods(newActor, sourceActor, template);
    }

    // 7. Per-template post-spawn hook
    if (templateId === "simulacrum") {
      const { onAfterSpawn } = await import("./handlers/simulacrum.js");
      await onAfterSpawn(newActor, sourceActor);
    }
    if (templateId === "echo-knight-echo") {
      // Mirror caster's AC into the echo (per RAW)
      const casterAc = sourceActor.system?.attributes?.ac?.value ?? 14;
      await newActor.update({ "system.attributes.ac.flat": casterAc });
    }

    // 8. Place token
    const scene = game.scenes.get(placement.sceneId) ?? game.scenes.current;
    const tokenData = (await newActor.getTokenDocument({ x: placement.x, y: placement.y })).toObject();
    tokenData.flags = { ...(tokenData.flags ?? {}), [MODULE_ID]: { isCompanionToken: true, sourcePlayerId } };
    await scene.createEmbeddedDocuments("Token", [tokenData]);
  }

  const { refreshUserIndexes } = await import("./data-model.js");
  await refreshUserIndexes();

  console.log(`[${MODULE_ID}] performSpawn: created ${createdActorIds.length} companion(s) for template ${templateId}${variantId ? ` (variant ${variantId})` : ""}`);
  return { actorIds: createdActorIds };
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check scripts/spawn-flow.js && node --check scripts/spawn-engine.js && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add scripts/spawn-flow.js scripts/spawn-engine.js
git commit -m "feat: spawn flow + engine routed through source-modes (Plan 3 task 28)"
```

---

### Task 29: Wire Manager → SpawnGallery; remove legacy spawn-app

**Files:**
- Modify: `scripts/manager-app.js`
- Delete: `scripts/spawn-app.js`
- Delete: `templates/spawn.hbs`

- [ ] **Step 1: Update manager's "Spawn New" CTA to open the gallery**

Read `scripts/manager-app.js` around the "Spawn New" CTA (search for `#onSpawnNew` or similar). Replace its body with:

```js
async #onSpawnNew(templateId) {
  // Plan 3: if templateId is passed, skip the gallery and open the variant picker for that template.
  // Otherwise open the gallery.
  if (templateId) {
    const { templates } = await import("./templates-builtin.js");
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const { openVariantPicker } = await import("./variant-picker-app.js");
      openVariantPicker(template, { sourceActor: game.user.character });
      return;
    }
  }
  const { openSpawnGallery } = await import("./spawn-gallery-app.js");
  openSpawnGallery();
}
```

- [ ] **Step 2: Delete legacy files**

```bash
rm scripts/spawn-app.js templates/spawn.hbs
```

- [ ] **Step 3: Remove imports of `spawn-app.js` from other scripts**

Run: `grep -rn 'spawn-app' scripts/` — for each match, replace with the new openSpawnGallery / openVariantPicker import.

- [ ] **Step 4: Test**

Run: `npm test`
Expected: `# pass 70 # fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/manager-app.js
git rm scripts/spawn-app.js templates/spawn.hbs
git commit -m "refactor: replace spawn-app with gallery + picker; remove legacy (Plan 3 task 29)"
```

---

# Phase 5 — Spawn-animation playback

The token-tagging + drawToken hook wiring that plays spawn animations once when a token first appears.

---

### Task 30: Wire `maybeRunSpawnAnimation` to `drawToken`

**Files:**
- Create: `scripts/spawn-trigger-anim.js`
- Modify: `scripts/main.js`

- [ ] **Step 1: Create the trigger module**

```js
// scripts/spawn-trigger-anim.js — drawToken hook handler that plays a spawn
// animation once when a freshly-spawned companion token appears on canvas.
//
// The actor flag `spawnState: "pending-spawn"` is set by performSpawn after
// token creation. This handler reads it, plays the right effect via the
// template + variant override resolution chain, and clears the flag so
// subsequent drawToken events (scene reload, token reveal) don't re-play.

import { readEffects } from "./data-model.js";

const MODULE_ID = "luxurious-summons";

export async function maybeRunSpawnAnimation(token) {
  const flag = token.actor?.flags?.[MODULE_ID];
  if (flag?.spawnState !== "pending-spawn") return;
  if (!game.settings.get(MODULE_ID, "enableDeathAnimations")) {
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === flag.templateId);
  if (!template) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: template "${flag.templateId}" not found`);
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const effects = readEffects(template);
  const variant = flag.variantId ? (template.variants ?? []).find(v => v.id === flag.variantId) : null;
  const spawnId = variant?.spawnEffectOverride ?? effects.spawn;
  if (!spawnId) {
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const { spawnAnimations } = await import("./spawn-animations.js");
  const handler = spawnAnimations[spawnId];
  if (!handler) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: no animation registered for "${spawnId}"`);
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  console.log(`[${MODULE_ID}] playing spawn animation "${spawnId}" for ${token.actor.name}`);
  try {
    await handler(token);
  } catch (e) {
    console.warn(`[${MODULE_ID}] spawn animation "${spawnId}" threw:`, e);
  }
  await token.actor.unsetFlag(MODULE_ID, "spawnState");
}
```

- [ ] **Step 2: Wire the hook in `main.js`**

Find the existing `Hooks.on("drawToken", ...)` block and extend it:

```js
Hooks.on("drawToken", async (token) => {
  applyFiltersToToken(token);
  const { maybeRunSpawnAnimation } = await import("./spawn-trigger-anim.js");
  await maybeRunSpawnAnimation(token);
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/spawn-trigger-anim.js scripts/main.js
git commit -m "feat: spawn-animation playback via drawToken hook (Plan 3 task 30)"
```

---

### Task 31: Effect-texture preloading at module ready

**Files:**
- Modify: `scripts/main.js`

- [ ] **Step 1: Add texture preload to ready hook**

Inside the `Hooks.once("ready", ...)` callback, after the `dnd5e` system check but before `installBrokerHook`:

```js
// Preload effect textures used by spawn + death animations
try {
  const { setEffectTextures } = await import("./effect-textures.js");
  const textures = {
    hexShard: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/hex-shard.svg"),
    goldMote: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/gold-mote.svg"),
    ember:    await PIXI.Assets.load("modules/luxurious-summons/assets/effects/ember.svg"),
    boneMote: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/bone-mote.svg")
  };
  setEffectTextures(textures);
  console.log(`[${MODULE_ID}] preloaded 4 effect textures`);
} catch (e) {
  console.warn(`[${MODULE_ID}] effect-texture preload failed:`, e);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/main.js
git commit -m "feat: preload effect SVG textures at module ready (Plan 3 task 31)"
```

---

# Phase 6 — Asset generation (parallel track)

Each asset-gen task dispatches the asset-planner agent via the Agent tool. Generated assets are dropped into `assets/`, manually verified, then committed.

---

### Task 32: Generate template thumbnails (8 total)

**Files:**
- Create: `assets/templates-thumbs/find-familiar.png`
- Create: `assets/templates-thumbs/pact-of-the-chain.png`
- Create: `assets/templates-thumbs/animate-dead.png`
- Create: `assets/templates-thumbs/mage-hand.png`
- Create: `assets/templates-thumbs/unseen-servant.png`
- Create: `assets/templates-thumbs/echo-knight-echo.png`
- Create: `assets/templates-thumbs/summon-dragon.png`
- Modify: `assets/templates-thumbs/simulacrum.svg` → upgrade to PNG

- [ ] **Step 1: Dispatch asset-planner agent**

Use the Agent tool with subagent_type=`asset-planner`. Prompt:

> Generate 8 template thumbnails for Luxurious Summons Foundry module, 256×256 transparent PNG. Each: isolated subject, transparent background, no scenic / environmental elements. Aesthetic vocabulary per family:
>
> - Belle Époque (warm gold + wine oil-painting): find-familiar, pact-of-the-chain, animate-dead
> - Hextech (cool cyan crystalline ethereal): simulacrum, mage-hand, unseen-servant, echo-knight-echo, summon-dragon
>
> Per-template prompts (use exactly): [paste table from design doc §9.1]
>
> Save to `modules/luxurious-summons/assets/templates-thumbs/<template-id>.png`.

- [ ] **Step 2: Visually verify each thumbnail**

Open each PNG in an image viewer. Reject and re-generate any with: scenic background, unclear subject, wrong palette, transparent-background failure.

- [ ] **Step 3: Update template definitions to use the new PNG paths**

In `scripts/templates-builtin.js`, replace `.svg` with `.png` for Simulacrum's thumbnail.

- [ ] **Step 4: Commit**

```bash
git add assets/templates-thumbs/*.png scripts/templates-builtin.js
git commit -m "feat: 8 template thumbnails generated (Plan 3 task 32)"
```

---

### Task 33: Generate variant thumbnails (26 total)

**Files:**
- Create: 15 × `assets/variants/<familiar>.png`
- Create: 4 × `assets/variants/<pact>.png`
- Create: 2 × `assets/variants/<undead>.png`
- Create: 5 × `assets/variants/dragon-<element>.png`

- [ ] **Step 1: Dispatch asset-planner**

Agent prompt:

> Generate 26 variant thumbnails for Luxurious Summons, 96×96 transparent PNG. Isolated creature renders. Per-set vocabulary:
>
> - Find Familiar (15, Belle Époque warm gold): bat, cat, crab, frog, hawk, lizard, octopus, owl, snake, quipper, rat, raven, seahorse, spider, weasel — each in alert posture.
> - Pact of the Chain (4): imp (red-orange fiendish glow), pseudodragon (neutral gold), quasit (red-orange fiendish glow), sprite (gold-fey).
> - Animate Dead (2): skeleton (bone-white), zombie (decay-green).
> - Summon Dragon (5, Hextech cyan crystalline): same draconic-spirit base, color-shifted per element — acid (toxic green), cold (frost white), fire (orange), lightning (electric yellow), poison (sickly green).
>
> Save to `modules/luxurious-summons/assets/variants/<id>.png`.

- [ ] **Step 2: Verify each**

- [ ] **Step 3: Commit**

```bash
git add assets/variants/*.png
git commit -m "feat: 26 variant thumbnails generated (Plan 3 task 33)"
```

---

### Task 34: Generate token sprites (3 inline-synthesized templates)

**Files:**
- Create: `assets/tokens/mage-hand.png`
- Create: `assets/tokens/unseen-servant.png`
- Create: `assets/tokens/echo-knight-echo.png`

- [ ] **Step 1: Dispatch asset-planner**

Agent prompt:

> Generate 3 token sprites for Luxurious Summons inline-synthesized templates, 200×200 transparent PNG, isolated subject, no environment:
>
> - mage-hand: ethereal disembodied hand of pure arcane force, gold-cyan magical glow
> - unseen-servant: faint spectral wisp, translucent cyan
> - echo-knight-echo: translucent armored figure mirroring a generic caster pose, cool cyan-blue
>
> Save to `modules/luxurious-summons/assets/tokens/<id>.png`.

- [ ] **Step 2: Commit**

```bash
git add assets/tokens/*.png
git commit -m "feat: 3 token sprites for inline-synthesized templates (Plan 3 task 34)"
```

---

### Task 35: Verify generated assets against template definitions

- [ ] **Step 1: Cross-check paths**

For each `thumbnail:` / `img:` path in `templates-builtin.js`, run `ls <path>` to confirm the file exists. Fix any path mismatches in `templates-builtin.js`.

- [ ] **Step 2: Smoke-test ZIP build**

```powershell
$src = "C:\Users\Joakim\Documents\Codelabs\Laps\modules\luxurious-summons"
$staging = "$src\.staging\luxurious-summons"
Remove-Item -Recurse -Force "$src\.staging" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $staging | Out-Null
foreach ($item in @("module.json","scripts","styles","templates","lang","assets")) {
  if (Test-Path "$src\$item") { Copy-Item -Recurse "$src\$item" "$staging\" }
}
Compress-Archive -Path $staging -DestinationPath "$src\dist\luxurious-summons-0.4.0-rc.zip" -Force
Remove-Item -Recurse -Force "$src\.staging"
```

Verify the resulting ZIP contains every asset path.

- [ ] **Step 3: Commit any fixes**

```bash
git add scripts/templates-builtin.js
git commit -m "fix: align template thumbnail/img paths with generated assets (Plan 3 task 35)"
```

---

# Phase 7 — Localization + polish

---

### Task 36: Update `lang/en.json` with all new strings

**Files:**
- Modify: `lang/en.json`

- [ ] **Step 1: Add all new keys**

Read `lang/en.json`, then append (preserving existing keys):

```json
{
  "LUXSUM.SpawnGallery.Title": "Spawn New Companion",
  "LUXSUM.VariantPicker.Title": "Pick a Variant",
  "LUXSUM.VariantPicker.PickVariant": "Pick a variant",
  "LUXSUM.VariantPicker.CastLevel": "Cast level",
  "LUXSUM.VariantPicker.Place": "Place",
  "LUXSUM.VariantPicker.PlaceN": "Place {count} tokens",
  "LUXSUM.VariantPicker.MultispawnTotal": "Total",
  "LUXSUM.Common.Cancel": "Cancel"
}
```

(Merge into the existing JSON — don't replace the whole file.)

- [ ] **Step 2: Commit**

```bash
git add lang/en.json
git commit -m "feat: en.json strings for gallery + variant picker (Plan 3 task 36)"
```

---

### Task 37: Update ZIP build exclusions (no new exclusions needed)

**Files:**
- Verify: `previews/` and `docs/` are excluded from ZIP build

- [ ] **Step 1: Inspect the build command in CLAUDE.md / build script**

Verify the PowerShell `Copy-Item` loop in CLAUDE.md only copies: `module.json`, `scripts`, `styles`, `templates`, `lang`, `assets`. The `previews/`, `docs/`, `tests/`, `package.json` are implicitly excluded.

- [ ] **Step 2: No action if exclusions already correct**

(No commit needed for this task — pure verification.)

---

# Phase 8 — Ship

---

### Task 38: Bump version to 0.4.0

**Files:**
- Modify: `module.json`

- [ ] **Step 1: Bump**

In `module.json`, change `"version": "0.3.3"` → `"version": "0.4.0"`.

- [ ] **Step 2: Commit**

```bash
git add module.json
git commit -m "chore: bump version to 0.4.0 (Plan 3 task 38)"
```

---

### Task 39: Update CLAUDE.md status table + architecture quick-reference

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add v0.4.0 row to the status table**

Append after the v0.3.3 row:

```
| **0.4.0** | Plan 3 roster expansion (Simulacrum + 7 new templates), spawn-effect audiovisual layer, flat-gallery + variant-picker UX. New source modes: `compendium` (Find Familiar, Pact of the Chain, Animate Dead), `inline-synthesized` (Mage Hand, Unseen Servant, Echo Knight Echo), `compendium-scaled` (Summon Dragon — 5 damage variants × 4 spell-slot tiers). Unified `effects: { motion, spawn, death }` template descriptor (legacy fields stay readable as fallback). 6 new death animations + 6 new spawn animations sharing 2 core implementations via parameter-driven variants. Variant eligibility gating (warlock-only Pact options) + multi-spawn UX (Animate Dead's up to 4 corpses per cast). Tests: 70 → 70+ (new pure-logic suites for source modes, variant eligibility, effects-fallback, multi-spawn counter). |
```

- [ ] **Step 2: Update architecture quick-reference**

Find the architecture quick-reference (`Architecture quick-reference`) section. Update the `scripts/` tree to add the new files:

```
scripts/
├── ...existing files...
├── tween.js               ← Plan 3: shared PIXI ticker tween helper
├── spawn-animations.js    ← Plan 3: spawn-effect registry
├── effect-textures.js     ← Plan 3: PIXI texture cache for SVG effect assets
├── source-modes.js        ← Plan 3: actor-data resolution per source mode
├── variant-eligibility.js ← Plan 3: pure-logic variant filtering
├── spawn-trigger-anim.js  ← Plan 3: drawToken hook handler for spawn-effect playback
├── spawn-gallery-app.js   ← Plan 3: Spawn-dialog gallery (ApplicationV2)
├── variant-picker-app.js  ← Plan 3: Variant picker modal (ApplicationV2)
├── multi-spawn-counter.js ← Plan 3: pure-logic per-variant counter for Animate Dead
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md status row + architecture for v0.4.0 (Plan 3 task 39)"
```

---

### Task 40: Build + ship ZIP, tag release

**Files:**
- Create: `dist/luxurious-summons-0.4.0.zip`

- [ ] **Step 1: Build the ZIP**

```powershell
$src = "C:\Users\Joakim\Documents\Codelabs\Laps\modules\luxurious-summons"
$staging = "$src\.staging\luxurious-summons"
$out = "$src\dist\luxurious-summons-0.4.0.zip"
Remove-Item -Recurse -Force "$src\.staging" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $staging | Out-Null
foreach ($item in @("module.json","scripts","styles","templates","lang","assets")) {
  if (Test-Path "$src\$item") { Copy-Item -Recurse "$src\$item" "$staging\" }
}
Compress-Archive -Path $staging -DestinationPath $out -Force
Remove-Item -Recurse -Force "$src\.staging"
```

- [ ] **Step 2: Verify the ZIP is clean**

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($out)
$entries = $archive.Entries | Select-Object -ExpandProperty FullName
$archive.Dispose()
$entries | Where-Object { $_ -match "\.git|tests/|docs/|previews/|CLAUDE\.md|package\.json" } | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0
$entries.Count
# Expected: ~80 (37 generated + 4 effects + ~20 scripts + templates + styles + lang + module.json)
```

- [ ] **Step 3: Tag the release**

```bash
git tag luxurious-summons-v0.4.0
git log --oneline -5
```

- [ ] **Step 4: Run final tests**

Run: `npm test`
Expected: `# pass 70+ # fail 0`.

- [ ] **Step 5: Final user-facing summary**

Post the v0.4.0 release notes summary to the user. Include: version, ZIP path, what changed at a glance (8 templates total, new source modes, spawn-effect layer, gallery + picker UI), what the user should test first (each new template's spell-cast trigger flow, the variant picker, Animate Dead's multi-spawn, Summon Dragon's cast-level selector).

---

# Self-Review

**Spec coverage:**
- §3 (Roster catalog) → tasks 15-22 cover all 8 templates. ✓
- §4 (Family audiovisual vocabularies) → tasks 1-4 (SVG assets), 7-8 (animation code), 31 (texture preload). ✓
- §5 (Per-template overrides) → baked into each template definition (tasks 15-22) + spawn-trigger-anim.js (task 30). ✓
- §6 (Spawn-dialog UX) → tasks 23 (gallery), 24-27 (variant picker + cast-level + multi-spawn), 28-29 (spawn-flow refactor + manager wiring). ✓
- §7 (Data model) → tasks 10 (readEffects), 11 (eligibility), 12-13 (source modes), 14 (multi-spawn counter), 15-22 (templates use new shape). ✓
- §8 (Animation registries) → tasks 5 (tween extract), 6 (texture registry), 7 (spawn-animations), 8 (extended death-animations), 31 (preload). ✓
- §9 (Asset inventory) → tasks 1-4 (SVGs), 32-34 (generated assets). ✓
- §10 (Performance) → no specific task; respected throughout (ParticleContainer in task 7, escape hatch via `enableDeathAnimations` in task 30). ✓
- §11 (Testing strategy) → tasks 10, 11, 12, 13, 14 ship the 4 promised pure-logic test files plus extras. ✓
- §12 (Task ordering) → this plan IS §12 expanded. ✓

**Placeholder scan:**
- `*-uuid-tbd` strings in tasks 16, 17, 18, 22 — these are intentional, called out as **Pre-task verification** items requiring live-Foundry compendium lookups. The plan flags them; the engineer fills them in before task completion. Not plan failures.
- "Plan 4" references in tasks 18 (no mods for Animate Dead) and 21 (no extraActions for Echo) — these are intentional deferrals to a future plan; the templates compile and spawn without those features.
- No "TBD" / "TODO" / "implement later" / "appropriate error handling" / "similar to Task N" present. ✓

**Type consistency check:**
- `spawn-animations.js` exports `spawnAnimations` (object); `spawn-trigger-anim.js` imports `spawnAnimations` (matches). ✓
- `source-modes.js` exports `resolveCloneData`, `resolveCompendiumData`, `resolveCompendiumScaledData`, `resolveInlineData`, `pickScalingTier`, `applyScalingTier`. `spawn-engine.js` task 28 dynamically imports the first four. ✓
- `multi-spawn-counter.js` exports `createCounter`, `increment`, `decrement`, `totalCount`, `canIncrement`. `variant-picker-app.js` task 27 imports the same names. ✓
- `variant-eligibility.js` exports `filterVariants` + `isVariantEligible`. `variant-picker-app.js` task 24 imports both. ✓
- `data-model.js` adds `readEffects(template)` export in task 10. `spawn-trigger-anim.js` task 30 imports it. ✓
- `effect-textures.js` exports `setEffectTextures`, `getEffectTexture`, `hasEffectTextures`. `main.js` task 31 imports `setEffectTextures`. `spawn-animations.js` task 7 + `death-animations.js` task 8 import `getEffectTexture`. ✓

**Type names consistent across tasks:**
- Effect IDs: `belleBloom`, `hexCrystalForm`, `mageHandSparks`, `infernalBloom`, `boneRise`, `echoStep`, `belleFade`, `hexShatter`, `mageHandDissolve`, `echoCollapse`, `infernalFade`, `boneCollapse`. Same names used in tasks 7, 8, 15-22 (templates reference them), 30 (registry lookup). ✓
- Camel-case effect IDs vs. kebab-case template/variant IDs — the convention is enforced: effects use camelCase (matches export names), templates/variants use kebab-case (matches CSS/data conventions). Verify: `templates-builtin.js` uses `"hexCrystalForm"` etc. as values, never `"hex-crystal-form"`. ✓

**Plan-feasibility self-check:**
- ZIP build (task 40) excludes `tests/`, `docs/`, `previews/`, `package.json`, `.git/`, `.claude/`, `CLAUDE.md` — confirmed by manual `Copy-Item` allowlist (only the 6 listed runtime dirs). ✓
- All new files have a clear owner task — no files referenced but not created. ✓
- Compendium UUIDs and the Draconic Spirit UUID are TBD (intentional — verified at task time, not at plan-write time). Engineer follows the explicit pre-task verification steps. ✓

**Issue found and fixed inline:**
- Task 25's cast-level selector originally said `<select>` without specifying that re-render is needed for the info card to refresh. Task 26 adds the re-render. Fixed inline by moving the cast-level-select handler into task 26's "Step 2" rather than leaving an inconsistency between 25 and 26.

---

# Execution Handoff

**Plan complete and saved to `docs/2026-05-14-plan-3-summon-effects-implementation.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
