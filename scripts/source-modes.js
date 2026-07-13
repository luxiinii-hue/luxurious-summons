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

// ── v0.5.0 TASK 3: @flags.dnd5e.summon.{level,mod} substitution ──────────
//
// TASK 0 finding: dnd5e's 2024-SRD "Spiritual Weapon" and "Arcane Hand" stat
// blocks (packs/_source/actors24/conjurations/{spiritual-weapon,arcane-hand}.yml,
// verified against the release-5.2.1 tag) embed damage-roll formulas that
// reference `@flags.dnd5e.summon.level` and `@flags.dnd5e.summon.mod`:
//   spiritual-weapon: "(@flags.dnd5e.summon.level - 1)d8 + @flags.dnd5e.summon.mod"
//   arcane-hand:       "(2 * @flags.dnd5e.summon.level - 5)d8"            (Clenched Fist)
//                       "(2 * @flags.dnd5e.summon.level - 6)d6 + @flags.dnd5e.summon.mod"  (Grasping Hand)
// These flags are written onto the SUMMONED actor by dnd5e's own
// SummonActivity#getChanges (module/documents/activity/summon.mjs, ~line 266):
//   actorUpdates["flags.dnd5e.summon"] = { level: this.relevantLevel, mod: rollData.mod, ... }
// A standalone clone created via our own Actor.create() never goes through
// that activity, so the flags are never set — the roll formula would parse
// fine (it's valid dnd5e roll-data syntax) but resolve `@flags.dnd5e.summon.level`
// and `.mod` to `undefined`, producing NaN-shaped dice terms at roll time.
// This is a SIBLING failure mode to the "[object Object] damage parts" bug
// documented in the workspace CLAUDE.md (dnd5e 5.x damage parts are strings) —
// same "looks fine until someone rolls damage" latency, different root cause
// (missing roll-data flags, not malformed parts shape).
//
// Fix: write `flags.dnd5e.summon.{level,mod}` directly onto the cloned actor
// data at spawn time, computed the same way dnd5e's own activity would:
//   level = castSlotLevel ?? template's spell base level (upcast-aware, mirrors relevantLevel)
//   mod   = the CASTER's relevant spellcasting-ability modifier (mirrors rollData.mod)
// This is NOT a string-replace of the formula text — the formula stays
// "@flags.dnd5e.summon.level"; we make that roll-data path resolve correctly
// by populating the flag dnd5e's own damage roll already expects to read.

/**
 * Pure-logic. Computes the caster's spellcasting-ability modifier the same
 * way dnd5e's SummonActivity does (`rollData.mod` from `actor.getRollData()`),
 * without depending on Foundry's Actor#getRollData implementation — takes an
 * already-resolved ability score object so this stays testable without mocks.
 *
 * @param abilityScore  the caster's spellcasting ability's `.value` (10-20 typical)
 * @returns {number}    floor((score - 10) / 2), defaulting to 0 for a missing/invalid score
 */
export function computeSpellcastingMod(abilityScore) {
  if (typeof abilityScore !== "number" || Number.isNaN(abilityScore)) return 0;
  return Math.floor((abilityScore - 10) / 2);
}

/**
 * Pure-logic. Writes `flags.dnd5e.summon.{level,mod}` onto a (deep-cloned)
 * actor data object so damage formulas referencing those roll-data paths
 * resolve correctly outside dnd5e's native summon activity.
 *
 * @param actorData    cloned compendium actor data (already has _id stripped)
 * @param level        resolved summon level (castSlotLevel, falling back to
 *                      the template's base spell level — resolution happens
 *                      at the call site since it needs template + cast context)
 * @param mod           the caster's spellcasting ability modifier
 * @returns {object}    new actor data object with the flag applied
 */
export function applySummonFlags(actorData, level, mod) {
  const data = structuredClone(actorData);
  data.flags = data.flags ?? {};
  data.flags.dnd5e = { ...(data.flags.dnd5e ?? {}), summon: { ...(data.flags.dnd5e?.summon ?? {}), level, mod } };
  return data;
}

/**
 * Pure-logic (v0.4.7 FIX 5; v0.4.8 made variant-aware). Given already-cloned
 * compendium actor data and the owning template (+ optional variant), decide
 * whether the actor img / token texture need a fallback, and return the
 * corrected data.
 *
 * Root cause: dnd5e 5.2.1's 2024-SRD Draconic Spirit source entry
 * (`actors24/summons/draconic-spirit.yml`) ships `img: ''` and no
 * prototypeToken texture src, and it's absent from `fa-token-mapping.json`
 * (the system's default-art lookup table) — so a spawned Draconic Spirit
 * gets Foundry's generic mystery-man silhouette instead of a dragon icon.
 * Applied generically so ANY compendium/compendium-scaled variant with
 * missing art benefits, not just Summon Dragon.
 *
 * v0.4.8: fallback priority is `variant?.thumbnail ?? template?.thumbnail`.
 * Real per-variant art shipped in v0.4.8 (e.g. summon-dragon's 5 dragon-<type>
 * webps) — a spawned Cold dragon whose compendium source is missing art must
 * heal to the cold-dragon thumbnail, not the fire one just because it's the
 * template-level default. Templates without distinct variant art (variant.thumbnail
 * undefined, or no variant passed) fall through to template.thumbnail exactly
 * as before — this is a strict superset of the old behavior.
 *
 * Preserves existing prototypeToken width/height/scale — the Draconic
 * Spirit is a Large creature (width/height 2) and the fallback must not
 * shrink it back to Medium.
 *
 * @param actorData  cloned compendium actor data (already has _id stripped)
 * @param template   the owning template — its `thumbnail` is the fallback art
 * @param variant    optional selected variant — its `thumbnail` takes priority
 * @returns {{ data: object, healed: boolean }} healed=true if a fallback was applied
 */
export function resolveArtFallback(actorData, template, variant) {
  const fallback = variant?.thumbnail ?? template?.thumbnail;
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

/**
 * Foundry-side; not unit-tested (fromUuid + game.settings-shaped inputs).
 *
 * @param overrideArtPath  v0.5.0 TASK 2 — generalizes the mageHandTokenPath
 *   override (previously inline-synthesized-only, see resolveInlineData) to
 *   the compendium path. Applied AFTER resolveArtFallback so an explicit GM
 *   override always wins over the automatic missing-art heal. Caller
 *   (spawn-engine.js) reads the per-template setting and passes it in — kept
 *   as an injected param, not read here, so this stays consistent with the
 *   existing resolveInlineData pattern.
 * @param castSlotLevel + casterAbilityScore  v0.5.0 TASK 3 — only used when
 *   template.source.substituteSpellLevel is true (Spiritual Weapon, Arcane
 *   Hand). casterAbilityScore is the caster's RELEVANT spellcasting ability
 *   score (e.g. Wisdom for a cleric casting Spiritual Weapon) — the caller
 *   resolves which ability that is (spawn-engine.js reads
 *   sourceActor.system.attributes.spellcasting + the ability score), this
 *   function only does the floor((score-10)/2) arithmetic via
 *   computeSpellcastingMod. See applySummonFlags doc comment above.
 */
export async function resolveCompendiumData(template, variant, { name, folderId, overrideArtPath, castSlotLevel, casterAbilityScore } = {}) {
  const uuid = variant?.source?.baseUuid ?? template?.source?.baseUuid;
  if (!uuid) throw new Error(`no baseUuid on template "${template?.id}" or its variant`);
  const actor = await fromUuid(uuid);
  if (!actor) throw new Error(`fromUuid("${uuid}") returned null`);
  let data = actor.toObject();
  delete data._id;
  data.name = name ?? `${data.name} of ${template?.name ?? "?"}`;
  if (folderId) data.folder = folderId;

  // v0.4.7 FIX 5, v0.4.8 variant-aware — heal missing art (e.g. the 2024
  // Draconic Spirit ships img: '' with no token texture). See
  // resolveArtFallback doc comment for the variant?.thumbnail ?? template.thumbnail
  // priority.
  const { data: healedData, healed } = resolveArtFallback(data, template, variant);
  data = healedData;
  if (healed) {
    const healedTo = variant?.thumbnail ?? template.thumbnail;
    console.log(`[luxurious-summons] resolveCompendiumData: applied art fallback for "${template?.id}"${variant ? ` variant "${variant.id}"` : ""} (source had missing/default art) -> ${healedTo}`);
  }

  // v0.5.0 TASK 2: explicit override art (e.g. mageHandTokenPath, once Mage
  // Hand or any other template routes through the compendium path with a
  // configured override) wins over both the source's own art AND the
  // automatic fallback above.
  if (overrideArtPath) {
    data.img = overrideArtPath;
    data.prototypeToken = data.prototypeToken ?? {};
    data.prototypeToken.texture = { ...(data.prototypeToken.texture ?? {}), src: overrideArtPath };
  }

  // v0.5.0 TASK 3: Spiritual Weapon / Arcane Hand damage formulas reference
  // @flags.dnd5e.summon.{level,mod}, which dnd5e's native SummonActivity
  // writes onto the summoned actor but our clone path bypasses. See the
  // applySummonFlags doc comment for the full explanation.
  if (template?.source?.substituteSpellLevel) {
    const level = castSlotLevel ?? template?.source?.baseSpellLevel ?? 1;
    const mod = computeSpellcastingMod(casterAbilityScore);
    data = applySummonFlags(data, level, mod);
    console.log(`[luxurious-summons] resolveCompendiumData: applied flags.dnd5e.summon (level=${level}, mod=${mod}) for "${template?.id}"`);
  }

  return data;
}

export async function resolveCompendiumScaledData(template, variant, { name, folderId, castSlotLevel, overrideArtPath, casterAbilityScore } = {}) {
  const base = await resolveCompendiumData(template, variant, { name, folderId, castSlotLevel, overrideArtPath, casterAbilityScore });
  const tier = pickScalingTier(template?.source?.scalingTable ?? [], castSlotLevel);
  return applyScalingTier(base, tier);
}
