// scripts/source-modes.js — actor-data resolution per source mode.
//
// `clone`              — duplicate the master actor's data (Simulacrum)
// `inline-synthesized` — synthesize from template.source.inline (Mage Hand etc.)
// `compendium`         — async UUID lookup (Find Familiar etc.)
// `compendium-scaled`  — async UUID lookup + per-cast-level scaling deltas (Summon Dragon)
//
// The two sync modes are pure-logic and unit-tested here.
// The two async modes need Foundry's fromUuid() — defined below but not
// unit-tested directly (covered by manual live-Foundry verification).

export function resolveCloneData(sourceActor, { prefix = "", suffix = "", folderId } = {}) {
  const data = sourceActor.toObject();
  delete data._id;
  data.name = `${prefix}${sourceActor.name}${suffix}`;
  if (folderId) data.folder = folderId;
  return data;
}

export function resolveInlineData(template, { name, folderId } = {}) {
  const inline = template?.source?.inline;
  if (!inline) throw new Error(`template "${template?.id ?? template?.name}" has no source.inline`);
  // Deep-clone via structuredClone so subsequent calls don't share references with the template definition
  const data = structuredClone(inline);
  data.name = name ?? data.name ?? template.name;
  if (folderId) data.folder = folderId;
  return data;
}

/**
 * Pure-logic helper: given a scaling table and a cast slot level, return
 * the matching scaling tier (or the first tier if no match — handles
 * "cast below the spell's base level" gracefully).
 */
export function pickScalingTier(scalingTable, castSlotLevel) {
  if (!Array.isArray(scalingTable) || scalingTable.length === 0) return null;
  return scalingTable.find(row => row.slotLevel === castSlotLevel) ?? scalingTable[0];
}

/**
 * Pure-logic helper: given a base actor data and a scaling tier, apply
 * HP deltas. Mutates a deep copy of base; returns the result.
 *
 * Damage and attack-bonus scalars are applied per-item (item-level damage
 * formulas) at the spawn-engine layer, not here — this helper handles only
 * the system-level HP scaling that's safe to apply at the actor-doc level.
 */
export function applyScalingTier(baseData, tier) {
  if (!tier) return baseData;
  const data = structuredClone(baseData);
  if (data.system?.attributes?.hp) {
    data.system.attributes.hp.max = (data.system.attributes.hp.max ?? 0) + (tier.hpAdd ?? 0);
    data.system.attributes.hp.value = data.system.attributes.hp.max;
  }
  return data;
}

// Foundry-side; not unit-tested
export async function resolveCompendiumData(template, variant, { name, folderId } = {}) {
  const uuid = variant?.source?.baseUuid ?? template?.source?.baseUuid;
  if (!uuid) throw new Error(`no baseUuid on template "${template?.id}" or its variant`);
  const actor = await fromUuid(uuid);
  if (!actor) throw new Error(`fromUuid("${uuid}") returned null`);
  const data = actor.toObject();
  delete data._id;
  data.name = name ?? `${data.name} of ${template?.name ?? "?"}`;
  if (folderId) data.folder = folderId;
  return data;
}

export async function resolveCompendiumScaledData(template, variant, { name, folderId, castSlotLevel } = {}) {
  const base = await resolveCompendiumData(template, variant, { name, folderId });
  const tier = pickScalingTier(template?.source?.scalingTable ?? [], castSlotLevel);
  return applyScalingTier(base, tier);
}
