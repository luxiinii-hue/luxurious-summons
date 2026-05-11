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
 * Wire the dnd5e-specific hooks:
 *   - preUpdateActor (HP): block HP increases on companions flagged blockNaturalRecovery
 *     (unless the update carries an `${MODULE_ID}.allowedHeal` option, set by Repair)
 *   - preUpdateActor (spell slots): block any spell-slot-value increases on companions
 *     flagged snapshotSpells. Mirror of the HP-block pattern. Replaces the old
 *     restCompleted-revert approach which only fired on rest and let other slot-recovery
 *     paths (potions, custom features) silently restore slots.
 */
export function installDnd5eHooks() {
  Hooks.on("preUpdateActor", (actor, changes, options, _userId) => {
    if (!isCompanion(actor)) return;
    const flag = getCompanionFlag(actor);
    if (!flag) return;

    // ── HP block ───
    if (flag.blockNaturalRecovery) {
      const newHp = changes?.system?.attributes?.hp?.value;
      if (newHp !== undefined) {
        const currentHp = actor.system.attributes.hp.value;
        const isIncrease = newHp > currentHp;
        if (isIncrease && options?.[`${MODULE_ID}.allowedHeal`] !== true) {
          delete changes.system.attributes.hp.value;
          ui.notifications?.info(`[${MODULE_ID}] ${actor.name} cannot regain HP through normal means. Use the Repair action.`);
          console.log(`[${MODULE_ID}] blocked natural HP recovery on companion ${actor.id}`);
        }
      }
    }

    // ── Spell slot block ───
    if (flag.snapshotSpells) {
      const spellChanges = changes?.system?.spells;
      if (spellChanges) {
        const blocked = [];
        for (const [key, slotChange] of Object.entries(spellChanges)) {
          const newValue = slotChange?.value;
          if (newValue === undefined) continue;
          const currentValue = actor.system.spells?.[key]?.value ?? 0;
          if (newValue > currentValue) {
            delete spellChanges[key].value;
            // Clean up the now-empty per-slot change object so dnd5e doesn't churn on it.
            if (Object.keys(spellChanges[key]).length === 0) delete spellChanges[key];
            blocked.push(`${key} (${currentValue} → ${newValue})`);
          }
        }
        if (blocked.length > 0) {
          if (Object.keys(spellChanges).length === 0) delete changes.system.spells;
          console.log(`[${MODULE_ID}] blocked spell-slot recharge on ${actor.id}: ${blocked.join(", ")}`);
        }
      }
    }
  });
}
