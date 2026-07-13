// scripts/heal-sweep.js — v0.4.7 FIX 1: ready-hook sweep for two classes of
// stale companion state left behind by ≤0.4.5 builds.
//
// Runs ONLY on the primary-GM client (electPrimaryGM — same election
// chat-broker.js / spawn-trigger-anim.js already use for one-shot writes to
// world documents). Per [[chat-broker-primary-gm-gates-flag-clears]] in this
// module's agent memory: any one-shot flag clear or document write driven
// from a hook that fires on every connected client needs primary-GM gating,
// not a bare game.user.isGM check (a lone player session with no GM browser
// connected would otherwise skip the sweep forever). Also per
// [[own-animation-vs-motion-ticker-coordination]]: this sweep touches
// spawnState, which the motion ticker's isAnimating() coordination cares
// about — Sweep B intentionally clears WITHOUT replaying the animation
// (skipAnimation-equivalent), so it must not call into spawn-trigger-anim's
// playback path.
//
// Sweep A (broken art): pre-0.4.6 builds baked
// "modules/luxurious-summons/assets/tokens/<name>.png" into spawned actor +
// token documents for inline-synthesized templates (Mage Hand, Unseen
// Servant, Echo Knight Echo). Those files were never shipped. The failed
// texture load aborts Token5e._draw partway through on V13 build 351 —
// symptom: 404 in console AND the token becomes unselectable (draw aborted
// before pointer-interaction setup completed). Heals by rewriting to the
// owning template's current source.inline.img (fallback: template.thumbnail).
//
// Sweep B (stale pending-spawn): a companion actor whose spawnState flag got
// stuck at "pending-spawn" (e.g. the primary-GM clear failed on a 0.4.5
// build, before v0.4.6's permission-safe clearSpawnStateFlag existed) replays
// its spawn animation on every future boot, including during the INITIAL
// canvas draw inside Game.setupGame — before textures are preloaded (FIX 2)
// and before the module's own animation coordination is fully wired up.
// Cleared without playing the animation once the flag is older than 5 min
// (a genuinely in-flight spawn is always sub-second; 5 min is a generous
// margin against clock skew / slow clients, never a false positive on a live
// spawn).

import { isCompanion } from "./data-model.js";
import { electPrimaryGM } from "./chat-broker.js";

const MODULE_ID = "luxurious-summons";
const BROKEN_ART_PREFIX = "modules/luxurious-summons/assets/tokens/";
const STALE_PENDING_SPAWN_MS = 5 * 60 * 1000;   // 5 minutes

/**
 * Pure-logic. True if `src` looks like one of the broken pre-0.4.6 baked
 * token-art paths that were never shipped as real files.
 */
export function isBrokenArtPath(src) {
  return typeof src === "string" && src.startsWith(BROKEN_ART_PREFIX);
}

/**
 * Pure-logic. Given a companion flag's spawnState + spawnedAt and the
 * current time, decide whether Sweep B should clear it.
 */
export function isStalePendingSpawn(flag, now) {
  if (!flag || flag.spawnState !== "pending-spawn") return false;
  if (typeof flag.spawnedAt !== "number") return false;
  return (now - flag.spawnedAt) > STALE_PENDING_SPAWN_MS;
}

/**
 * Pure-logic. Resolves the healed art path for a companion actor given its
 * owning template — source.inline.img first (inline-synthesized templates:
 * Mage Hand, Unseen Servant, Echo Knight Echo), falling back to
 * template.thumbnail for compendium-sourced templates that somehow ended up
 * with a broken baked path too.
 */
export function resolveHealedArtPath(template) {
  return template?.source?.inline?.img ?? template?.thumbnail ?? null;
}

function isPrimaryGmClient() {
  if (!game.user.isGM) return false;
  return electPrimaryGM(game.users.contents) === game.user.id;
}

/**
 * Sweep A — rewrite broken pre-0.4.6 baked token-art paths on both the actor
 * (img / prototypeToken.texture.src) and every placed token document
 * (texture.src) tagged as a companion token. Per-document try/catch so one
 * bad document never aborts the rest of the sweep.
 */
async function sweepBrokenArt(templates) {
  let healedActors = 0;
  let healedTokens = 0;

  for (const actor of game.actors.contents) {
    if (!isCompanion(actor)) continue;
    const flag = actor.flags?.[MODULE_ID];
    const template = templates.find(t => t.id === flag?.templateId);
    const healedPath = resolveHealedArtPath(template);
    if (!healedPath) continue;

    try {
      const actorUpdates = {};
      if (isBrokenArtPath(actor.img)) actorUpdates.img = healedPath;
      if (isBrokenArtPath(actor.prototypeToken?.texture?.src)) {
        actorUpdates["prototypeToken.texture.src"] = healedPath;
      }
      if (Object.keys(actorUpdates).length > 0) {
        const before = { img: actor.img, tokenSrc: actor.prototypeToken?.texture?.src };
        await actor.update(actorUpdates);
        healedActors++;
        console.log(`[${MODULE_ID}] heal-sweep A: actor "${actor.name}" (${actor.id}) img/token art ${JSON.stringify(before)} -> ${healedPath}`);
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] heal-sweep A: actor "${actor.name}" (${actor.id}) update failed, skipping:`, e);
    }

    // Placed token documents across every scene, tagged as this actor's companion tokens.
    for (const scene of game.scenes) {
      const brokenTokens = scene.tokens.filter(t =>
        t.actorId === actor.id &&
        t.flags?.[MODULE_ID]?.isCompanionToken === true &&
        isBrokenArtPath(t.texture?.src)
      );
      if (brokenTokens.length === 0) continue;
      try {
        const updates = brokenTokens.map(t => ({ _id: t.id, "texture.src": healedPath }));
        await scene.updateEmbeddedDocuments("Token", updates);
        healedTokens += brokenTokens.length;
        console.log(`[${MODULE_ID}] heal-sweep A: healed ${brokenTokens.length} token(s) in scene "${scene.name}" for actor "${actor.name}" -> ${healedPath}`);
      } catch (e) {
        console.warn(`[${MODULE_ID}] heal-sweep A: scene "${scene.name}" token update failed for actor "${actor.name}", skipping:`, e);
      }
    }
  }

  console.log(`[${MODULE_ID}] heal-sweep A complete: ${healedActors} actor(s), ${healedTokens} token(s) healed`);
  return { healedActors, healedTokens };
}

/**
 * Sweep B — clear stale pending-spawn flags (no animation replay) so they
 * stop firing on every future boot-time canvas draw.
 */
async function sweepStalePendingSpawn() {
  const now = Date.now();
  let cleared = 0;

  for (const actor of game.actors.contents) {
    if (!isCompanion(actor)) continue;
    const flag = actor.flags?.[MODULE_ID];
    if (!isStalePendingSpawn(flag, now)) continue;
    try {
      await actor.unsetFlag(MODULE_ID, "spawnState");
      cleared++;
      console.log(`[${MODULE_ID}] heal-sweep B: cleared stale pending-spawn flag on "${actor.name}" (${actor.id}), age=${Math.round((now - flag.spawnedAt) / 1000)}s`);
    } catch (e) {
      console.warn(`[${MODULE_ID}] heal-sweep B: unsetFlag failed for "${actor.name}" (${actor.id}), skipping:`, e);
    }
  }

  console.log(`[${MODULE_ID}] heal-sweep B complete: ${cleared} stale pending-spawn flag(s) cleared`);
  return cleared;
}

/**
 * Entry point — wired from main.js's ready hook, after settings are
 * available. Primary-GM-gated; no-op on every other client.
 */
export async function runHealSweep() {
  if (!isPrimaryGmClient()) {
    console.log(`[${MODULE_ID}] heal-sweep: skipped — this client is not the primary GM`);
    return { skipped: true };
  }
  console.log(`[${MODULE_ID}] heal-sweep: starting (primary GM client)`);
  try {
    const { templates } = await import("./templates-builtin.js");
    const artResult = await sweepBrokenArt(templates);
    const clearedCount = await sweepStalePendingSpawn();
    console.log(`[${MODULE_ID}] heal-sweep: done — ${artResult.healedActors} actor(s) + ${artResult.healedTokens} token(s) art-healed, ${clearedCount} stale spawn flag(s) cleared`);
    return { skipped: false, ...artResult, clearedPendingSpawn: clearedCount };
  } catch (e) {
    console.error(`[${MODULE_ID}] heal-sweep: unexpected top-level failure (sweep aborted, will retry next boot):`, e);
    return { skipped: false, error: e.message };
  }
}
