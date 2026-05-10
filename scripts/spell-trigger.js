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

function handleItemUse(item, _config, _options) {
  const tpl = findTemplateByItem(item);
  if (!tpl) return;
  const sourceActor = item.actor;
  if (!sourceActor) return;
  if (!sourceActor.isOwner) return;     // only trigger for actors I own
  console.log(`[${MODULE_ID}] spell-cast trigger fired: "${item.name}" → template "${tpl.id}"`);
  runSpawnFlow(tpl, sourceActor.id);
}

export function installSpellCastTrigger() {
  // dnd5e v3 ships dnd5e.useItem; v4 may rename to dnd5e.useActivity. Register
  // both — at most one fires per use, so a no-op on the absent one is harmless.
  Hooks.on("dnd5e.useItem", handleItemUse);
  Hooks.on("dnd5e.useActivity", (activity, _usage, _config) => {
    // V4 activity flow — the spell item is at activity.item
    handleItemUse(activity?.item, null, null);
  });
}
