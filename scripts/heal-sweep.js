// scripts/heal-sweep.js — v0.4.7 FIX 1: ready-hook sweep for two classes of
// stale companion state left behind by ≤0.4.5 builds. Reworked in v0.4.8 to
// stay correct now that modules/luxurious-summons/assets/tokens/ and
// assets/variants/ ship REAL art (see templates-builtin.js).
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
// Sweep A (broken art) — v0.4.8 REWORK. Pre-0.4.6 builds baked
// "modules/luxurious-summons/assets/tokens/<name>.png" into spawned actor +
// token documents for inline-synthesized templates (Mage Hand, Unseen
// Servant, Echo Knight Echo). As of v0.4.8 that directory (and
// assets/variants/) ships REAL shipped .webp files — a bare prefix match
// against "modules/luxurious-summons/assets/tokens/" would now flag CURRENT,
// perfectly valid art as broken and "heal" it away. A path is a heal
// candidate if it is:
//   (a) empty/falsy,
//   (b) exactly "icons/svg/mystery-man.svg" (Foundry's default no-art
//       silhouette — retro-fixes a stale mystery-man Draconic Spirit left
//       over from the 0.4.6 session; the 0.4.7 sweep missed this case
//       entirely because it only matched the tokens/ prefix), or
//   (c) under "modules/luxurious-summons/" AND a HEAD probe of that URL
//       returns not-ok. This is the general case that actually replaces the
//       old prefix-match: it catches stale pre-0.4.6 paths like
//       "assets/tokens/unseen-servant.png" (note the extension — old baked
//       paths still 404 because we now ship .webp), while leaving today's
//       real "assets/tokens/unseen-servant.webp" alone because it resolves.
// Classification itself (isHealCandidateArtPath) stays pure — probe results
// are gathered Foundry-side via fetch(HEAD) (same pattern as
// placement-overlay.js's thumbnail-existence probe) and passed in as a
// Map<path, boolean> so the pure function never touches fetch/game globals.
// Replacement art is variant-aware: resolveHealedArtPath(template, variant)
// shares the same priority resolution TASK 3 introduced on the spawn path
// (resolveArtFallback in source-modes.js), read off the companion flag's
// variantId.
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
// spawn). UNCHANGED in v0.4.8.

import { isCompanion } from "./data-model.js";
import { electPrimaryGM } from "./chat-broker.js";

const MODULE_ID = "luxurious-summons";
const MODULE_PREFIX = "modules/luxurious-summons/";
const FOUNDRY_DEFAULT_ACTOR_IMG = "icons/svg/mystery-man.svg";
const STALE_PENDING_SPAWN_MS = 5 * 60 * 1000;   // 5 minutes

/**
 * Pure-logic. True if `src` is empty/falsy, Foundry's default mystery-man
 * silhouette, or a module-local path whose probe result (already gathered
 * Foundry-side and passed in) came back not-ok.
 *
 * @param src           the art path under test (actor.img / token.texture.src / etc.)
 * @param probeResults  Map<string, boolean> — path -> HEAD-probe-ok, for every
 *                      module-local path already probed this sweep run. A
 *                      module-local path with NO entry in the map is treated
 *                      as not-yet-probed and is NOT flagged (conservative:
 *                      never heal on missing information) — callers are
 *                      expected to probe every module-local candidate before
 *                      calling this.
 */
export function isHealCandidateArtPath(src, probeResults) {
  if (!src) return true;
  if (src === FOUNDRY_DEFAULT_ACTOR_IMG) return true;
  if (typeof src === "string" && src.startsWith(MODULE_PREFIX)) {
    if (!(probeResults instanceof Map)) return false;
    if (!probeResults.has(src)) return false;
    return probeResults.get(src) !== true;
  }
  return false;
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
 * Pure-logic (v0.4.8). Resolves the healed art path for a companion actor
 * given its owning template and (if any) the selected variant. Priority:
 *   1. variant.thumbnail       — real per-variant art (e.g. dragon-cold.webp)
 *      always wins when a variant is selected and has its own art.
 *   2. template.source.inline.img — inline-synthesized templates (Mage Hand,
 *      Unseen Servant, Echo Knight Echo) carry their canonical art here.
 *   3. template.thumbnail      — final fallback for compendium-sourced
 *      templates/variants with neither of the above.
 * Shares this priority order with resolveArtFallback in source-modes.js
 * (the spawn-time art-fallback path from TASK 3) rather than duplicating the
 * resolution logic — kept as a small local function here (not re-exported
 * from source-modes.js) because the two call sites want slightly different
 * signatures (resolveArtFallback takes already-cloned actor data; the sweep
 * only needs the resolved path) and the priority chain is one line either way.
 */
export function resolveHealedArtPath(template, variant) {
  return variant?.thumbnail ?? template?.source?.inline?.img ?? template?.thumbnail ?? null;
}

function isPrimaryGmClient() {
  if (!game.user.isGM) return false;
  return electPrimaryGM(game.users.contents) === game.user.id;
}

/**
 * Foundry-side. HEAD-probes a module-local art path, same pattern as
 * placement-overlay.js's thumbnail-existence check. Cached per sweep run via
 * the `cache` Map so the same path (e.g. a template's shared thumbnail
 * referenced by many actors) is only fetched once.
 */
async function probeArtPath(src, cache) {
  if (cache.has(src)) return cache.get(src);
  let ok = false;
  try {
    const resp = await fetch(src, { method: "HEAD" });
    ok = resp.ok;
  } catch {
    ok = false;
  }
  cache.set(src, ok);
  return ok;
}

/**
 * Sweep A (v0.4.8 rework) — rewrite genuinely-broken art paths on both the
 * actor (img / prototypeToken.texture.src) and every placed token document
 * (texture.src) tagged as a companion token. "Genuinely broken" per
 * isHealCandidateArtPath: empty, the Foundry mystery-man default, or a
 * module-local path that HEAD-probes as not-ok — NOT a bare prefix match,
 * since modules/luxurious-summons/assets/{tokens,variants}/ now ships real
 * art. Replacement is variant-aware (resolveHealedArtPath(template, variant),
 * variantId read off the companion flag). Per-document try/catch so one bad
 * document never aborts the rest of the sweep.
 */
async function sweepBrokenArt(templates) {
  let healedActors = 0;
  let healedTokens = 0;
  const probeCache = new Map();

  async function probeAllModuleLocal(paths) {
    const probeResults = new Map();
    for (const p of paths) {
      if (typeof p !== "string" || !p.startsWith(MODULE_PREFIX)) continue;
      probeResults.set(p, await probeArtPath(p, probeCache));
    }
    return probeResults;
  }

  for (const actor of game.actors.contents) {
    if (!isCompanion(actor)) continue;
    const flag = actor.flags?.[MODULE_ID];
    const template = templates.find(t => t.id === flag?.templateId);
    const variant = flag?.variantId ? (template?.variants ?? []).find(v => v.id === flag.variantId) : null;
    const healedPath = resolveHealedArtPath(template, variant);
    if (!healedPath) continue;

    try {
      const actorImg = actor.img;
      const actorTokenSrc = actor.prototypeToken?.texture?.src;
      const actorProbes = await probeAllModuleLocal([actorImg, actorTokenSrc]);

      const actorUpdates = {};
      if (isHealCandidateArtPath(actorImg, actorProbes)) actorUpdates.img = healedPath;
      if (isHealCandidateArtPath(actorTokenSrc, actorProbes)) {
        actorUpdates["prototypeToken.texture.src"] = healedPath;
      }
      if (Object.keys(actorUpdates).length > 0) {
        const before = { img: actorImg, tokenSrc: actorTokenSrc };
        await actor.update(actorUpdates);
        healedActors++;
        console.log(`[${MODULE_ID}] heal-sweep A: actor "${actor.name}" (${actor.id})${flag?.variantId ? ` variant "${flag.variantId}"` : ""} img/token art ${JSON.stringify(before)} -> ${healedPath}`);
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] heal-sweep A: actor "${actor.name}" (${actor.id}) update failed, skipping:`, e);
    }

    // Placed token documents across every scene, tagged as this actor's companion tokens.
    for (const scene of game.scenes) {
      const candidateTokens = scene.tokens.filter(t =>
        t.actorId === actor.id && t.flags?.[MODULE_ID]?.isCompanionToken === true
      );
      if (candidateTokens.length === 0) continue;
      const tokenProbes = await probeAllModuleLocal(candidateTokens.map(t => t.texture?.src));
      const brokenTokens = candidateTokens.filter(t => isHealCandidateArtPath(t.texture?.src, tokenProbes));
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
