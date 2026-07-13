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
    moteSpread = 80
  } = opts;

  if (!token?.mesh) return;
  const mesh = token.mesh;

  const textureName = palette === "ember" ? "ember"
                    : palette === "bone"  ? "boneMote"
                    : "goldMote";
  const texture = getEffectTexture(textureName);
  if (!texture) {
    console.warn(`[${MODULE_ID}] particleBloom: texture "${textureName}" not loaded`);
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

  // Lazy snapshot: startAlpha/startScale are captured on the FIRST ticker frame,
  // not at attach time. drawToken fires partway through Foundry's draw chain on
  // V13 build 351, so mesh.alpha/scale can be pre-init here. Snapshotting early
  // and immediately zeroing alpha (the old behavior) also handed the motion
  // ticker's own lazy-base-snapshot a poisoned mesh state to capture — v0.4.6 FIX 1.
  let startAlpha = null;
  let startScale = null;

  await tweenWithTicker(durationMs, (t) => {
    if (startAlpha === null) {
      startAlpha = mesh.alpha;
      startScale = mesh.scale.x;
    }
    const eased = easeOutCubic(t);
    mesh.alpha = startAlpha * eased;
    mesh.scale.set(startScale * (scaleFrom + (1 - scaleFrom) * eased));
    for (const sprite of motes) {
      sprite.x = sprite._initX + sprite._vx * eased;
      sprite.y = sprite._initY + sprite._vy * eased;
      sprite.alpha = direction === "convergent" ? eased : (1 - eased);
    }
  });

  mesh.alpha = startAlpha ?? mesh.alpha;
  mesh.scale.set(startScale ?? mesh.scale.x);
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

  const texture = getEffectTexture("hexShard");
  if (!texture) {
    console.warn(`[${MODULE_ID}] crystalForm: hexShard texture not loaded`);
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

  // Lazy snapshot on first ticker frame — see particleBloom for rationale
  // (v0.4.6 FIX 1: attach-time snapshot races Foundry's draw chain on V13).
  let startAlpha = null;
  let startScale = null;

  await tweenWithTicker(durationMs, (t) => {
    if (startAlpha === null) {
      startAlpha = mesh.alpha;
      startScale = mesh.scale.x;
    }
    const eased = easeOutCubic(t);
    mesh.alpha = startAlpha * eased;
    // Snap-bounce: 1.0 at t<0.85, peak 1.08 at t=0.92, back to 1.0 at t=1.0
    let scaleFactor = 1;
    if (t < 0.85) scaleFactor = 1;
    else if (t < 0.92) scaleFactor = 1 + 0.08 * ((t - 0.85) / 0.07);
    else scaleFactor = 1.08 - 0.08 * ((t - 0.92) / 0.08);
    mesh.scale.set(startScale * scaleFactor);
    for (const sprite of shards) {
      sprite.x = sprite._startX + (sprite._endX - sprite._startX) * eased;
      sprite.y = sprite._startY + (sprite._endY - sprite._startY) * eased;
      sprite.alpha = 1 - eased;
      sprite.scale.set(0.6 + 0.6 * eased);
    }
  });

  mesh.scale.set(startScale ?? mesh.scale.x);
  mesh.alpha = startAlpha ?? mesh.alpha;
  for (const sprite of shards) {
    layer.removeChild(sprite);
    sprite.destroy();
  }
}

/**
 * Echo step — translucent fade-in for the Echo Knight Echo. Quick 500 ms.
 * Unique implementation; doesn't reuse a core.
 */
async function echoStep(token) {
  if (!token?.mesh) return;
  const mesh = token.mesh;
  // Lazy snapshot on first ticker frame — see particleBloom for rationale.
  let startAlpha = null;
  await tweenWithTicker(500, (t) => {
    if (startAlpha === null) startAlpha = mesh.alpha;
    const eased = easeOutCubic(t);
    mesh.alpha = startAlpha * eased;
  });
  mesh.alpha = startAlpha ?? mesh.alpha;
}

export const spawnAnimations = {
  belleBloom:     particleBloom,
  hexCrystalForm: crystalForm,
  mageHandSparks: (token) => particleBloom(token, { palette: "gold", direction: "convergent" }),
  infernalBloom:  (token) => particleBloom(token, { palette: "ember" }),
  boneRise:       (token) => particleBloom(token, { palette: "bone", direction: "bottom-up", scaleFrom: 0.7, durationMs: 1500 }),
  echoStep
};
