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

/**
 * @param overrideArtPath  v0.4.7 FIX 4 — when non-empty, replaces both `img`
 *   and `prototypeToken.texture.src` on the resolved data. Caller (spawn-engine.js)
 *   is responsible for reading the per-template setting (e.g. mageHandTokenPath)
 *   and passing it in — kept as an injected param instead of reaching for
 *   `game.settings` here so this function stays pure-logic and unit-testable
 *   without mocking Foundry globals.
 */
export function resolveInlineData(template, { name, folderId, overrideArtPath } = {}) {
  const inline = template?.source?.inline;
  if (!inline) throw new Error(`template "${template?.id ?? template?.name}" has no source.inline`);
  // Deep-clone via structuredClone so subsequent calls don't share references with the template definition
  const data = structuredClone(inline);
  data.name = name ?? data.name ?? template.name;
  if (folderId) data.folder = folderId;
  if (overrideArtPath) {
    data.img = overrideArtPath;
    data.prototypeToken = data.prototypeToken ?? {};
    data.prototypeToken.texture = { ...(data.prototypeToken.texture ?? {}), src: overrideArtPath };
  }
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

// Foundry's default "no art" placeholder — dnd5e source entries with an empty
// `img` (e.g. the 2024 Draconic Spirit, see resolveArtFallback doc comment)
// resolve to this at Document creation time even though the raw compendium
// data has `img: ""`, so both the empty-string AND this literal path count
// as "missing art" for fallback purposes.
const FOUNDRY_DEFAULT_ACTOR_IMG = "icons/svg/mystery-man.svg";

/**
 * Pure-logic (v0.4.7 FIX 5). Given already-cloned compendium actor data and
 * the owning template, decide whether the actor img / token texture need a
 * fallback, and return the corrected data.
 *
 * Root cause: dnd5e 5.2.1's 2024-SRD Draconic Spirit source entry
 * (`actors24/summons/draconic-spirit.yml`) ships `img: ''` and no
 * prototypeToken texture src, and it's absent from `fa-token-mapping.json`
 * (the system's default-art lookup table) — so a spawned Draconic Spirit
 * gets Foundry's generic mystery-man silhouette instead of a dragon icon.
 * Applied generically so ANY compendium/compendium-scaled variant with
 * missing art benefits, not just Summon Dragon.
 *
 * Preserves existing prototypeToken width/height/scale — the Draconic
 * Spirit is a Large creature (width/height 2) and the fallback must not
 * shrink it back to Medium.
 *
 * @param actorData  cloned compendium actor data (already has _id stripped)
 * @param template   the owning template — its `thumbnail` is the fallback art
 * @returns {{ data: object, healed: boolean }} healed=true if a fallback was applied
 */
export function resolveArtFallback(actorData, template) {
  const fallback = template?.thumbnail;
  if (!fallback) return { data: actorData, healed: false };

  const isMissing = (src) => !src || src === FOUNDRY_DEFAULT_ACTOR_IMG;

  const needsImgFix = isMissing(actorData.img);
  const needsTokenFix = isMissing(actorData.prototypeToken?.texture?.src);
  if (!needsImgFix && !needsTokenFix) return { data: actorData, healed: false };

  const data = structuredClone(actorData);
  if (needsImgFix) data.img = fallback;
  if (needsTokenFix) {
    data.prototypeToken = data.prototypeToken ?? {};
    data.prototypeToken.texture = { ...(data.prototypeToken.texture ?? {}), src: fallback };
  }
  return { data, healed: true };
}

// Foundry-side; not unit-tested
export async function resolveCompendiumData(template, variant, { name, folderId } = {}) {
  const uuid = variant?.source?.baseUuid ?? template?.source?.baseUuid;
  if (!uuid) throw new Error(`no baseUuid on template "${template?.id}" or its variant`);
  const actor = await fromUuid(uuid);
  if (!actor) throw new Error(`fromUuid("${uuid}") returned null`);
  let data = actor.toObject();
  delete data._id;
  data.name = name ?? `${data.name} of ${template?.name ?? "?"}`;
  if (folderId) data.folder = folderId;

  // v0.4.7 FIX 5 — heal missing art (e.g. the 2024 Draconic Spirit ships
  // img: '' with no token texture). See resolveArtFallback doc comment.
  const { data: healedData, healed } = resolveArtFallback(data, template);
  data = healedData;
  if (healed) {
    console.log(`[luxurious-summons] resolveCompendiumData: applied art fallback for "${template?.id}" (source had missing/default art) -> ${template.thumbnail}`);
  }

  return data;
}

export async function resolveCompendiumScaledData(template, variant, { name, folderId, castSlotLevel } = {}) {
  const base = await resolveCompendiumData(template, variant, { name, folderId });
  const tier = pickScalingTier(template?.source?.scalingTable ?? [], castSlotLevel);
  return applyScalingTier(base, tier);
}
