// scripts/templates-builtin.js — built-in shipped template definitions
//
// Plan 3 introduced the unified `source` + `effects` shape. Legacy fields
// (`triggerSpell`, `defaults.motionProfile`, `defaults.motionIntensity`,
// `deathAnimation`) stay readable as fallbacks during the migration window —
// the spawn engine + visual-filters use `readEffects(template)` from data-model.

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Simulacrum" },
    triggerSpell: "Simulacrum",                 // legacy alias — kept readable during migration

    source: { mode: "clone" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    dnd5eMods: {
      halveMaxHp: true,
      blockNaturalRecovery: true,
      snapshotSpellSlots: true,
      repairAction: { cost: 100, healFormula: "4d6+24", timeRequired: "1 hour" }
    },

    effects: {
      motion: { profile: "flame-flicker", intensity: 0.6 },
      spawn:  "hexCrystalForm",                 // hextech family default
      death:  "icyShatter"                      // signature override
    },

    defaults: {
      hueColor: "#88ccff",
      hueIntensity: 0.15,
      alpha: 0.85,
      saturation: 1.0,
      brightness: 1.0,
      outlineColor: "#aaffff",
      outlineThickness: 3,
      shimmer: false,
      shimmerIntensity: 0,
      namePrefix: "Simulacrum of ",
      nameSuffix: "",
      borderColor: "#88ccff",
      motionProfile: "flame-flicker",           // legacy aliases — Restyle / Plan-2 motion ticker read these
      motionIntensity: 0.6
    },

    extraActions: [
      { id: "repair", label: "Repair", icon: "fa-solid fa-wrench", handler: "simulacrum.repair" }
    ],

    deathAnimation: "icyShatter"                // legacy alias
  }
];
