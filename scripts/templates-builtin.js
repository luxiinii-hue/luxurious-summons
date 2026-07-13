// scripts/templates-builtin.js — built-in shipped template definitions
//
// Plan 3 introduced the unified `source` + `effects` shape. Legacy fields
// (`triggerSpell`, `defaults.motionProfile`, `defaults.motionIntensity`,
// `deathAnimation`) stay readable as fallbacks during the migration window —
// the spawn engine + visual-filters use `readEffects(template)` from data-model.
//
// Compendium UUIDs verified against dnd5e 5.2.1 `dnd5e.monsters` pack via
// v0.4.5's `find-and-replace` pass. The Draconic Spirit lives in the 2024-SRD
// `dnd5e.actors24` pack (`packs/_source/actors24/summons/draconic-spirit.yml`,
// `_id: phbmobDraconicSp`) — verified against the release-5.2.1 tag of the
// foundryvtt/dnd5e repo. The matching 2024 spell is named "Summon Dragon"
// (`spells24`, phbsplSummonDrag); the Tasha's original is "Summon Draconic
// Spirit" (reachable via DDB-Importer), so the trigger carries both names.
// Inline-synthesized templates (Mage Hand / Unseen Servant / Echo Knight Echo)
// work without UUIDs.

export const templates = [
  {
    id: "simulacrum",
    name: "Simulacrum",
    description: "Illusory duplicate of the master. Half max HP, no spell-slot recovery on rest, no natural HP regain (Repair-only).",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/simulacrum.webp",
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
    thumbnail: "icons/creatures/birds/corvid-flying-wings-purple.webp",
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

    // v0.4.6 FIX 6: thumbnails point at dnd5e system token art (verified against
    // the release-5.2.1 json/fa-token-mapping.json — these files ship with
    // dnd5e 5.2.1, so they exist on the friend's install) instead of
    // modules/luxurious-summons/assets/variants/*.png, which was never
    // generated and 404'd on every gallery render.
    variants: [
      { id: "bat",      name: "Bat",            thumbnail: "systems/dnd5e/tokens/beast/Bat.webp",            source: { baseUuid: "Compendium.dnd5e.monsters.Actor.qav2dvMIUiMQCCsy" } },
      { id: "cat",      name: "Cat",            thumbnail: "systems/dnd5e/tokens/beast/CatOrange.webp",      source: { baseUuid: "Compendium.dnd5e.monsters.Actor.hIf83RD3ZVW4Egfi" } },
      { id: "crab",     name: "Crab",           thumbnail: "systems/dnd5e/tokens/beast/CrabOrange.webp",     source: { baseUuid: "Compendium.dnd5e.monsters.Actor.8RgUhb31VvjUNZU1" } },
      { id: "frog",     name: "Frog",           thumbnail: "systems/dnd5e/tokens/beast/Frog.webp",           source: { baseUuid: "Compendium.dnd5e.monsters.Actor.EZgiprHXA2D7Uyb3" } },
      { id: "hawk",     name: "Hawk",           thumbnail: "systems/dnd5e/tokens/beast/Hawk.webp",           source: { baseUuid: "Compendium.dnd5e.monsters.Actor.fnkPNfIpS62LqOu4" } },
      { id: "lizard",   name: "Lizard",         thumbnail: "systems/dnd5e/tokens/beast/Lizard.webp",         source: { baseUuid: "Compendium.dnd5e.monsters.Actor.I2x01hzOjVN4NUjf" } },
      { id: "octopus",  name: "Octopus",        thumbnail: "systems/dnd5e/tokens/beast/Octopus.webp",        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.3UUNbGiG2Yf1ZPxM" } },
      { id: "owl",      name: "Owl",            thumbnail: "systems/dnd5e/tokens/beast/Owl.webp",            source: { baseUuid: "Compendium.dnd5e.monsters.Actor.d0prpsGSAorDadec" } },
      { id: "snake",    name: "Poisonous Snake",thumbnail: "systems/dnd5e/tokens/beast/PoisonousSnake.webp", source: { baseUuid: "Compendium.dnd5e.monsters.Actor.D5rwVIxmfFrdyyxT" } },
      { id: "quipper",  name: "Quipper",        thumbnail: "systems/dnd5e/tokens/beast/Quipper.webp",        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.nkyCGJ9wXeAZkyyz" } },
      { id: "rat",      name: "Rat",            thumbnail: "systems/dnd5e/tokens/beast/Rat.webp",            source: { baseUuid: "Compendium.dnd5e.monsters.Actor.pozQUPTnLZW8epox" } },
      { id: "raven",    name: "Raven",          thumbnail: "systems/dnd5e/tokens/beast/Raven.webp",          source: { baseUuid: "Compendium.dnd5e.monsters.Actor.LPdX5YLlwci0NDZx" } },
      { id: "seahorse", name: "Sea Horse",      thumbnail: "systems/dnd5e/tokens/beast/SeaHorse.webp",       source: { baseUuid: "Compendium.dnd5e.monsters.Actor.FWSDiq9SZsdiBAa8" } },
      { id: "spider",   name: "Spider",         thumbnail: "systems/dnd5e/tokens/beast/Spider.webp",         source: { baseUuid: "Compendium.dnd5e.monsters.Actor.28gU50HtG8Kp7uIz" } },
      { id: "weasel",   name: "Weasel",         thumbnail: "systems/dnd5e/tokens/beast/Weasel.webp",         source: { baseUuid: "Compendium.dnd5e.monsters.Actor.WOdeacKCYVhgLDuN" } }
    ],

    deathAnimation: "belleFade"
  },

  {
    id: "pact-of-the-chain",
    name: "Pact of the Chain",
    description: "Warlocks with the Pact of the Chain boon bind a fey or fiendish familiar.",
    thumbnail: "icons/creatures/birds/corvid-flying-wings-purple.webp",
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
      // v0.4.6 FIX 2: Pact of the Chain is a warlock pact-boon FEATURE (an owned
      // Item of type "feat"), not a subclass — dnd5e subclass identifiers look
      // like "the-fiend"/"the-archfey". requires.feature matches the caster's
      // owned feat-item names (case-insensitive).
      { id: "imp",          name: "Imp",          thumbnail: "systems/dnd5e/tokens/fiend/Imp.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.dLQiESMsfsXijD5c" },
        requires: { class: "warlock", feature: "Pact of the Chain" },
        spawnEffectOverride: "infernalBloom",
        deathEffectOverride: "infernalFade" },
      { id: "pseudodragon", name: "Pseudodragon", thumbnail: "systems/dnd5e/tokens/dragon/Pseudodragon.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.fkCNtbvPOMd7mipF" },
        requires: { class: "warlock", feature: "Pact of the Chain" } },
      { id: "quasit",       name: "Quasit",       thumbnail: "systems/dnd5e/tokens/fiend/Quasit.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.bwtkdzavdNHISgp4" },
        requires: { class: "warlock", feature: "Pact of the Chain" },
        spawnEffectOverride: "infernalBloom",
        deathEffectOverride: "infernalFade" },
      { id: "sprite",       name: "Sprite",       thumbnail: "systems/dnd5e/tokens/fey/Sprite.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.MUpBNDoJEr09bLaO" },
        requires: { class: "warlock", feature: "Pact of the Chain" } }
    ],

    deathAnimation: "belleFade"
  },

  {
    id: "animate-dead",
    name: "Animate Dead",
    description: "Raise corpses as undead servants. Up to 4 at a time; requires re-bind every 24 hours.",
    thumbnail: "icons/magic/control/fear-fright-monster-red.webp",
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
      { id: "skeleton", name: "Skeleton", thumbnail: "systems/dnd5e/tokens/undead/Skeleton.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.nU8GN8La8DCt8SDb" } },
      { id: "zombie",   name: "Zombie",   thumbnail: "systems/dnd5e/tokens/undead/Zombie.webp",
        source: { baseUuid: "Compendium.dnd5e.monsters.Actor.NAISFPoNNgUCsEyW" } }
    ],

    deathAnimation: "boneCollapse"
  },

  {
    id: "mage-hand",
    name: "Mage Hand",
    description: "A spectral, floating hand. Carries up to 10 lb; no attacks.",
    thumbnail: "modules/luxurious-summons/assets/tokens/mage-hand.webp",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Mage Hand" },
    triggerSpell: "Mage Hand",

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/mage-hand.webp",
        system: {
          abilities: { str: { value: 1 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 1 } },
          attributes: {
            ac:    { flat: 10, calc: "flat" },
            hp:    { value: 1, max: 1 },
            movement: { walk: 0, fly: 30, hover: true }
          },
          details: { type: { value: "construct" }, cr: 0 }
        },
        prototypeToken: {
          name: "Mage Hand",
          actorLink: false,
          sight: { enabled: false },
          // v0.4.7 FIX 4: the fallback token art is a square spell ICON, not an
          // isolated-subject token — scaling it down keeps it from wall-to-wall
          // filling the grid cell even before any custom art is configured via
          // the mageHandTokenPath world setting.
          texture: { scaleX: 0.8, scaleY: 0.8 }
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

    // v0.4.7 FIX 4: brightness 1.2 -> 1.0 and hueIntensity 0.30 -> 0.10. The old
    // defaults were tuned assuming a smaller isolated-subject sprite; against the
    // actual fallback (a square spell icon filling the whole cell) they produced
    // a washed-out pale square. alpha stays 0.85 and the cyan outline is kept —
    // the outline renders once the FIX 3 vendored fallback shader lands.
    defaults: {
      hueColor: "#c9a14b",
      hueIntensity: 0.10,
      alpha: 0.85,
      saturation: 1.0,
      brightness: 1.0,
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
    thumbnail: "modules/luxurious-summons/assets/tokens/unseen-servant.webp",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Unseen Servant" },
    triggerSpell: "Unseen Servant",

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/unseen-servant.webp",
        system: {
          abilities: { str: { value: 2 }, dex: { value: 6 }, con: { value: 10 }, int: { value: 1 }, wis: { value: 1 }, cha: { value: 1 } },
          attributes: {
            ac:    { flat: 10, calc: "flat" },
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
    thumbnail: "modules/luxurious-summons/assets/tokens/echo-knight-echo.webp",
    aestheticFamily: "hextech",

    trigger: { type: "feature", name: "Manifest Echo" },

    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img:  "modules/luxurious-summons/assets/tokens/echo-knight-echo.webp",
        system: {
          abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
          attributes: {
            ac:    { flat: 14, calc: "flat" },   // overridden at spawn from caster's AC
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
    thumbnail: "modules/luxurious-summons/assets/variants/dragon-fire.webp",
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: ["Summon Draconic Spirit", "Summon Dragon"] },
    triggerSpell: "Summon Draconic Spirit",

    source: {
      mode: "compendium-scaled",
      baseUuid: "Compendium.dnd5e.actors24.Actor.phbmobDraconicSp",
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

    // v0.4.8: 5 real per-type dragon variants (asset-planner generation pass,
    // 2026-07-13) replace the v0.4.6 FIX 6 dragon-fire-breath-icon stopgap.
    variants: [
      { id: "acid",      name: "Acid",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-acid.webp",
        defaults: { hueColor: "#9aff66", outlineColor: "#9aff66" } },
      { id: "cold",      name: "Cold",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-cold.webp",
        defaults: { hueColor: "#c8e8f0", outlineColor: "#c8e8f0" } },
      { id: "fire",      name: "Fire",      thumbnail: "modules/luxurious-summons/assets/variants/dragon-fire.webp",
        defaults: { hueColor: "#ff7733", outlineColor: "#ff7733" } },
      { id: "lightning", name: "Lightning", thumbnail: "modules/luxurious-summons/assets/variants/dragon-lightning.webp",
        defaults: { hueColor: "#ffee66", outlineColor: "#ffee66" } },
      { id: "poison",    name: "Poison",    thumbnail: "modules/luxurious-summons/assets/variants/dragon-poison.webp",
        defaults: { hueColor: "#88dd88", outlineColor: "#88dd88" } }
    ],

    deathAnimation: "hexShatter"
  }
];
