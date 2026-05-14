// scripts/variant-eligibility.js — pure-logic variant filtering by caster
// eligibility. Used by the variant-picker modal to dim or hide variants the
// caster can't use (Pact of the Chain options for non-warlocks etc.).

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
  if (reqs.spellSlotLevel !== undefined) {
    const maxSlot = caster?.maxSpellSlotLevel ?? 0;
    if (maxSlot < reqs.spellSlotLevel) return false;
  }
  return true;
}

export function filterVariants(variants, caster) {
  return (variants ?? []).filter(v => isVariantEligible(v, caster));
}
