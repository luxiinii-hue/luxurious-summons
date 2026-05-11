// scripts/handlers/simulacrum.js — Simulacrum-specific extra actions and spawn hooks
import { registerHandler } from "./index.js";

const MODULE_ID = "luxurious-summons";

/**
 * Spawn-time hook: reset the cloned companion's spell slots to FULL.
 *
 * The clone inherits the master's current spell-slot expenditure state, but RAW
 * Simulacrum is a snapshot of the master at peak power — full slots regardless
 * of how many the caster has used. After this reset, the `snapshotSpells` flag
 * (set by applyDnd5eMods) tells preUpdateActor in dnd5e-mods.js to block any
 * future slot-value increases, which is how we enforce RAW "Simulacrum doesn't
 * recover hit points or spell slots through any means."
 *
 * Called from spawn-engine.js performSpawn after applyDnd5eMods.
 */
export async function onAfterSpawn(companion, _master) {
  const updates = {};
  const spells = companion.system?.spells ?? {};
  for (const [key, val] of Object.entries(spells)) {
    if (val && typeof val.max === "number" && typeof val.value === "number" && val.value < val.max) {
      updates[`system.spells.${key}.value`] = val.max;
    }
  }
  if (Object.keys(updates).length > 0) {
    await companion.update(updates);
    console.log(`[${MODULE_ID}] reset ${Object.keys(updates).length} spell slot(s) to max on ${companion.id} (Simulacrum starts at peak power)`);
  } else {
    console.log(`[${MODULE_ID}] no spell slots needed reset on ${companion.id} (already at max or no spell list)`);
  }
}

/**
 * Repair action: 100gp + 1 hour → roll 4d6+24, heal the companion (sanctioned
 * via allowedHeal flag so preUpdateActor lets it through).
 */
async function repairAction({ actor }) {
  const masterId = actor.flags?.[MODULE_ID]?.sourceActorId;
  const master = masterId ? game.actors.get(masterId) : null;
  const autoDeduct = game.settings.get(MODULE_ID, "autoDeductGoldForRepair");
  const cost = 100;

  const proceed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Repair Simulacrum" },
    content: `<p>Repair <strong>${actor.name}</strong>?</p>
              <ul>
                <li>Cost: ${cost}gp ${autoDeduct ? "(will be deducted from " + (master?.name ?? "master") + ")" : "(logged only — auto-deduct off)"}</li>
                <li>Time: 1 hour</li>
                <li>Heal roll: 4d6+24</li>
              </ul>`,
    yes: { label: "Roll & Repair", callback: () => true },
    no:  { label: "Cancel",         callback: () => false },
    rejectClose: false
  });
  if (!proceed) return;

  const roll = await new Roll("4d6+24").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>Repair</strong> ${actor.name}`
  });
  const healAmount = roll.total;
  const newHp = Math.min(actor.system.attributes.hp.max, actor.system.attributes.hp.value + healAmount);

  await actor.update(
    { "system.attributes.hp.value": newHp },
    { [`${MODULE_ID}.allowedHeal`]: true }
  );

  const log = actor.flags?.[MODULE_ID]?.repairLog ?? [];
  log.push({ ts: Date.now(), amount: healAmount, by: game.user.id });
  await actor.update({ [`flags.${MODULE_ID}.repairLog`]: log });

  if (autoDeduct && master && master.system.currency?.gp !== undefined) {
    const newGp = Math.max(0, master.system.currency.gp - cost);
    await master.update({ "system.currency.gp": newGp });
    console.log(`[${MODULE_ID}] deducted ${cost}gp from ${master.name} (was ${master.system.currency.gp + cost}, now ${newGp})`);
  }

  ui.notifications?.info(`[${MODULE_ID}] ${actor.name} repaired for ${healAmount} HP`);
}

// Self-register on import
registerHandler("simulacrum.repair", repairAction);
