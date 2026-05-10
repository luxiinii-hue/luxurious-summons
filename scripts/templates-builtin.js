// scripts/templates-builtin.js — built-in shipped template definitions
//
// Plan 1 ships only Simulacrum. Plan 3 adds the remaining 12 templates.

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg",
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
      borderColor: "#88ccff"
    },
    extraActions: [
      { id: "repair", label: "Repair", icon: "fa-solid fa-wrench", handler: "simulacrum.repair" }
    ],
    deathAnimation: "icyShatter"
  }
];
