// scripts/lifecycle.js — HP=0 detection, manual dismiss, master-link, master deletion
//
// detectHpDeath is pure-logic (Task 15, unit-tested).
// installLifecycleHooks wires the Foundry-side detection (Task 15).
// installDeleteHandling wires deleteActor cleanup + master-deletion prompt (Task 16).

import { isCompanion, refreshUserIndexes } from "./data-model.js";
import { registerBrokerHandler } from "./chat-broker.js";

const MODULE_ID = "luxurious-summons";

/**
 * Pure-logic. True iff HP transitioned from a positive number to 0 or below.
 */
export function detectHpDeath({ before, after }) {
  if (typeof before !== "number") return false;
  return before > 0 && after <= 0;
}

/**
 * Delete every token document across every scene whose actorId points at this actor.
 *
 * Foundry does NOT cascade-delete tokens when the world actor is removed: the token
 * documents persist as "ghosts" whose `.actor` getter returns null. Image renders
 * because `token.texture.src` is on the document itself; selection breaks because
 * ownership is gated through the missing actor. v0.3.2 and earlier left these ghosts
 * behind on every dismiss — paid for in v0.3.3.
 *
 * Permission errors are swallowed: on a non-GM client during HP=0 cleanup, this
 * call will fail (scene write needs GM), but the GM client running the same hook
 * will succeed. Foundry's deleteToken sync then propagates the removal to every
 * other client, so the player sees the token vanish either way.
 */
async function deleteAllTokensFor(actor) {
  let total = 0;
  for (const scene of game.scenes) {
    const ids = scene.tokens.filter(t => t.actorId === actor.id).map(t => t.id);
    if (ids.length === 0) continue;
    try {
      await scene.deleteEmbeddedDocuments("Token", ids);
      total += ids.length;
      console.log(`[${MODULE_ID}] deleteAllTokensFor: removed ${ids.length} token(s) from scene "${scene.name}" for "${actor.name}"`);
    } catch (err) {
      console.log(`[${MODULE_ID}] deleteAllTokensFor: scene "${scene.name}" deleteEmbeddedDocuments failed (${err.message}). Likely a permission issue on a non-GM client; another client will handle.`);
    }
  }
  return total;
}

/**
 * Run the death animation, delete the tokens, then delete the actor.
 * Called on HP=0 detection AND from the manual Dismiss button.
 *
 * Order matters: animation runs first (otherwise the token is gone before the
 * fade plays), tokens are deleted next (so Foundry's mesh is destroyed cleanly),
 * actor last (so any deleteActor downstream listeners see the tokens already gone).
 */
export async function runDeathAndCleanup(actor, { skipAnimation = false } = {}) {
  if (!skipAnimation && game.settings.get(MODULE_ID, "enableDeathAnimations")) {
    const { templates } = await import("./templates-builtin.js");
    const flag = actor.flags?.[MODULE_ID];
    const template = templates.find(t => t.id === flag?.templateId);
    const animationId = template?.deathAnimation ?? "softFade";
    const { deathAnimations } = await import("./death-animations.js");
    const tokens = actor.getActiveTokens();
    await Promise.all(tokens.map(t => deathAnimations[animationId]?.(t) ?? Promise.resolve()));
  }
  await deleteAllTokensFor(actor);
  await actor.delete();
  console.log(`[${MODULE_ID}] companion ${actor.id} deleted via runDeathAndCleanup`);
}

/**
 * Init-time sweep for tagged orphan tokens — tokens we flagged as companion
 * tokens at spawn time whose actor has since been deleted without the token
 * deletion. Catches ghosts that slipped through any failure path. GM-only.
 *
 * Untagged ghosts from v0.3.2 and earlier (before we tagged tokens on spawn)
 * are not auto-cleaned by this sweep — the GM has to right-click and delete
 * them manually one time. From v0.3.3 onward, every spawned token is tagged.
 */
export async function cleanupOrphanedCompanionTokens() {
  if (!game.user.isGM) return 0;
  let total = 0;
  for (const scene of game.scenes) {
    const orphans = scene.tokens.filter(t =>
      t.flags?.[MODULE_ID]?.isCompanionToken === true &&
      (!t.actorId || !game.actors.get(t.actorId))
    );
    if (orphans.length === 0) continue;
    const ids = orphans.map(t => t.id);
    try {
      await scene.deleteEmbeddedDocuments("Token", ids);
      total += ids.length;
      console.log(`[${MODULE_ID}] cleanupOrphanedCompanionTokens: removed ${ids.length} ghost token(s) from scene "${scene.name}"`);
    } catch (err) {
      console.warn(`[${MODULE_ID}] cleanupOrphanedCompanionTokens: scene "${scene.name}" delete failed: ${err.message}`);
    }
  }
  if (total > 0) {
    ui.notifications?.info(`Luxurious Summons: cleaned up ${total} orphan companion token(s) from prior sessions.`);
  }
  return total;
}

/**
 * Wire the HP-transition detection. We use preUpdateActor to capture the
 * before-value (the most reliable cross-V14-minor-version approach), stash
 * it on the change-options object, and read it in updateActor.
 */
export function installLifecycleHooks() {
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (!isCompanion(actor)) return;
    if (changes?.system?.attributes?.hp?.value !== undefined) {
      options[`${MODULE_ID}.hpBefore`] = actor.system.attributes.hp.value;
    }
  });
  Hooks.on("updateActor", async (actor, changes, options) => {
    if (!isCompanion(actor)) return;
    const before = options?.[`${MODULE_ID}.hpBefore`];
    const after = changes?.system?.attributes?.hp?.value;
    if (after === undefined) return;
    if (detectHpDeath({ before, after })) {
      console.log(`[${MODULE_ID}] HP=0 detected on companion ${actor.name} — triggering death pipeline`);
      await runDeathAndCleanup(actor);
    }
  });
}

/**
 * Broker handler for player-initiated dismiss. Players can't `actor.delete()` world
 * actors even with OWNER permission — that's GM-gated in Foundry. So the player posts
 * a "dismiss" broker request and the primary GM client performs the delete.
 *
 * The death animation runs on the requester's client BEFORE the broker post (in
 * manager-app.js #onDismiss) so the requester sees the fade locally; other clients
 * see the token vanish via Foundry's delete sync.
 */
export function installDismissBrokerHandler() {
  registerBrokerHandler("dismiss", async ({ actorId }) => {
    const actor = game.actors.get(actorId);
    if (!actor) {
      console.warn(`[${MODULE_ID}] dismiss broker: actor ${actorId} not found`);
      return { error: "actor-not-found" };
    }
    if (!isCompanion(actor)) {
      console.warn(`[${MODULE_ID}] dismiss broker: actor ${actorId} (${actor.name}) is not a companion — refusing`);
      return { error: "not-companion" };
    }
    // Animation already ran on requester's client (in manager-app.js #onDismiss);
    // we only need the token + actor cleanup here.
    await runDeathAndCleanup(actor, { skipAnimation: true });
    console.log(`[${MODULE_ID}] dismiss broker: cleanup completed for ${actor.name} (${actorId})`);
    return { ok: true };
  });
}

/**
 * On any actor delete:
 *   - If it was a companion, refresh the user-flag indexes.
 *   - If it was a master with linked companions, prompt the GM to dismiss them.
 */
export function installDeleteHandling() {
  Hooks.on("deleteActor", async (actor) => {
    console.log(`[${MODULE_ID}] deleteActor hook fired for "${actor.name}" (${actor.id}), isCompanion=${isCompanion(actor)}, currentUser.isGM=${game.user.isGM}`);
    if (isCompanion(actor)) {
      await refreshUserIndexes();
      console.log(`[${MODULE_ID}] companion ${actor.id} deleted — user indexes refresh attempted`);
      return;
    }
    const linkedCompanions = game.actors.filter(a =>
      a.flags?.[MODULE_ID]?.isCompanion && a.flags?.[MODULE_ID]?.sourceActorId === actor.id
    );
    if (linkedCompanions.length === 0) return;
    if (!game.user.isGM) return;       // only GM clients prompt
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Luxurious Summons" },
      content: `<p>${actor.name}'s character is being deleted. Dismiss the ${linkedCompanions.length} active companion(s) too?</p>`,
      yes: { label: "Dismiss companions", callback: () => true },
      no:  { label: "Keep them",          callback: () => false },
      defaultYes: true,
      rejectClose: false
    });
    if (proceed) {
      for (const comp of linkedCompanions) {
        await runDeathAndCleanup(comp, { skipAnimation: true });
      }
    }
    await refreshUserIndexes();
  });
}
