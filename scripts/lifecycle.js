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
 * Run the death animation, then delete the actor.
 * Called on HP=0 detection AND from the manual Dismiss button (which skips animation).
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
  await actor.delete();
  console.log(`[${MODULE_ID}] companion ${actor.id} deleted via runDeathAndCleanup`);
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
    await actor.delete();
    console.log(`[${MODULE_ID}] dismiss broker: deleted companion ${actor.name} (${actorId})`);
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
