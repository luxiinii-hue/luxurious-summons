// scripts/spell-trigger.js — wire dnd5e spell/feature use → variant picker.
//
// When a player casts a spell or uses a feature whose name matches a template's
// trigger, auto-open the Variant Picker with the casting actor pre-selected
// as master. Plan 3: the picker is the universal entry point (replaces the
// direct runSpawnFlow call). For compendium-scaled templates (Summon Dragon)
// we extract the cast's slot level from usageConfig and pre-fill the picker.
//
// RAW: dnd5e.postUseActivity fires AFTER spell-slot consumption. So if the player
// cancels the spawn dialog the slot is already gone — the user has accepted
// this trade-off (refund manually if a real edge case arises) rather than
// taking on the surface area of intercepting via dnd5e.preUseActivity.

import { templates as builtinTemplates } from "./templates-builtin.js";

const MODULE_ID = "luxurious-summons";

/**
 * Find every template whose trigger matches this item.
 * Plan 3: Find Familiar + Pact of the Chain share `trigger.name = "Find Familiar"`,
 * so a single item-use can match multiple templates. The picker handles routing.
 *
 * Returns an array of matching templates (possibly empty).
 */
function findTemplatesByItem(item) {
  if (!item) return [];
  const itemName = item.name?.toLowerCase();
  if (!itemName) return [];
  return builtinTemplates.filter(t => {
    const triggerName = (t.trigger?.name ?? t.triggerSpell)?.toLowerCase();
    if (!triggerName || triggerName !== itemName) return false;
    const expectedType = t.trigger?.type ?? "spell";
    if (expectedType === "spell"   && item.type !== "spell") return false;
    if (expectedType === "feature" && item.type !== "feat")  return false;
    return true;
  });
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

/**
 * Best-effort extraction of the spell-slot level used for this cast. dnd5e
 * versions differ in where they stash it on the usage object — try the common
 * paths and return null on miss (the picker falls back to template base level).
 */
function extractCastSlotLevel(usageConfig, activity, item) {
  return usageConfig?.spell?.slot
      ?? usageConfig?.consume?.spellSlot
      ?? usageConfig?.level
      ?? activity?.spell?.level
      ?? item?.system?.level
      ?? null;
}

async function handleItemUse(item, hookName, usageConfig = null, activity = null) {
  const matchedTemplates = findTemplatesByItem(item);
  if (matchedTemplates.length === 0) return;
  const sourceActor = item.actor;
  if (!sourceActor) return;
  if (!sourceActor.isOwner) return;       // only trigger for actors I own
  if (!markTriggered(item)) {
    console.log(`[${MODULE_ID}] ${hookName} fired for "${item.name}" but already handled via another hook — skipping duplicate`);
    return;
  }

  // For shared triggers (Find Familiar matches both Find Familiar + Pact of the
  // Chain templates), prefer the first non-Pact match. The Pact variants will
  // surface in the picker via the variant-eligibility filter if the caster
  // qualifies. Future improvement: a small picker over which TEMPLATE to use
  // when both match independently — out of scope for Plan 3.
  const template = matchedTemplates.find(t => t.id !== "pact-of-the-chain") ?? matchedTemplates[0];
  const castSlotLevel = extractCastSlotLevel(usageConfig, activity, item);

  console.log(`[${MODULE_ID}] trigger fired via ${hookName}: "${item.name}" → template "${template.id}"${castSlotLevel ? ` @ slot level ${castSlotLevel}` : ""}`);

  const { openVariantPicker } = await import("./variant-picker-app.js");
  openVariantPicker(template, {
    sourceActor,
    castSlotLevel,
    triggeredVia: hookName
  });
}

export function installSpellCastTrigger() {
  // dnd5e's hook evolution (verified via context7 against the official wiki):
  //   v3       — `dnd5e.useItem`             (item, config, options)
  //   v4 +     — `dnd5e.useActivity`         (activity, usage, config)         legacy v4 emitter
  //   v4 / v5  — `dnd5e.postUseActivity`     (activity, usageConfig, results)  canonical v5
  // Register all three; the WeakSet guard above prevents duplicate picker
  // opens when more than one hook fires for the same item-use on a given build.
  Hooks.on("dnd5e.useItem",         (item, config, _options)       => handleItemUse(item,            "dnd5e.useItem",         config,    null));
  Hooks.on("dnd5e.useActivity",     (activity, usage, _config)     => handleItemUse(activity?.item,  "dnd5e.useActivity",     usage,     activity));
  Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, _res)  => handleItemUse(activity?.item,  "dnd5e.postUseActivity", usageConfig, activity));
  console.log(`[${MODULE_ID}] spell/feature trigger registered for 3 dnd5e hook variants (useItem v3, useActivity v4, postUseActivity v5)`);
}
