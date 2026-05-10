// scripts/dnd5e-mods.js — dnd5e-specific stat modifications + hook layer
//
// computeModUpdates is pure-logic (Task 17, unit-tested).
// applyDnd5eMods is the Foundry-side wrapper (Task 17).
// installDnd5eHooks wires preUpdateActor + dnd5e.restCompleted (Task 18).

import { isCompanion, getCompanionFlag } from "./data-model.js";

const MODULE_ID = "luxurious-summons";

/**
 * Pure-logic. Given the master's HP block + the template's dnd5eMods,
 * returns the actor.update() patch object.
 */
export function computeModUpdates({ masterHp, mods }) {
  const updates = {};
  if (mods.halveMaxHp && typeof masterHp?.max === "number") {
    const halved = Math.floor(masterHp.max / 2);
    updates["system.attributes.hp.max"] = halved;
    updates["system.attributes.hp.value"] = halved;
  }
  return updates;
}

/**
 * Foundry-side wrapper. Applies HP updates + sets behavior flags
 * (blockNaturalRecovery, snapshotSpells) read by the hook layer.
 */
export async function applyDnd5eMods(companion, master, template) {
  const mods = template.dnd5eMods ?? {};
  const updates = computeModUpdates({ masterHp: master.system?.attributes?.hp, mods });

  if (mods.blockNaturalRecovery) {
    updates[`flags.${MODULE_ID}.blockNaturalRecovery`] = true;
  }
  if (mods.snapshotSpellSlots) {
    updates[`flags.${MODULE_ID}.snapshotSpells`] = true;
  }

  if (Object.keys(updates).length > 0) {
    await companion.update(updates);
    console.log(`[${MODULE_ID}] applied dnd5e mods to ${companion.id}: ${Object.keys(updates).join(", ")}`);
  }
}

/**
 * Wire the two dnd5e-specific hooks:
 *   - preUpdateActor: block HP increases on companions flagged blockNaturalRecovery
 *     (unless the update carries an `${MODULE_ID}.allowedHeal` option, set by Repair)
 *   - dnd5e.restCompleted: revert spell-slot recharge for companions flagged snapshotSpells
 */
export function installDnd5eHooks() {
  Hooks.on("preUpdateActor", (actor, changes, options, _userId) => {
    if (!isCompanion(actor)) return;
    const flag = getCompanionFlag(actor);
    if (!flag?.blockNaturalRecovery) return;

    const newHp = changes?.system?.attributes?.hp?.value;
    if (newHp === undefined) return;
    const currentHp = actor.system.attributes.hp.value;
    const isIncrease = newHp > currentHp;
    if (!isIncrease) return;     // damage / no-op: allowed

    if (options?.[`${MODULE_ID}.allowedHeal`] === true) return;     // sanctioned

    delete changes.system.attributes.hp.value;
    ui.notifications?.info(`[${MODULE_ID}] ${actor.name} cannot regain HP through normal means. Use the Repair action.`);
    console.log(`[${MODULE_ID}] blocked natural HP recovery on companion ${actor.id}`);
  });

  Hooks.on("dnd5e.restCompleted", async (actor, _result) => {
    if (!isCompanion(actor)) return;
    const flag = getCompanionFlag(actor);
    if (!flag?.snapshotSpells) return;

    const snapshot = flag?.spellSlotsSnapshot;
    if (!snapshot) {
      console.warn(`[${MODULE_ID}] snapshotSpells set but no spellSlotsSnapshot on ${actor.id}; can't restore`);
      return;
    }
    const updates = {};
    for (const [key, value] of Object.entries(snapshot)) {
      updates[`system.spells.${key}.value`] = value;
    }
    await actor.update(updates);
    console.log(`[${MODULE_ID}] reverted spell-slot recharge on ${actor.id} after rest`);
  });
}
