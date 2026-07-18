// scripts/template-store.js — the effective-template layer (v0.7.0, Plan 4 slice 2).
//
// Builtin templates (templates-builtin.js) are immutable shipped data. The GM's
// Templates editor writes per-template override entries into the existing
// `templateOverrides` world setting (the same per-template namespace the GM
// Console uses for motion — the two coexist as sibling keys). This module owns
// the merge: consumers stop importing the builtin array directly and ask for
// EFFECTIVE templates instead.
//
// Override entry shape (all keys optional), per templateId:
//   {
//     motionEnabled, motionIntensity,          // GM Console (v0.6.0) — ignored here
//     nameOverride: string,                    // display name
//     thumbnailOverride: string,               // gallery/thumbnail path
//     variantOverrides: {
//       [variantId]: {
//         name?: string,
//         thumbnail?: string,
//         uuid?: string,                        // → variant.source.baseUuid
//         removed?: true                        // hide a builtin variant
//       }
//     },
//     customVariants: [                         // GM-added variants
//       { id, name, thumbnail?, uuid }
//     ]
//   }
//
// Subscriber-content templates (Summon Beast/Fey/… — not in dnd5e's free packs)
// ship with `source.requiresLink: true` and variants whose baseUuid is null.
// The picker treats an unresolved-link variant as ineligible with a clear
// "ask your GM to link it" message; the GM fills the uuid via the editor and
// the template comes alive. `templateNeedsLink()` below is the single check.

import { templates as builtinTemplates } from "./templates-builtin.js";

const MODULE_ID = "luxurious-summons";

/**
 * Pure-logic. Merge one builtin template with its override entry. Returns a
 * NEW object (builtin data is never mutated); with no override, returns the
 * builtin reference unchanged (cheap identity for the common case).
 */
export function mergeTemplateOverrides(template, override) {
  if (!override) return template;
  const hasEditorKeys = override.nameOverride !== undefined
    || override.thumbnailOverride !== undefined
    || override.variantOverrides
    || (override.customVariants?.length ?? 0) > 0;
  if (!hasEditorKeys) return template;

  const merged = { ...template };
  if (override.nameOverride) merged.name = override.nameOverride;
  if (override.thumbnailOverride) merged.thumbnail = override.thumbnailOverride;

  const variantOverrides = override.variantOverrides ?? {};
  let variants = (template.variants ?? []).map(v => {
    const vo = variantOverrides[v.id];
    if (!vo) return v;
    if (vo.removed === true) return null;
    const nv = { ...v };
    if (vo.name) nv.name = vo.name;
    if (vo.thumbnail) nv.thumbnail = vo.thumbnail;
    if (vo.uuid !== undefined) {
      nv.source = { ...(v.source ?? {}), baseUuid: vo.uuid || null };
    }
    return nv;
  }).filter(Boolean);

  for (const cv of override.customVariants ?? []) {
    if (!cv?.id || variants.some(v => v.id === cv.id)) continue;
    variants.push({
      id: cv.id,
      name: cv.name ?? cv.id,
      thumbnail: cv.thumbnail || template.thumbnail,
      source: { baseUuid: cv.uuid || null },
      _custom: true
    });
  }

  if (variants.length > 0 || template.variants) merged.variants = variants;
  return merged;
}

/**
 * Pure-logic. Does this template still have unlinked stat blocks? True when the
 * template declares `source.requiresLink` and NO variant has a usable baseUuid
 * (template-level baseUuid counts too). A partially-linked template is usable —
 * the picker gates per-variant.
 */
export function templateNeedsLink(template) {
  if (template?.source?.requiresLink !== true) return false;
  if (template.source.baseUuid) return false;
  return !(template.variants ?? []).some(v => v?.source?.baseUuid);
}

/**
 * Pure-logic. Is a specific variant spawnable link-wise? Non-requiresLink
 * templates are always fine (their uuids shipped verified).
 */
export function variantHasLink(template, variant) {
  if (template?.source?.requiresLink !== true) return true;
  return !!(variant?.source?.baseUuid ?? template?.source?.baseUuid);
}

/* ------------------------------------------------------------- Foundry-side */

export function getEffectiveTemplates() {
  const overrides = game.settings.get(MODULE_ID, "templateOverrides") ?? {};
  return builtinTemplates.map(t => mergeTemplateOverrides(t, overrides[t.id]));
}

export function getEffectiveTemplate(id) {
  const builtin = builtinTemplates.find(t => t.id === id);
  if (!builtin) return null;
  const overrides = game.settings.get(MODULE_ID, "templateOverrides") ?? {};
  return mergeTemplateOverrides(builtin, overrides[id]);
}
