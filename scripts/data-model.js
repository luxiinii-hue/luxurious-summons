// scripts/data-model.js — companion record schema, validators, flag helpers
const MODULE_ID = "luxurious-summons";
const REQUIRED_FIELDS = ["templateId", "sourceActorId", "sourcePlayerId", "sourceMode", "visualOverrides", "spawnedAt"];
const VALID_SOURCE_MODES = new Set(["snapshot", "live-mirror"]);

export function validateCompanionRecord(record) {
  const errors = [];
  if (!record || typeof record !== "object") {
    return { ok: false, errors: ["record is not an object"] };
  }
  if (record.isCompanion !== true) {
    errors.push("isCompanion must be true");
  }
  for (const f of REQUIRED_FIELDS) {
    if (record[f] === undefined) errors.push(`missing required field: ${f}`);
  }
  if (record.sourceMode !== undefined && !VALID_SOURCE_MODES.has(record.sourceMode)) {
    errors.push(`sourceMode must be one of ${[...VALID_SOURCE_MODES].join(", ")}; got "${record.sourceMode}"`);
  }
  return { ok: errors.length === 0, errors };
}

export function makeCompanionFlag({ templateId, sourceActorId, sourcePlayerId, sourceMode, visualDefaults }) {
  return {
    isCompanion: true,
    templateId,
    sourceActorId,
    sourcePlayerId,
    sourceMode,
    visualOverrides: { ...visualDefaults },
    spawnedAt: Date.now(),
    notes: ""
  };
}

// Foundry-side helpers (untested by node:test; verified manually in Foundry)
export function isCompanion(actor) {
  return actor?.flags?.[MODULE_ID]?.isCompanion === true;
}

export function getCompanionFlag(actor) {
  return actor?.flags?.[MODULE_ID] ?? null;
}

export async function setCompanionFlag(actor, partial) {
  const current = getCompanionFlag(actor) ?? {};
  return actor.update({ [`flags.${MODULE_ID}`]: { ...current, ...partial } });
}
