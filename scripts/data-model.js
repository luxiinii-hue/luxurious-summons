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

export function makeCompanionFlag({ templateId, sourceActorId, sourcePlayerId, sourceMode, visualDefaults, motionDefaults }) {
  return {
    isCompanion: true,
    templateId,
    sourceActorId,
    sourcePlayerId,
    sourceMode,
    visualOverrides: { ...visualDefaults },
    motionOverrides: motionDefaults ? { ...motionDefaults } : { profile: "none", intensity: 0 },
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

/**
 * Pure-logic. Groups companion actors by sourcePlayerId, returning
 * Map<userId, Array<{actorId, sceneId, templateId, spawnedAt}>>.
 *
 * @param actors  array of actor-like objects with .id and .flags
 * @param sceneOf function(actor) → sceneId (or null)
 */
export function regenerateUserIndex(actors, sceneOf) {
  const index = new Map();
  for (const actor of actors) {
    const flag = actor?.flags?.[MODULE_ID];
    if (!flag?.isCompanion) continue;
    const entry = {
      actorId: actor.id,
      sceneId: sceneOf(actor),
      templateId: flag.templateId,
      spawnedAt: flag.spawnedAt
    };
    if (!index.has(flag.sourcePlayerId)) index.set(flag.sourcePlayerId, []);
    index.get(flag.sourcePlayerId).push(entry);
  }
  return index;
}

/**
 * Foundry-side wrapper. Walks live game state, builds the index via
 * regenerateUserIndex, and writes each user's slice to
 * user.flags[MODULE_ID].activeCompanions.
 *
 * Only the GM can write to other users' flags, so this no-ops on
 * non-GM clients. Idempotent — safe to call multiple times.
 */
export async function refreshUserIndexes() {
  if (!game.user.isGM) return;
  const sceneOf = (actor) => {
    for (const scene of game.scenes) {
      if (scene.tokens.find(t => t.actorId === actor.id)) return scene.id;
    }
    return null;
  };
  const index = regenerateUserIndex(game.actors.contents, sceneOf);
  for (const user of game.users) {
    const slice = index.get(user.id) ?? [];
    await user.update({ [`flags.${MODULE_ID}.activeCompanions`]: slice });
  }
  console.log(`[${MODULE_ID}] user-flag indexes refreshed for ${index.size} user(s)`);
}
