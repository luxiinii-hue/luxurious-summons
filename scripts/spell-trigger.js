// scripts/spell-trigger.js — wire dnd5e spell-cast → spawn flow.
//
// When a player casts a spell whose name matches a template's triggerSpell,
// auto-open the Spawn Dialog with the casting actor pre-selected as master.
// Other spells unaffected.
//
// RAW: dnd5e.useItem fires AFTER spell-slot consumption. So if the player
// cancels the spawn dialog the slot is already gone — the user has accepted
// this trade-off (refund manually if a real edge case arises) rather than
// taking on the surface area of intercepting via dnd5e.preUseItem.

import { templates as builtinTemplates } from "./templates-builtin.js";
import { runSpawnFlow } from "./spawn-flow.js";

const MODULE_ID = "luxurious-summons";

function findTemplateByItem(item) {
  if (!item) return null;
  if (item.type !== "spell") return null;
  const itemName = item.name?.toLowerCase();
  if (!itemName) return null;
  return builtinTemplates.find(t => t.triggerSpell?.toLowerCase() === itemName) ?? null;
}

// Guard against the same item triggering twice when multiple compat hooks fire.
const _recentlyTriggered = new WeakSet();
function markTriggered(item) {
  if (!item) return false;
  if (_recentlyTriggered.has(item)) return false;
  _recentlyTriggered.add(item);
  setTimeout(() => _recentlyTriggered.delete(item), 1500);
  return true;
}

function handleItemUse(item, hookName) {
  const tpl = findTemplateByItem(item);
  if (!tpl) return;
  const sourceActor = item.actor;
  if (!sourceActor) return;
  if (!sourceActor.isOwner) return;     // only trigger for actors I own
  if (!markTriggered(item)) {
    console.log(`[${MODULE_ID}] ${hookName} fired for "${item.name}" but already handled via another hook — skipping duplicate`);
    return;
  }
  console.log(`[${MODULE_ID}] spell-cast trigger fired via ${hookName}: "${item.name}" → template "${tpl.id}"`);
  runSpawnFlow(tpl, sourceActor.id);
}

export function installSpellCastTrigger() {
  // dnd5e's hook evolution (verified via context7 against the official wiki):
  //   v3       — `dnd5e.useItem`             (item, config, options)
  //   v4 +     — `dnd5e.useActivity`         (activity, usage, config)         legacy v4 emitter
  //   v4 / v5  — `dnd5e.postUseActivity`     (activity, usageConfig, results)  canonical v5
  // Register all three; the WeakSet guard above prevents duplicate Spawn dialogs
  // when more than one hook fires for the same item-use on a given dnd5e build.
  Hooks.on("dnd5e.useItem", (item, _config, _options) => handleItemUse(item, "dnd5e.useItem"));
  Hooks.on("dnd5e.useActivity", (activity, _usage, _config) => handleItemUse(activity?.item, "dnd5e.useActivity"));
  Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, _results) => handleItemUse(activity?.item, "dnd5e.postUseActivity"));
  console.log(`[${MODULE_ID}] spell-cast trigger registered for 3 dnd5e hook variants (useItem v3, useActivity v4, postUseActivity v5)`);
}
