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
 * `trigger.name` accepts a string or an array of alias names — Summon Dragon
 * carries both the Tasha's name ("Summon Draconic Spirit", via DDB-Importer)
 * and the dnd5e-2024 SRD name ("Summon Dragon").
 *
 * Returns an array of matching templates (possibly empty).
 * Exported for the pure-logic test suite.
 */
export function findTemplatesByItem(item, templates = builtinTemplates) {
  if (!item) return [];
  const itemName = item.name?.toLowerCase();
  if (!itemName) return [];
  return templates.filter(t => {
    const raw = t.trigger?.name ?? t.triggerSpell;
    const triggerNames = (Array.isArray(raw) ? raw : [raw])
      .filter(n => typeof n === "string")
      .map(n => n.toLowerCase());
    if (!triggerNames.includes(itemName)) return false;
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
 * Best-effort extraction of the spell-slot level used for this cast.
 *
 * v0.4.6 FIX 4: verified against dnd5e 5.2.1 `activity/mixin.mjs` (~461-464) —
 * `usageConfig.spell.slot` is a KEY STRING like "spell6" or "pact", never a
 * number. `usageConfig.consume.spellSlot` is a BOOLEAN ("should this activation
 * consume a slot at all"), not a level — the old `??` chain treated whichever
 * of these was truthy as the numeric level, so `pickScalingTier` in
 * source-modes.js (which compares `row.slotLevel === castSlotLevel`) could
 * never match a real scaling row; it silently fell back to the table's first
 * tier every time regardless of the actual cast level.
 *
 * Returns a number, or null if nothing usable was found (callers fall back to
 * the template's base level).
 */
export function extractCastSlotLevel(usageConfig, activity, item) {
  const slotKey = usageConfig?.spell?.slot;
  if (typeof slotKey === "number") return slotKey;
  if (typeof slotKey === "string") {
    const m = /^spell(\d+)$/.exec(slotKey);
    if (m) return Number(m[1]);
    if (slotKey === "pact") {
      const pactLevel = item?.actor?.system?.spells?.pact?.level;
      if (typeof pactLevel === "number") return pactLevel;
    }
  }
  const base = item?.system?.level;
  const scaling = usageConfig?.scaling;
  if (typeof base === "number" && typeof scaling === "number") return base + scaling;
  return typeof base === "number" ? base : null;
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

  // For shared triggers (Find Familiar matches both the find-familiar AND
  // pact-of-the-chain templates), prefer the find-familiar template. This is a
  // DIFFERENT template from pact-of-the-chain — the four Pact variants (Imp,
  // Pseudodragon, Quasit, Sprite) do NOT surface in the find-familiar picker;
  // pact-of-the-chain has its own separate template + variant list and is only
  // reachable via the Manager's template gallery (its own card, gated on
  // requires.feature "Pact of the Chain" per variant, per v0.4.6 FIX 2). This
  // was previously mis-documented as "the Pact variants surface in the picker
  // via eligibility filtering" — that's wrong; the whole TEMPLATE is skipped
  // here, so its variants are never rendered by this trigger path at all.
  // Future improvement: a small picker over which TEMPLATE to use when both
  // match independently — out of scope for Plan 3.
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
