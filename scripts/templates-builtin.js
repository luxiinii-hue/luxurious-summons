// scripts/templates-builtin.js — built-in shipped template definitions
//
// Plan 1 ships only Simulacrum. Plan 3 adds the remaining 12 templates.

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg",
    triggerSpell: "Simulacrum",     // matches dnd5e item name → auto-open spawn dialog (v3 useItem / v4 useActivity / v5 postUseActivity)
    aestheticFamily: "hextech",     // cool/arcane palette per Plan 2 design doc §2.4
    source: {
      mode: "clone"
    },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,
    dnd5eMods: {
      halveMaxHp: true,
      blockNaturalRecovery: true,
      snapshotSpellSlots: true,
      repairAction: { cost: 100, healFormula: "4d6+24", timeRequired: "1 hour" }
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
      // Motion defaults — subtle icy-crackle shimmer. Player can disable via Restyle when that ships.
      motionProfile: "flame-flicker",
      motionIntensity: 0.6
    },
    extraActions: [
      { id: "repair", label: "Repair", icon: "fa-solid fa-wrench", handler: "simulacrum.repair" }
    ],
    deathAnimation: "icyShatter"
  }
];
