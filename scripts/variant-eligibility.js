// scripts/variant-eligibility.js — pure-logic variant filtering by caster
// eligibility. Used by the variant-picker modal to dim or hide variants the
// caster can't use (Pact of the Chain options for non-warlocks etc.).
//
// v0.4.6 FIX 2: Pact of the Chain is a warlock PACT-BOON FEATURE (an owned
// Item of type "feat" named "Pact of the Chain"), not a dnd5e subclass —
// subclass identifiers look like "the-fiend" / "the-archfey". The original
// `requires.subclass: "pact-of-the-chain"` on the four Pact variants could
// never match any real caster, silently hiding those variants forever.
// `requires.feature` matches (case-insensitively) against the caster's owned
// feat-type item names. `subclass` support is kept for future templates that
// do gate on a real subclass identifier.

export function isVariantEligible(variant, caster) {
  if (!variant?.requires) return true;
  const reqs = variant.requires;
  const classes = caster?.classes ?? [];
  if (reqs.class) {
    const match = classes.find(c => c.name === reqs.class);
    if (!match) return false;
    if (reqs.subclass && match.subclass !== reqs.subclass) return false;
    if (reqs.classLevel !== undefined && (match.level ?? 0) < reqs.classLevel) return false;
  }
  if (reqs.feature) {
    const featureNames = caster?.featureNames ?? [];
    if (!featureNames.includes(reqs.feature.toLowerCase())) return false;
  }
  if (reqs.spellSlotLevel !== undefined) {
    const maxSlot = caster?.maxSpellSlotLevel ?? 0;
    if (maxSlot < reqs.spellSlotLevel) return false;
  }
  return true;
}

export function filterVariants(variants, caster) {
  return (variants ?? []).filter(v => isVariantEligible(v, caster));
}
