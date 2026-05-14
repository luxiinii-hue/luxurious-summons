// scripts/spawn-engine.js — clone-based spawn, ownership, registration, folder creation
//
// checkRestrictions is the pure kernel (Task 7, unit-tested).
// performSpawn is the Foundry-side privileged executor that runs only on the
// primary-GM client (registered as broker handler "spawn" in Task 9).
// ensureMasterFolder auto-creates the actor-directory folder per master
// (Task 10).

import { makeCompanionFlag } from "./data-model.js";
import { registerBrokerHandler } from "./chat-broker.js";

const MODULE_ID = "luxurious-summons";

// ── Pure-logic restriction kernel (Task 7) ────────────────────────────

export function checkRestrictions({ template, activeCompanions, recentSpawnTimestamps, now, config }) {
  // Per-template maxActive
  const sameTemplateCount = activeCompanions.filter(c => c.templateId === template.id).length;
  if (sameTemplateCount >= template.maxActive) {
    return { allowed: false, reason: "template-cap",
             message: `You already have ${sameTemplateCount} active ${template.id} (max ${template.maxActive}). Dismiss one first.` };
  }
  // Per-player global cap
  if (activeCompanions.length >= config.globalCap) {
    return { allowed: false, reason: "global-cap",
             message: `You've reached the global cap of ${config.globalCap} active companions.` };
  }
  // Anti-spam rolling window
  const windowMs = config.antispamWindowSeconds * 1000;
  const recentInWindow = recentSpawnTimestamps.filter(t => now - t <= windowMs).length;
  if (recentInWindow >= config.antispamMax) {
    return { allowed: false, reason: "antispam",
             message: `Too many spawns recently (${recentInWindow} in the last ${config.antispamWindowSeconds}s). Slow down.` };
  }
  return { allowed: true };
}

// ── Per-master folder (Task 10) ──────────────────────────────────────

/**
 * Returns the existing or newly-created Actor folder for a master's companions.
 * Folder name is "{masterName}'s Companions". Tagged with module flag so we
 * can find it later even if the user renames it.
 */
export async function ensureMasterFolder(masterName) {
  const folderName = `${masterName}'s Companions`;
  let folder = game.folders.find(f =>
    f.type === "Actor" && f.name === folderName && f.flags?.[MODULE_ID]?.masterFolder === true
  );
  if (!folder) {
    folder = await Folder.create({
      name: folderName,
      type: "Actor",
      sorting: "a",
      flags: { [MODULE_ID]: { masterFolder: true, masterName } }
    });
    console.log(`[${MODULE_ID}] created folder "${folderName}" (id=${folder.id})`);
  }
  return folder;
}

// ── Spawn execution (Task 9) ─────────────────────────────────────────

/**
 * Performs the actual spawn — runs on the primary-GM client only.
 * Payload: { templateId, sourceActorId, sourcePlayerId, placements, visualOverrides? }
 *   placements: array of {x, y, sceneId} (one per token to create)
 * Returns: { actorIds: [...] }
 */
export async function performSpawn(payload) {
  const { templateId, sourceActorId, sourcePlayerId, placements, visualOverrides } = payload;
  const sourceActor = game.actors.get(sourceActorId);
  if (!sourceActor) throw new Error(`source actor ${sourceActorId} not found`);

  // Templates are loaded lazily — this file is imported eagerly at module load,
  // before templates-builtin.js may be present in the import graph.
  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === templateId);
  if (!template) throw new Error(`template ${templateId} not found`);

  const masterName = sourceActor.name;
  const folder = await ensureMasterFolder(masterName);

  const createdActorIds = [];
  for (const placement of placements) {
    // 1. Clone the source actor's data, strip its id so Foundry mints a new one
    const sourceData = sourceActor.toObject();
    delete sourceData._id;
    sourceData.folder = folder.id;
    const prefix = visualOverrides?.namePrefix ?? template.defaults?.namePrefix ?? "";
    const suffix = visualOverrides?.nameSuffix ?? template.defaults?.nameSuffix ?? "";
    sourceData.name = `${prefix}${masterName}${suffix}`;
    const motionDefaults = (template.defaults?.motionProfile && template.defaults?.motionIntensity !== undefined)
      ? { profile: template.defaults.motionProfile, intensity: template.defaults.motionIntensity }
      : null;
    sourceData.flags = { ...sourceData.flags,
      [MODULE_ID]: makeCompanionFlag({
        templateId,
        sourceActorId,
        sourcePlayerId,
        sourceMode: template.syncMode,
        visualDefaults: { ...template.defaults, ...(visualOverrides ?? {}) },
        motionDefaults
      })
    };
    // 2. Ownership transfer — requester gets OWNER (3), default permission is NONE (0)
    sourceData.ownership = { default: 0, [sourcePlayerId]: 3 };
    // 3. Create the actor
    const newActor = await Actor.create(sourceData);
    createdActorIds.push(newActor.id);

    // 4. dnd5e mods (HP halve, snapshot spell slots, block recovery) — Task 17
    const { applyDnd5eMods } = await import("./dnd5e-mods.js");
    await applyDnd5eMods(newActor, sourceActor, template);

    // 5. Per-template post-spawn hook (e.g., simulacrum spell-slot snapshot — Task 25)
    if (templateId === "simulacrum") {
      const { onAfterSpawn } = await import("./handlers/simulacrum.js");
      await onAfterSpawn(newActor, sourceActor);
    }

    // 6. Place token at the requested grid cell
    const scene = game.scenes.get(placement.sceneId) ?? game.scenes.current;
    const tokenData = (await newActor.getTokenDocument({ x: placement.x, y: placement.y })).toObject();
    // Tag the token so we can identify orphaned summon tokens later (cleanup pass at ready).
    // Pre-v0.3.3 tokens lack this flag — they have to be cleaned up manually one time.
    tokenData.flags = { ...(tokenData.flags ?? {}), [MODULE_ID]: { isCompanionToken: true, sourcePlayerId } };
    await scene.createEmbeddedDocuments("Token", [tokenData]);
  }

  // Refresh the per-user index so the requester's manager sees the new companions
  const { refreshUserIndexes } = await import("./data-model.js");
  await refreshUserIndexes();

  console.log(`[${MODULE_ID}] performSpawn: created ${createdActorIds.length} companion(s) for template ${templateId}`);
  return { actorIds: createdActorIds };
}

export function installSpawnBrokerHandler() {
  registerBrokerHandler("spawn", performSpawn);
}
