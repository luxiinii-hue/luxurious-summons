// scripts/spawn-engine.js — clone-based spawn, ownership, registration, folder creation
//
// This file builds out across Tasks 7, 9, 10, 21. The restriction-check is the
// pure kernel; the Foundry-side wrapper (with actual spawn execution) lands
// in Task 9.

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
