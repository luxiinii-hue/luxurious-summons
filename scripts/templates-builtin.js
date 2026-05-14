// scripts/templates-builtin.js — built-in shipped template definitions
//
// Plan 3 introduced the unified `source` + `effects` shape. Legacy fields
// (`triggerSpell`, `defaults.motionProfile`, `defaults.motionIntensity`,
// `deathAnimation`) stay readable as fallbacks during the migration window —
// the spawn engine + visual-filters use `readEffects(template)` from data-model.
//
// Compendium UUIDs marked `*-uuid-tbd` MUST be replaced with real dnd5e 5.2.1
// compendium UUIDs before live testing. Inline-synthesized templates
// (Mage Hand / Unseen Servant / Echo Knight Echo) work without UUIDs.

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Simulacrum" },
    triggerSpell: "Simulacrum",

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
      spawn:  "hexCrystalForm",
      death:  "icyShatter"
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
      motionProfile: "flame-flicker",
      motionIntensity: 0.6
    },

    extraActions: [
      { id: "repair", label: "Repair", icon: "fa-solid fa-wrench", handler: "simulacrum.repair" }
    ],

    deathAnimation: "icyShatter"
  },

  // ============================================================
  // Plan 3 templates (tasks 16-22)
  // ============================================================

  {
    id: "find-familiar",
    name: "Find Familiar",
    description: "Bind a tiny spirit-creature as your familiar.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/find-familiar.png",
    aestheticFamily: "belle-epoque",

    trigger: { type: "spell", name: "Find Familiar" },
    triggerSpell: "Find Familiar",

    source: { mode: "compendium" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "idle-breathing", intensity: 1.0 },
      spawn:  "belleBloom",
      death:  "belleFade"
    },

    defaults: {
      hueColor: "#c9a14b",
      hueIntensity: 0.0,
      alpha: 1.0,
      saturation: 1.0,
      brightness: 1.0,
      outlineColor: "#c9a14b",
      outlineThickness: 0,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#c9a14b",
      motionProfile: "idle-breathing",
      motionIntensity: 1.0
    },

    variants: [
      { id: "bat",      name: "Bat",            thumbnail: "modules/luxurious-summons/assets/variants/bat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.bat-uuid-tbd" } },
      { id: "cat",      name: "Cat",            thumbnail: "modules/luxurious-summons/assets/variants/cat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.cat-uuid-tbd" } },
      { id: "crab",     name: "Crab",           thumbnail: "modules/luxurious-summons/assets/variants/crab.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.crab-uuid-tbd" } },
      { id: "frog",     name: "Frog",           thumbnail: "modules/luxurious-summons/assets/variants/frog.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.frog-uuid-tbd" } },
      { id: "hawk",     name: "Hawk",           thumbnail: "modules/luxurious-summons/assets/variants/hawk.png",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.hawk-uuid-tbd" } },
      { id: "lizard",   name: "Lizard",         thumbnail: "modules/luxurious-summons/assets/variants/lizard.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.lizard-uuid-tbd" } },
      { id: "octopus",  name: "Octopus",        thumbnail: "modules/luxurious-summons/assets/variants/octopus.png",  source: { baseUuid: "Compendium.dnd5e.monsters.Actor.octopus-uuid-tbd" } },
      { id: "owl",      name: "Owl",            thumbnail: "modules/luxurious-summons/assets/variants/owl.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.owl-uuid-tbd" } },
      { id: "snake",    name: "Poisonous Snake",thumbnail: "modules/luxurious-summons/assets/variants/snake.png",    source: { baseUuid: "Compendium.dnd5e.monsters.Actor.snake-uuid-tbd" } },
      { id: "quipper",  name: "Quipper",        thumbnail: "modules/luxurious-summons/assets/variants/quipper.png",  source: { baseUuid: "Compendium.dnd5e.monsters.Actor.quipper-uuid-tbd" } },
      { id: "rat",      name: "Rat",            thumbnail: "modules/luxurious-summons/assets/variants/rat.png",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.rat-uuid-tbd" } },
      { id: "raven",    name: "Raven",          thumbnail: "modules/luxurious-summons/assets/variants/raven.png",    source: { baseUuid: "Compendium.dnd5e.monsters.Actor.raven-uuid-tbd" } },
      { id: "seahorse", name: "Sea Horse",      thumbnail: "modules/luxurious-summons/assets/variants/seahorse.png", source: { baseUuid: "Compendium.dnd5e.monsters.Actor.seahorse-uuid-tbd" } },
      { id: "spider",   name: "Spider",         thumbnail: "modules/luxurious-summons/assets/variants/spider.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.spider-uuid-tbd" } },
      { id: "weasel",   name: "Weasel",         thumbnail: "modules/luxurious-summons/assets/variants/weasel.png",   source: { baseUuid: "Compendium.dnd5e.monsters.Actor.weasel-uuid-tbd" } }
    ],

    deathAnimation: "belleFade"
  },

  {
    id: "pact-of-the-chain",
    name: "Pact of the Chain",
    description: "Warlocks with the Pact of the Chain boon bind a fey or fiendish familiar.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/pact-of-the-chain.png",
    aestheticFamily: "belle-epoque",

    trigger: { type: "spell", name: "Find Familiar" },  // shares Find Familiar's trigger spell
    triggerSpell: "Find Familiar",

    source: { mode: "compendium" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "idle-breathing", intensity: 1.0 },
      spawn:  "belleBloom",
      death:  "belleFade"
    },

    defaults: {
      hueColor: "#7a1c1c",
      hueIntensity: 0.15,
      alpha: 1.0,
      saturation: 1.0,
      brightness: 1.0,
      outlineColor: "#7a1c1c",
      outlineThickness: 0,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#7a1c1c",
      motionProfile: "idle-breathing",
      motionIntensity: 1.0
    },

    variants: [
      { id: "imp",          name: "Imp",          thumbnail: "modules/luxurious-summons/assets/variants/imp.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.imp-uuid-tbd" },
        requires: { class: "warlock", subclass: "pact-of-the-chain" },
        spawnEffectOverride: "infernalBloom",
        deathEffectOverride: "infernalFade" },
      { id: "pseudodragon", name: "Pseudodragon", thumbnail: "modules/luxurious-summons/assets/variants/pseudodragon.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.pseudodragon-uuid-tbd" },
        requires: { class: "warlock", subclass: "pact-of-the-chain" } },
      { id: "quasit",       name: "Quasit",       thumbnail: "modules/luxurious-summons/assets/variants/quasit.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.quasit-uuid-tbd" },
        requires: { class: "warlock", subclass: "pact-of-the-chain" },
        spawnEffectOverride: "infernalBloom",
        deathEffectOverride: "infernalFade" },
      { id: "sprite",       name: "Sprite",       thumbnail: "modules/luxurious-summons/assets/variants/sprite.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.sprite-uuid-tbd" },
        requires: { class: "warlock", subclass: "pact-of-the-chain" } }
    ],

    deathAnimation: "belleFade"
  },

  {
    id: "animate-dead",
    name: "Animate Dead",
    description: "Raise corpses as undead servants. Up to 4 at a time; requires re-bind every 24 hours.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/animate-dead.png",
    aestheticFamily: "belle-epoque",

    trigger: { type: "spell", name: "Animate Dead" },
    triggerSpell: "Animate Dead",

    source: { mode: "compendium" },
    syncMode: "snapshot",
    maxActive: 4,
    requiresApproval: false,

    effects: {
      motion: { profile: "idle-breathing", intensity: 0.7 },
      spawn:  "boneRise",
      death:  "boneCollapse"
    },

    defaults: {
      hueColor: "#e8dcc4",
      hueIntensity: 0.10,
      alpha: 1.0,
      saturation: 0.6,
      brightness: 0.9,
      outlineColor: "#7a3a3a",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#7a3a3a",
      motionProfile: "idle-breathing",
      motionIntensity: 0.7
    },

    variants: [
      { id: "skeleton", name: "Skeleton", thumbnail: "modules/luxurious-summons/assets/variants/skeleton.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.skeleton-uuid-tbd" } },
      { id: "zombie",   name: "Zombie",   thumbnail: "modules/luxurious-summons/assets/variants/zombie.png",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.zombie-uuid-tbd" } }
    ],

    deathAnimation: "boneCollapse"
  },

  {
    id: "mage-hand",
    name: "Mage Hand",
    description: "A spectral, floating hand. Carries up to 10 lb; no attacks.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/mage-hand.png",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Mage Hand" },
    triggerSpell: "Mage Hand",

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/mage-hand.png",
        system: {
          abilities: { str: { value: 1 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 1 } },
          attributes: {
            ac:    { flat: 10 },
            hp:    { value: 1, max: 1 },
            movement: { walk: 0, fly: 30, hover: true }
          },
          details: { type: { value: "construct" }, cr: 0 }
        },
        prototypeToken: {
          name: "Mage Hand",
          actorLink: false,
          sight: { enabled: false }
        }
      }
    },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "floating-hand", intensity: 1.0 },
      spawn:  "mageHandSparks",
      death:  "mageHandDissolve"
    },

    defaults: {
      hueColor: "#c9a14b",
      hueIntensity: 0.30,
      alpha: 0.85,
      saturation: 1.0,
      brightness: 1.2,
      outlineColor: "#5cd3e8",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#5cd3e8",
      motionProfile: "floating-hand",
      motionIntensity: 1.0
    },

    deathAnimation: "mageHandDissolve"
  },

  {
    id: "unseen-servant",
    name: "Unseen Servant",
    description: "An invisible, mindless servant performs simple manual tasks within 60 ft.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/unseen-servant.png",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Unseen Servant" },
    triggerSpell: "Unseen Servant",

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/unseen-servant.png",
        system: {
          abilities: { str: { value: 2 }, dex: { value: 6 }, con: { value: 10 }, int: { value: 1 }, wis: { value: 1 }, cha: { value: 1 } },
          attributes: {
            ac:    { flat: 10 },
            hp:    { value: 2, max: 2 },
            movement: { walk: 15 }
          },
          details: { type: { value: "construct" }, cr: 0 }
        },
        prototypeToken: { name: "Unseen Servant", actorLink: false, sight: { enabled: false } }
      }
    },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "ethereal-drift", intensity: 0.4 },
      spawn:  "hexCrystalForm",
      death:  "hexShatter"
    },

    defaults: {
      hueColor: "#c8e8f0",
      hueIntensity: 0.15,
      alpha: 0.15,
      saturation: 0.5,
      brightness: 1.2,
      outlineColor: "#5cd3e8",
      outlineThickness: 1,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#5cd3e8",
      motionProfile: "ethereal-drift",
      motionIntensity: 0.4
    },

    deathAnimation: "hexShatter"
  },

  {
    id: "echo-knight-echo",
    name: "Echo Knight Echo",
    description: "A translucent armored echo of yourself. Mirrors your AC; 1 HP; can be swapped with via class action.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/echo-knight-echo.png",
    aestheticFamily: "hextech",

    trigger: { type: "feature", name: "Manifest Echo" },

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/echo-knight-echo.png",
        system: {
          abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
          attributes: {
            ac:    { flat: 14 },   // overridden at spawn from caster's AC
            hp:    { value: 1, max: 1 },
            movement: { walk: 30 }
          },
          details: { type: { value: "construct" }, cr: 0 }
        },
        prototypeToken: { name: "Echo", actorLink: false, sight: { enabled: false } }
      }
    },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "mirror-wobble", intensity: 0.4 },
      spawn:  "echoStep",
      death:  "echoCollapse"
    },

    defaults: {
      hueColor: "#7ea9ff",
      hueIntensity: 0.30,
      alpha: 0.75,
      saturation: 0.7,
      brightness: 1.1,
      outlineColor: "#7ea9ff",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#7ea9ff",
      motionProfile: "mirror-wobble",
      motionIntensity: 0.4
    },

    extraActions: [],
    deathAnimation: "echoCollapse"
  },

  {
    id: "summon-dragon",
    name: "Summon Dragon",
    description: "Summon a draconic spirit. Pick a damage type and the spell-slot level.",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/summon-dragon.png",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Summon Draconic Spirit" },
    triggerSpell: "Summon Draconic Spirit",

    source: {
      mode: "compendium-scaled",
      baseUuid: "Compendium.dnd5e.monsters.Actor.draconic-spirit-uuid-tbd",
      scalingTable: [
        { slotLevel: 5, hpAdd: 0,  damageAdd: 0, attackBonus: 0 },
        { slotLevel: 6, hpAdd: 10, damageAdd: 1, attackBonus: 1 },
        { slotLevel: 7, hpAdd: 20, damageAdd: 2, attackBonus: 1 },
        { slotLevel: 8, hpAdd: 30, damageAdd: 3, attackBonus: 2 }
      ]
    },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "ethereal-drift", intensity: 1.0 },
      spawn:  "hexCrystalForm",
      death:  "hexShatter"
    },

    defaults: {
      hueColor: "#5cd3e8",
      hueIntensity: 0.20,
      alpha: 0.85,
      saturation: 1.0,
      brightness: 1.0,
      outlineColor: "#5cd3e8",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#5cd3e8",
      motionProfile: "ethereal-drift",
      motionIntensity: 1.0
    },

    variants: [
      { id: "acid",      name: "Acid",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-acid.png",
        defaults: { hueColor: "#9aff66", outlineColor: "#9aff66" } },
      { id: "cold",      name: "Cold",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-cold.png",
        defaults: { hueColor: "#c8e8f0", outlineColor: "#c8e8f0" } },
      { id: "fire",      name: "Fire",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-fire.png",
        defaults: { hueColor: "#ff7733", outlineColor: "#ff7733" } },
      { id: "lightning", name: "Lightning", thumbnail: "modules/luxurious-summons/assets/variants/dragon-lightning.png",
        defaults: { hueColor: "#ffee66", outlineColor: "#ffee66" } },
      { id: "poison",    name: "Poison",    thumbnail: "modules/luxurious-summons/assets/variants/dragon-poison.png",
        defaults: { hueColor: "#88dd88", outlineColor: "#88dd88" } }
    ],

    deathAnimation: "hexShatter"
  }
];
