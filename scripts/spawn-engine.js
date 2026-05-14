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
 *
 * Plan 3: routes through source-modes (clone / compendium / inline-synthesized /
 * compendium-scaled). Tags the new actor with `spawnState: "pending-spawn"` so
 * the drawToken hook plays the spawn animation once. Plumbs variantId +
 * castSlotLevel through the companion record.
 *
 * Payload:
 *   { templateId, variantId?, castSlotLevel?, sourceActorId, sourcePlayerId,
 *     placements, visualOverrides? }
 *   placements: array of {x, y, sceneId} (one per token to create)
 * Returns: { actorIds: [...] }
 */
export async function performSpawn(payload) {
  const {
    templateId, variantId = null, castSlotLevel = null,
    sourceActorId, sourcePlayerId,
    placements, visualOverrides
  } = payload;
  const sourceActor = game.actors.get(sourceActorId);
  if (!sourceActor) throw new Error(`source actor ${sourceActorId} not found`);

  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === templateId);
  if (!template) throw new Error(`template ${templateId} not found`);

  const variant = variantId ? (template.variants ?? []).find(v => v.id === variantId) : null;

  const masterName = sourceActor.name;
  const folder = await ensureMasterFolder(masterName);

  const {
    resolveCloneData,
    resolveCompendiumData,
    resolveCompendiumScaledData,
    resolveInlineData
  } = await import("./source-modes.js");
  const mode = template.source?.mode;

  const createdActorIds = [];
  for (const placement of placements) {
    // 1. Effective name — prefix/suffix from variant > template, with variant
    // name taking over when present (e.g., "Owl of Lyra" vs. "Simulacrum of Lyra")
    const prefix = visualOverrides?.namePrefix ?? variant?.defaults?.namePrefix ?? template.defaults?.namePrefix ?? "";
    const suffix = visualOverrides?.nameSuffix ?? variant?.defaults?.nameSuffix ?? template.defaults?.nameSuffix ?? "";
    const synthName = variant
      ? `${variant.name} of ${masterName}`
      : `${prefix}${masterName}${suffix}`;

    // 2. Resolve actor data per source mode
    let actorData;
    if (mode === "clone") {
      actorData = resolveCloneData(sourceActor, { prefix, suffix, folderId: folder.id });
    } else if (mode === "compendium") {
      actorData = await resolveCompendiumData(template, variant, { name: synthName, folderId: folder.id });
    } else if (mode === "compendium-scaled") {
      actorData = await resolveCompendiumScaledData(template, variant, { name: synthName, folderId: folder.id, castSlotLevel });
    } else if (mode === "inline-synthesized") {
      actorData = resolveInlineData(template, { name: synthName, folderId: folder.id });
    } else {
      throw new Error(`unknown source.mode "${mode}" on template "${template.id}"`);
    }

    // 3. Effective visual defaults (template + variant + per-spawn overrides)
    const variantDefaults = variant?.defaults ?? {};
    const effectiveDefaults = { ...template.defaults, ...variantDefaults, ...(visualOverrides ?? {}) };
    const motionDefaults = (effectiveDefaults.motionProfile && effectiveDefaults.motionIntensity !== undefined)
      ? { profile: effectiveDefaults.motionProfile, intensity: effectiveDefaults.motionIntensity }
      : null;

    // 4. Companion-record flag (variantId + castSlotLevel + spawnState are Plan 3 additions)
    const companionFlag = makeCompanionFlag({
      templateId,
      sourceActorId,
      sourcePlayerId,
      sourceMode: template.syncMode ?? "snapshot",
      visualDefaults: effectiveDefaults,
      motionDefaults
    });
    companionFlag.variantId = variantId;
    companionFlag.castSlotLevel = castSlotLevel;
    companionFlag.spawnState = "pending-spawn";   // drives spawn animation playback

    actorData.flags = { ...(actorData.flags ?? {}), [MODULE_ID]: companionFlag };

    // 5. Ownership transfer — requester gets OWNER (3), default permission NONE (0)
    actorData.ownership = { default: 0, [sourcePlayerId]: 3 };

    // 6. Create the actor
    const newActor = await Actor.create(actorData);
    createdActorIds.push(newActor.id);

    // 7. dnd5e mods (Simulacrum half-HP, snapshot spell slots, block recovery)
    if (template.dnd5eMods) {
      const { applyDnd5eMods } = await import("./dnd5e-mods.js");
      await applyDnd5eMods(newActor, sourceActor, template);
    }

    // 8. Per-template post-spawn hooks
    if (templateId === "simulacrum") {
      const { onAfterSpawn } = await import("./handlers/simulacrum.js");
      await onAfterSpawn(newActor, sourceActor);
    } else if (templateId === "echo-knight-echo") {
      // Mirror caster's AC into the echo per RAW (Echo Knight's echo shares AC).
      const casterAc = sourceActor.system?.attributes?.ac?.value ?? 14;
      await newActor.update({ "system.attributes.ac.flat": casterAc });
    }

    // 9. Place token at the requested grid cell, tagged for orphan-cleanup
    const scene = game.scenes.get(placement.sceneId) ?? game.scenes.current;
    const tokenData = (await newActor.getTokenDocument({ x: placement.x, y: placement.y })).toObject();
    tokenData.flags = { ...(tokenData.flags ?? {}), [MODULE_ID]: { isCompanionToken: true, sourcePlayerId } };
    await scene.createEmbeddedDocuments("Token", [tokenData]);
  }

  // Refresh the per-user index so the requester's manager sees the new companions
  const { refreshUserIndexes } = await import("./data-model.js");
  await refreshUserIndexes();

  console.log(`[${MODULE_ID}] performSpawn: created ${createdActorIds.length} companion(s) for template ${templateId}${variantId ? ` (variant ${variantId})` : ""}${castSlotLevel ? ` at slot level ${castSlotLevel}` : ""}`);
  return { actorIds: createdActorIds };
}

export function installSpawnBrokerHandler() {
  registerBrokerHandler("spawn", performSpawn);
}
