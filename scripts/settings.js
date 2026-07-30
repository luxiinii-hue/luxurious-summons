// scripts/settings.js — module settings registration
const MODULE_ID = "luxurious-summons";

export function registerSettings() {
  // ── World-scope (GM-only writes; world database) ─────────────────────
  game.settings.register(MODULE_ID, "requireApprovalForAllSpawns", {
    name: "Require GM approval for all spawns",
    hint: "When on, every spawn request goes through a GM-approval chat card (D-mode). When off (default), spawns auto-fire via the active GM client (C-mode).",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "globalActiveCapPerPlayer", {
    name: "Global active companion cap (per player)",
    hint: "Hard ceiling on how many companions a single player may have active at once, regardless of per-template caps.",
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 1, max: 50, step: 1 }
  });
  game.settings.register(MODULE_ID, "antispamMaxSpawnsPerWindow", {
    name: "Anti-spam: max spawns per window",
    hint: "Maximum spawn requests a single player may make within the anti-spam window (see below).",
    scope: "world",
    config: true,
    type: Number,
    default: 5,
    range: { min: 1, max: 30, step: 1 }
  });
  game.settings.register(MODULE_ID, "antispamWindowSeconds", {
    name: "Anti-spam: window length (seconds)",
    hint: "Length of the rolling anti-spam window.",
    scope: "world",
    config: true,
    type: Number,
    default: 60,
    range: { min: 10, max: 600, step: 10 }
  });
  game.settings.register(MODULE_ID, "autoDeductGoldForRepair", {
    name: "Auto-deduct gold for Simulacrum Repair",
    hint: "When on, the Repair action deducts 100gp from the master's character automatically. When off (default), Repair logs the cost without enforcing it.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  // v0.4.7 FIX 4: lets a GM point Mage Hand's token art (+ portrait) at a
  // custom static image or animated .webm, instead of the fallback square
  // spell icon. Foundry supports webm token textures natively — no special
  // handling needed on our end beyond passing the path through.
  game.settings.register(MODULE_ID, "mageHandTokenPath", {
    name: "LUXSUM.Settings.MageHandTokenPath.Name",
    hint: "LUXSUM.Settings.MageHandTokenPath.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: "imagevideo"
  });
  // v0.8.0: compendium stat blocks are HOSTILE by default (verified in dnd5e
  // release-5.2.1 — see token-normalize.js). Friendly is right for a companion;
  // exposed because automation-heavy tables sometimes want summons excluded
  // from "all allies" targeting.
  game.settings.register(MODULE_ID, "companionDisposition", {
    name: "LUXSUM.Settings.CompanionDisposition.Name",
    hint: "LUXSUM.Settings.CompanionDisposition.Hint",
    scope: "world",
    config: true,
    type: Number,
    choices: { 1: "Friendly (default)", 0: "Neutral", "-2": "Secret" },
    default: 1
  });

  // ── GM Console (v0.6.0) — world-scope, config:false: the console IS their UI.
  // World-setting onChange fires on EVERY connected client, so a single GM
  // change re-applies filters/motion on all clients instantly. Dynamic import
  // avoids a settings ⇄ visual-filters module cycle (visual-filters imports s()).
  const reapply = async () => {
    const { reapplyAllCompanionTokens } = await import("./visual-filters.js");
    reapplyAllCompanionTokens();
  };
  game.settings.register(MODULE_ID, "gmMotionEnabled", {
    scope: "world", config: false, type: Boolean, default: true, onChange: reapply
  });
  game.settings.register(MODULE_ID, "gmMotionIntensity", {
    scope: "world", config: false, type: Number, default: 1.0, onChange: reapply
  });
  game.settings.register(MODULE_ID, "gmForceDisableFilters", {
    scope: "world", config: false, type: Boolean, default: false, onChange: reapply
  });
  game.settings.register(MODULE_ID, "gmForceDisableSpawnDeathAnims", {
    scope: "world", config: false, type: Boolean, default: false
  });

  // v0.7.4: opt-in for the vendored outline shader. Default OFF — see the
  // long comment in visual-filters.js buildFilters(): this shader was the
  // invisible-summons cause, and a broken PIXI filter renders its mesh as
  // nothing rather than throwing. Turn it on only after confirming outlines
  // actually draw on your own canvas.
  game.settings.register(MODULE_ID, "enableVendoredOutline", {
    name: "LUXSUM.Settings.EnableVendoredOutline.Name",
    hint: "LUXSUM.Settings.EnableVendoredOutline.Hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: reapply
  });

  game.settings.register(MODULE_ID, "customTemplates", {
    scope: "world", config: false, type: Array, default: []
  });
  game.settings.register(MODULE_ID, "templateOverrides", {
    scope: "world", config: false, type: Object, default: {}, onChange: reapply
  });
  game.settings.register(MODULE_ID, "dataModelVersion", {
    scope: "world", config: false, type: String, default: "1"
  });

  // ── Client-scope (per-user; localStorage) ────────────────────────────
  game.settings.register(MODULE_ID, "aestheticTheme", {
    name: "Aesthetic theme",
    hint: "Visual theme for the Companion Manager UI.",
    scope: "client",
    config: true,
    type: String,
    choices: { luxurious: "Luxurious (default)", "luxurious-light": "Luxurious Light", "foundry-native": "Foundry Native" },
    default: "luxurious"
  });
  game.settings.register(MODULE_ID, "enableDeathAnimations", {
    name: "Enable death animations",
    hint: "Performance escape hatch — turn off if PIXI animations cause lag on your client.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "enablePIXIFilters", {
    name: "Token effects on this client",
    hint: "Performance escape hatch — when off, only basic token tinting is applied (no outline, shimmer, or idle motion). Affects what you see; other players are unchanged.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    // Without this, toggling from the Manager's Settings tab appears to do
    // nothing until the next token redraw.
    onChange: reapply
  });
  // v0.8.0 — the Companion Bar (quick-switch strip above the hotbar).
  game.settings.register(MODULE_ID, "showCompanionBar", {
    name: "LUXSUM.Settings.ShowCompanionBar.Name",
    hint: "LUXSUM.Settings.ShowCompanionBar.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: async () => {
      const { refreshCompanionBar } = await import("./companion-bar.js");
      refreshCompanionBar();
    }
  });
  // Collapse state is remembered per user — a player who folds the bar away
  // shouldn't have it pop back open every reload.
  game.settings.register(MODULE_ID, "companionBarCollapsed", {
    scope: "client", config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, "verboseLogging", {
    name: "Verbose logging",
    hint: "Diagnostic — emits [luxurious-summons] console logs at every dialog/hook/broker point. Useful when reporting issues.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

// Convenience getter — keeps the settings call site terse and one-place to grep
export function s(key) {
  return game.settings.get(MODULE_ID, key);
}
