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
//
// v0.5.0 (conjurations wave, tier 1): 6 new templates + 2 source-mode
// conversions (Mage Hand, Unseen Servant: inline-synthesized -> compendium),
// all backed by dnd5e.actors24 stat blocks under
// packs/_source/actors24/{conjurations,companions/otherworldly-steeds}/ —
// UUIDs + filenames verified against the release-5.2.1 tag via gh api (TASK 0).
// TASK 0 also found that Spiritual Weapon + Arcane Hand's damage formulas
// reference `@flags.dnd5e.summon.{level,mod}` (populated natively by dnd5e's
// SummonActivity, never by a standalone Actor.create() clone) — those two
// templates carry `source.substituteSpellLevel: true`; see source-modes.js
// applySummonFlags doc comment for the full mechanism. No template in this
// wave referenced `@item.level` / `@scaling` / `@attributes.spell.*` /
// `@classes.*` — the speculative "@item.level substitution" machinery
// originally scoped for this wave was NOT built; see module CLAUDE.md decisions
// log for the write-up.
//
// v0.7.0 — Summon X spirit family (Tasha's / PHB 2024): these nine spells'
// spirit stat blocks are SUBSCRIBER content (not in dnd5e's free packs — only
// the Draconic Spirit made the SRD cut), reachable in this world via
// DDB-Importer. They ship with `source.requiresLink: true` and a null-uuid
// "spirit" variant; the GM links the imported stat block via the Templates
// editor (Manager → Templates), which writes the uuid into the
// `templateOverrides` world setting (template-store.js merges it in). Until
// linked, the picker shows the variant as "not linked" with guidance. Same
// substituteSpellLevel plumbing as Spiritual Weapon / Arcane Hand — Tasha's
// spirit blocks scale off the spell's slot level.

const SUMMON_SPIRIT_SPECS = [
  { id: "summon-beast",       spell: "Summon Beast",       level: 2, spirit: "Bestial Spirit",
    family: "belle-epoque", hue: "#c9a14b", spawn: "belleBloom",     death: "belleFade",
    thumbnail: "icons/creatures/birds/corvid-flying-wings-purple.webp" },
  { id: "summon-fey",         spell: "Summon Fey",         level: 3, spirit: "Fey Spirit",
    family: "belle-epoque", hue: "#a78bfa", spawn: "belleBloom",     death: "belleFade",
    thumbnail: "icons/creatures/magical/spirit-undead-masked-blue.webp" },
  { id: "summon-shadowspawn", spell: "Summon Shadowspawn", level: 3, spirit: "Shadow Spirit",
    family: "hextech",      hue: "#6b5b95", spawn: "boneRise",       death: "boneCollapse",
    thumbnail: "icons/magic/control/fear-fright-monster-red.webp" },
  { id: "summon-undead",      spell: "Summon Undead",      level: 3, spirit: "Undead Spirit",
    family: "hextech",      hue: "#88dd88", spawn: "boneRise",       death: "boneCollapse",
    thumbnail: "icons/magic/control/fear-fright-monster-red.webp" },
  { id: "summon-aberration",  spell: "Summon Aberration",  level: 4, spirit: "Aberrant Spirit",
    family: "hextech",      hue: "#9eecf5", spawn: "hexCrystalForm", death: "hexShatter",
    thumbnail: "icons/creatures/magical/spirit-undead-masked-blue.webp" },
  { id: "summon-construct",   spell: "Summon Construct",   level: 4, spirit: "Construct Spirit",
    family: "hextech",      hue: "#c8e8f0", spawn: "hexCrystalForm", death: "hexShatter",
    thumbnail: "icons/equipment/chest/breastplate-cuirass-steel-grey.webp" },
  { id: "summon-elemental",   spell: "Summon Elemental",   level: 4, spirit: "Elemental Spirit",
    family: "hextech",      hue: "#ff7733", spawn: "hexCrystalForm", death: "hexShatter",
    thumbnail: "icons/creatures/abilities/dragon-fire-breath-orange.webp" },
  { id: "summon-celestial",   spell: "Summon Celestial",   level: 5, spirit: "Celestial Spirit",
    family: "belle-epoque", hue: "#f0c97a", spawn: "belleBloom",     death: "belleFade",
    thumbnail: "icons/creatures/magical/spirit-undead-masked-blue.webp" },
  { id: "summon-fiend",       spell: "Summon Fiend",       level: 6, spirit: "Fiendish Spirit",
    family: "hextech",      hue: "#7a1c1c", spawn: "infernalBloom",  death: "infernalFade",
    thumbnail: "icons/magic/control/fear-fright-monster-red.webp" }
];

const SUMMON_SPIRIT_TEMPLATES = SUMMON_SPIRIT_SPECS.map(spec => ({
  id: spec.id,
  name: spec.spell,
  description: `Summon a ${spec.spirit.toLowerCase()}. Subscriber content — the GM links your imported stat block once via the Templates editor.`,
  thumbnail: spec.thumbnail,
  aestheticFamily: spec.family,

  trigger: { type: "spell", name: spec.spell },
  triggerSpell: spec.spell,

  source: {
    mode: "compendium",
    requiresLink: true,
    substituteSpellLevel: true,
    baseSpellLevel: spec.level
  },
  syncMode: "snapshot",
  maxActive: 1,
  requiresApproval: false,

  effects: {
    motion: { profile: "idle-breathing", intensity: 1.0 },
    spawn: spec.spawn,
    death: spec.death
  },

  defaults: {
    hueColor: spec.hue,
    hueIntensity: 0.12,
    alpha: 1.0,
    saturation: 1.0,
    brightness: 1.0,
    outlineColor: spec.hue,
    outlineThickness: 0,
    namePrefix: "",
    nameSuffix: "",
    borderColor: spec.hue,
    motionProfile: "idle-breathing",
    motionIntensity: 1.0
  },

  variants: [
    { id: "spirit", name: spec.spirit, thumbnail: spec.thumbnail, source: { baseUuid: null } }
  ],

  deathAnimation: spec.death
}));

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

    // v0.5.0 TASK 2: evaluated converting to source.mode "compendium" against
    // Compendium.dnd5e.actors24.Actor.phbsplMageHand00 and decided AGAINST it.
    // The official 2024-SRD stat block ships system.attributes.movement with
    // walk/fly/swim/climb/burrow ALL null (RAW encodes Mage Hand's "move up to
    // 30 ft" as spell-text flavor, not token movement) and ac.flat: 0. Cloned
    // as-is, the companion token would be immobile on the grid (no walk speed
    // to drag it with, no fly speed either) and have AC 0 — materially worse
    // for play than our inline block's fly:30/hover:true/ac:10, which lets a
    // player actually move the hand around the table. Kept inline per the
    // v0.5.0 spec's "keep inline if materially worse" clause.
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

    // v0.5.0 TASK 2: converted inline-synthesized -> compendium. The official
    // 2024-SRD stat block (Compendium.dnd5e.actors24.Actor.phbsplUnseenServ)
    // has walk:15 / ac.flat:10, matching our inline block, AND corrects our
    // hp to the RAW-accurate 1/1 (our inline block had drifted to 2/2). Ships
    // img: '' — resolveArtFallback heals both actor img and token texture to
    // template.thumbnail (our existing assets/tokens/unseen-servant.webp),
    // so the visual art is unchanged from before this conversion.
    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbsplUnseenServ" },
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
  },

  // ============================================================
  // v0.5.0 templates (conjurations wave, tier 1)
  // ============================================================

  {
    id: "spiritual-weapon",
    name: "Spiritual Weapon",
    description: "A spectral weapon of your deity's favor attacks on your behalf.",
    thumbnail: "icons/weapons/axes/axe-double-gold.webp",   // dnd5e SRD spell icon (spells24/2nd-level/spiritual-weapon.yml)
    aestheticFamily: "belle-epoque",

    trigger: { type: "spell", name: "Spiritual Weapon" },
    triggerSpell: "Spiritual Weapon",

    // TASK 3: damage formula is "(@flags.dnd5e.summon.level - 1)d8 + @flags.dnd5e.summon.mod" —
    // needs flags.dnd5e.summon.{level,mod} substituted at spawn time. See
    // source-modes.js applySummonFlags doc comment. baseSpellLevel 2 matches
    // the spell's own base casting level (spells24/2nd-level).
    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbsplSpiritualW", substituteSpellLevel: true, baseSpellLevel: 2 },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "floating-hand", intensity: 0.8 },
      spawn:  "belleBloom",
      death:  "belleFade"
    },

    defaults: {
      hueColor: "#c9a14b",
      hueIntensity: 0.15,
      alpha: 1.0,
      saturation: 1.0,
      brightness: 1.05,
      outlineColor: "#c9a14b",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#c9a14b",
      motionProfile: "floating-hand",
      motionIntensity: 0.8
    },

    deathAnimation: "belleFade"
  },

  {
    id: "arcane-hand",
    name: "Arcane Hand",
    description: "A Large hand of magical force follows your commands to grapple, strike, and shield.",
    thumbnail: "icons/magic/earth/strike-fist-stone.webp",   // dnd5e SRD spell icon (spells24/5th-level/arcane-hand.yml)
    aestheticFamily: "hextech",

    // 2024 SRD name is "Arcane Hand"; "Bigby's Hand" is the legacy/Tasha's
    // name DDB-Importer may still use — same dual-alias pattern as Summon Dragon.
    trigger: { type: "spell", name: ["Arcane Hand", "Bigby's Hand"] },
    triggerSpell: "Arcane Hand",

    // TASK 3: TWO damage formulas reference @flags.dnd5e.summon.level (Clenched
    // Fist: "(2 * @flags.dnd5e.summon.level - 5)d8"; Grasping Hand: "(2 *
    // @flags.dnd5e.summon.level - 6)d6 + @flags.dnd5e.summon.mod"). baseSpellLevel
    // 5 matches the spell's own base casting level (spells24/5th-level).
    // Large size (prototypeToken width/height: 2) comes through unmodified via
    // actor.toObject() clone — do NOT apply any scale-down override here.
    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbsplBigbysHand", substituteSpellLevel: true, baseSpellLevel: 5 },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "floating-hand", intensity: 1.0 },
      spawn:  "mageHandSparks",
      death:  "mageHandDissolve"
    },

    defaults: {
      hueColor: "#5cd3e8",
      hueIntensity: 0.20,
      alpha: 0.9,
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
    id: "mirror-image",
    name: "Mirror Image",
    description: "Three illusory duplicates of yourself spring into being, confusing attackers.",
    thumbnail: "icons/magic/defensive/illusion-evasion-echo-purple.webp",   // dnd5e SRD spell icon (spells24/2nd-level/mirror-image.yml)
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Mirror Image" },
    triggerSpell: "Mirror Image",

    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbDuplicate0000" },
    syncMode: "snapshot",
    // Fixed multi-spawn of 3 duplicates. maxActive > 1 is the SAME signal
    // variant-picker-app.js already uses to switch into multi-spawn mode
    // (this.multiSpawn = template.maxActive > 1) — no variant steppers are
    // shown here because this template carries no `variants` array, so the
    // picker's single-variant path pre-selects the implicit __default__
    // "variant" and increments it straight to 3 (see TASK 4 test + manual
    // verification note). Reuses the exact same multi-spawn-counter +
    // sequential-placement machinery Animate Dead uses, including the ESC-abort
    // mid-sequence behavior from v0.4.6 FIX 10.
    maxActive: 3,
    requiresApproval: false,

    effects: {
      motion: { profile: "mirror-wobble", intensity: 1.0 },
      spawn:  "echoStep",
      death:  "echoCollapse"
    },

    defaults: {
      hueColor: "#7ea9ff",
      hueIntensity: 0.20,
      alpha: 0.7,
      saturation: 0.8,
      brightness: 1.05,
      outlineColor: "#7ea9ff",
      outlineThickness: 1,
      // Duplicates are named "Duplicate of <caster>" — spawn-engine.js's
      // synthName falls back to `${prefix}${masterName}${suffix}` whenever no
      // `variant` is selected (this template has none), so namePrefix alone
      // produces exactly that shape.
      namePrefix: "Duplicate of ",
      nameSuffix: "",
      borderColor: "#7ea9ff",
      motionProfile: "mirror-wobble",
      motionIntensity: 1.0
    },

    deathAnimation: "echoCollapse"
  },

  {
    id: "find-steed",
    name: "Find Steed",
    description: "Summon a spirit steed to serve as a loyal mount.",
    thumbnail: "icons/commodities/claws/claw-blue-grey.webp",   // dnd5e SRD spell icon (spells24/2nd-level/find-steed.yml)
    aestheticFamily: "belle-epoque",

    trigger: { type: "spell", name: "Find Steed" },
    triggerSpell: "Find Steed",

    // Three named-flavor variants only — the generic Compendium.dnd5e.actors24
    // "Otherworldly Steed" (phbmobOtherworld) is redundant with these and
    // skipped per spec. Variant thumbnails intentionally point at the
    // template thumbnail (no custom per-flavor art yet) rather than inventing
    // a path that doesn't exist on disk — lux-thumbnail-paths.test.js would
    // catch a fabricated modules/... path anyway.
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
      hueIntensity: 0.15,
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
      { id: "celestial", name: "Celestial Steed", thumbnail: "icons/commodities/claws/claw-blue-grey.webp",
        source: { baseUuid: "Compendium.dnd5e.actors24.Actor.phbostCelestial0" } },
      { id: "fey",       name: "Fey Steed",       thumbnail: "icons/commodities/claws/claw-blue-grey.webp",
        source: { baseUuid: "Compendium.dnd5e.actors24.Actor.phbostFey0000000" } },
      { id: "fiend",     name: "Fiend Steed",     thumbnail: "icons/commodities/claws/claw-blue-grey.webp",
        source: { baseUuid: "Compendium.dnd5e.actors24.Actor.phbostFiend00000" } }
    ],

    deathAnimation: "belleFade"
  },

  {
    id: "phantom-steed",
    name: "Phantom Steed",
    description: "A spectral mount, quiet as death, appears to carry you swiftly across the land.",
    thumbnail: "icons/creatures/mammals/deer-antlers-glowing-blue.webp",   // dnd5e SRD spell icon (spells24/3rd-level/phantom-steed.yml)
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Phantom Steed" },
    triggerSpell: "Phantom Steed",

    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbsumPhantomSte" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "idle-breathing", intensity: 0.7 },
      spawn:  "echoStep",
      death:  "softFade"
    },

    defaults: {
      hueColor: "#5cd3e8",
      hueIntensity: 0.20,
      alpha: 0.85,
      saturation: 0.9,
      brightness: 1.0,
      outlineColor: "#5cd3e8",
      outlineThickness: 1,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#5cd3e8",
      motionProfile: "idle-breathing",
      motionIntensity: 0.7
    },

    deathAnimation: "softFade"
  },

  {
    id: "flaming-sphere",
    name: "Flaming Sphere",
    description: "A ten-foot-diameter sphere of fire rolls at your command, scorching all it touches.",
    thumbnail: "icons/magic/fire/flame-burning-earth-yellow.webp",   // dnd5e SRD spell icon (spells24/2nd-level/flaming-sphere.yml) — matches the stat block's own img exactly
    aestheticFamily: "hextech",

    trigger: { type: "spell", name: "Flaming Sphere" },
    triggerSpell: "Flaming Sphere",

    source: { mode: "compendium", baseUuid: "Compendium.dnd5e.actors24.Actor.phbsplFlamingSph" },
    syncMode: "snapshot",
    maxActive: 1,
    requiresApproval: false,

    effects: {
      motion: { profile: "flame-flicker", intensity: 1.0 },
      spawn:  "infernalBloom",
      death:  "infernalFade"
    },

    defaults: {
      hueColor: "#ff7733",
      hueIntensity: 0.25,
      alpha: 1.0,
      saturation: 1.0,
      brightness: 1.1,
      outlineColor: "#ff7733",
      outlineThickness: 2,
      namePrefix: "",
      nameSuffix: "",
      borderColor: "#ff7733",
      motionProfile: "flame-flicker",
      motionIntensity: 1.0
    },

    deathAnimation: "infernalFade"
  },

  // v0.7.0 — the nine Summon X spirit templates (see SUMMON_SPIRIT_SPECS above)
  ...SUMMON_SPIRIT_TEMPLATES
];
