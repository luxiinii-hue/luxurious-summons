# Plan 3 design — summon-effect catalog + presentation

**Status:** Draft awaiting user approval (2026-05-14).
**Author:** Joakim (with Claude Opus 4.7).
**Supersedes nothing.** Builds on Plan 2 (`docs/2026-05-10-plan-2-restyle-design.md`) by adding 7 new templates, a new audiovisual layer (spawn effects), a unified `source` + `effects` schema, and the Spawn-dialog gallery + variant-picker UX.

---

## 1. Scope

**In scope (Plan 3):**

- **Roster expansion** from 1 → 8 templates: Simulacrum (shipped) + Find Familiar, Pact of the Chain, Animate Dead, Mage Hand, Unseen Servant, Echo Knight Echo, Summon Dragon.
- **Three new source modes**: `compendium` (UUID lookup for Find Familiar / Pact / Animate Dead), `inline-synthesized` (Mage Hand / Unseen Servant / Echo Knight Echo), `compendium-scaled` (Summon Dragon — UUID base + per-cast-level scaling formulas).
- **New audiovisual layer — spawn effects.** One-shot animation when a token first appears. Bookends the existing death-animation layer; together they ceremonially open and close every summon's life on the canvas.
- **Family audiovisual vocabularies** — Belle Époque (warm/organic) and Hextech (cool/ethereal) each get a coherent spawn / motion / death triple. Templates inherit the family default; iconic templates override.
- **Spawn-dialog gallery + variant-picker modal** — flat 8-card gallery; click a card opens a 2-column modal (variant grid on the left, summon-details info card on the right). Replaces today's single-column Spawn dialog.
- **Variant schema** — per-variant compendium UUID + per-variant audiovisual overrides + per-variant eligibility gates (e.g., Pact of the Chain warlock-only).
- **Unified template `effects` descriptor** — `{ motion, spawn, death }` replaces the scattered `defaults.motionProfile` + `deathAnimation` fields. Legacy fields stay readable as a fallback during migration.
- **Animation infrastructure** — new `scripts/spawn-animations.js` paralleling `death-animations.js`; shared SVG texture cache; defensive mesh-destroyed guard in the tween helper (already shipped v0.3.3).
- **Asset inventory** — 37 generated thumbnails + 3 token sprites + 4 hand-authored effect SVGs.

**Out of scope (deferred to Plan 4):**

- **Level-scaling synth** (`level-scaling` mode) — Drakewarden Drake (5 damage variants), Beast Companion (3 Tasha's beasts), Steel Defender. Tasha's class-level scaling tables, prof bonus formulas, ability-score scaling. The Plan 3 `compendium-scaled` mode is closely related; Plan 4's `level-scaling` reuses the formula-table-driven approach with class-level as input instead of spell-slot level.
- **Multi-token spawn** (`summon-many` mode) — Conjure Animals (CR bundles, N tokens). Needs a placement-overlay refactor for sequential-cell selection. Animate Dead (this plan's only multi-token template) uses a simpler "place N times, one at a time" loop that doesn't need that refactor.
- **Mirror-instance** (`mirror` mode) — Mirror Image's 3 illusion tokens with shared state + dispel-on-hit hook. Needs dnd5e attack-hook integration.
- **GM Templates editor** — per-variant CRUD, sprite swap, override sub-forms. Plan 4. Plan 3 lays the data-model groundwork (the schema this doc defines is what Plan 4's editor will write to).
- **Asset generation** itself — this doc enumerates the asset list + prompt vocabulary, but the actual Replicate runs happen in a separate concrete pass via the asset-planner agent.

**Why this ordering:**

- v0.3.x shipped Plan 1 (Simulacrum vertical slice) + Plan 2 (motion + Restyle dialog). Plan 3 is the breadth pass — many more templates against the existing audiovisual + customization vocabulary.
- Adding spawn effects on top of the existing motion + death layers is the smallest audiovisual expansion that produces a genuinely-different play feel (ceremony around every summon, not just at the end). It's also the biggest payoff per unit of new code.
- Level-scaling and multi-token spawn are deferred because each is ≥1 day of orthogonal machinery work; bundling all five into Plan 3 compromises every axis (less polish per template, less testing, larger bug surface, more V13 edge cases for the friend to hit).

---

## 2. Locked design axes

Each of these was decided during the brainstorming pass (2026-05-14 session). Listed here for grep-ability; each axis is referenced elsewhere in this doc.

1. **Three audiovisual layers per template:** motion + spawn + death. Idle ambient particle systems and per-action flourish effects are out of scope (deferred to a possible future plan after real-play feedback).
2. **Family defaults + per-template overrides.** Every Belle Époque template inherits `belle-bloom` / `idle-breathing` / `belle-fade` unless it overrides. Every Hextech template inherits `hex-crystal-form` / `ethereal-drift` / `hex-shatter` unless it overrides. ~6 family-default elements + ~9 per-template overrides = ~15 audiovisual elements total to author.
3. **Flat gallery + modal escalation for variants.** No tabs, no filtering by spell-availability, no inline variant expansion. 8 template cards on one surface; click any card opens a 2-column modal with that template's variant picker on the left and the summon-details info card on the right.
4. **Clone + compendium + inline-synthesized + compendium-scaled source modes.** Plan 3 builds these four. Plan 4 adds `level-scaling`, `summon-many`, `mirror`.
5. **Summon Dragon in scope as the 8th template.** Forces the `compendium-scaled` mode. Unlocks the same machinery for Drake / Beast / Steel in Plan 4 with marginal additional cost per template.

---

## 3. Roster catalog

Eight templates ship in Plan 3 (one already shipped — Simulacrum).

| # | Template | Family | Source mode | Variants | Trigger | `maxActive` | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Simulacrum | Hextech | `clone` | 1 | spell (7th-level) | 1 | Shipped v0.1.0. Half-HP clone with Repair action. |
| 2 | Find Familiar | Belle Époque | `compendium` | ~15 | spell (1st ritual) | 1 | SRD: bat, cat, crab, frog, hawk, lizard, octopus, owl, poisonous snake, quipper, rat, raven, sea horse, spider, weasel. **Verify SRD count is 14 or 15 before asset gen.** |
| 3 | Pact of the Chain | Belle Époque (warm-fiendish) | `compendium` | 4 | spell (1st ritual; **shares `triggerSpell: "Find Familiar"`** with #2) | 1 | Imp, Pseudodragon, Quasit, Sprite. Picker filters by caster eligibility — warlocks with the boon see #2's 15 + #3's 4 in one picker. |
| 4 | Animate Dead | Belle Époque (gothic-bone) | `compendium` | 2 | spell (3rd-level) | 4 | Skeleton or Zombie. **Only `maxActive > 1`** — player picks N (≤4) per cast, places each in sequence. |
| 5 | Mage Hand | Hextech | `inline-synthesized` | 1 | spell (cantrip) | 1 | AC 10, 1 HP, fly 30 ft. Carries up to 10 lb. No combat actions. |
| 6 | Unseen Servant | Hextech (faint-cyan) | `inline-synthesized` | 1 | spell (1st ritual) | 1 | AC 10, 2 HP, str 2. "Carry / lift / drop" actions. Default `alpha ≈ 0.15` — nearly invisible. |
| 7 | Echo Knight Echo | Hextech (echo-blue) | `inline-synthesized` + clone-AC | 1 | **class feature** (Manifest Echo, bonus action) | 1 | Mirrors caster's AC. 1 HP. Swap-position is a class action — token has the right stats; player/GM moves manually via Foundry's normal token tools, no programmatic swap. |
| 8 | Summon Dragon | Hextech (element-themed) | `compendium-scaled` | 5 | spell (5th-level, scales 5th–8th) | 1 | Tasha's. Damage type + spell-slot level both inputs. Scaling table drives HP / damage / attack-bonus deltas per slot level. |

**Family split:** 3 Belle Époque, 5 Hextech.

**Variant total:** 1 + 15 + 4 + 2 + 1 + 1 + 1 + 5 = **~29 distinct entities** spawnable.

### 3.1 Non-obvious roster notes (worth re-reading before implementation)

- **Find Familiar + Pact of the Chain share `triggerSpell: "Find Familiar"`.** Casting the spell opens the variant picker; the picker shows both pools, filtering Pact entries by warlock-pact-of-chain eligibility. Eligibility lives on the variant schema, not on the template, because a single picker must surface both pools simultaneously.
- **Animate Dead** is the only `maxActive > 1` template in Plan 3. Spawn flow needs the multi-spawn variant-picker UX from §6.3.
- **Echo Knight Echo** is the only class-feature-triggered template (no spell name to match). dnd5e v4+ fires `postUseActivity` on feature uses too — we match on the activity's parent item name "Manifest Echo" rather than spell-name. We generalize `triggerSpell: "<name>"` into `trigger: { type: "spell" | "feature", name: "..." }` rather than overload the existing field. The shipped `triggerSpell` field stays readable as a fallback during migration.
- **Unseen Servant's `alpha ≈ 0.15` default.** By RAW, Unseen Servant is invisible to everyone except the caster. We can't truly enforce "invisible to other players but not the caster" via PIXI filters cleanly across multi-client (Foundry's vision system would fight us). Default alpha of ~0.15 gives a faint shimmer that conveys "you barely see it" for *everyone* — pragmatic compromise.
- **Summon Dragon's cast-level input** comes from `dnd5e.postUseActivity`'s `usageConfig.level` (the actual slot level consumed). Pre-fills the cast-level selector in the variant picker. GM-manual spawn from the Manager → Spawn New flow defaults to the spell's base level (5th).

---

## 4. Family audiovisual vocabularies

Two families, three layers each. Every template inherits these unless it overrides (§5).

### 4.1 Belle Époque — warm, organic, alive

- **Spawn (`belle-bloom`):** ~24 warm-gold particle motes erupt outward from token center over 1.2 s. Token alpha 0 → 1 + scale 0.95 → 1.0 in sync. Rendered via `PIXI.ParticleContainer` for cheap per-particle cost; motes are `Sprite.from(textures.goldMote)` instances.
- **Idle motion (`idle-breathing`):** 3 % scale pulse @ 0.8 Hz. Already in `motion-profiles.js` from Plan 2.
- **Death (`belle-fade`):** saturation 1 → 0.4 + brightness 1 → 0.6 + alpha 1 → 0 over 1.0 s. Wine-tinted darkening. Replaces today's plain `softFade` for Belle Époque templates. `softFade` stays as the no-family fallback for any future template that doesn't fit either family.

### 4.2 Hextech — cool, ethereal, illusory

- **Spawn (`hex-crystal-form`):** 6 pre-baked cyan SVG shards spawn at radial offsets around the token, converge inward over 1.0 s, fade at impact. Token alpha 0 → 1 in sync with a 1.0 → 1.08 → 1.0 scale snap-bounce at the end. Asset: `assets/effects/hex-shard.svg`, instanced 6 ×. Keeps it tractable vs. procedural geometry.
- **Idle motion (`ethereal-drift`):** 3 px x-sway @ 0.4 Hz + faint alpha pulse @ 0.5 Hz. Already in `motion-profiles.js`.
- **Death (`hex-shatter`):** same 6 SVG shards spawn at token center, drift outward, fade. ~1.0 s. Token alpha 1 → 0 in sync. Mirror of `hex-crystal-form` — shared shard-rendering code, different parameters.

**Reuse trick:** spawn and death within a family share the same particle / shard infrastructure, just reversed. Bloom outward = spawn; bloom inward + alpha fade = death (per-family variant). Cuts authoring by ~half — one core function with parameters, not two unrelated implementations.

### 4.3 Why these two vocabularies

- Belle Époque "bloom + breathing + fade" reads as organic — life cycle of a creature.
- Hextech "crystal-form + drift + shatter" reads as illusion — assembly and dissolution of a construct.
- Together the two vocabularies cover every shipped template's flavor: creatures (Find Familiar, Pact, Animate Dead) feel alive; illusions and constructs (Simulacrum, Mage Hand, Unseen Servant, Echo Knight Echo, Summon Dragon) feel arcane.

---

## 5. Per-template signature overrides

Rows that override a family default. Templates without overrides use the family default for that layer (not listed).

| Template | Layer | Family default | Override | Why |
|---|---|---|---|---|
| Simulacrum | motion | `ethereal-drift` | `flame-flicker @ 0.6` | Already shipped; captures icy-crackle flavor. |
| Simulacrum | death | `hex-shatter` | `icyShatter` (existing) | Iconic — keep. |
| Mage Hand | motion | `ethereal-drift` | `floating-hand` | Hand hovers, doesn't drift. |
| Mage Hand | spawn | `hex-crystal-form` | `mage-hand-sparks` | Gold motes converge into a finger-by-finger forming hand. Cantrip-feeling, not 7th-level-spell-feeling. |
| Mage Hand | death | `hex-shatter` | `mage-hand-dissolve` | Hand dissolves into gold motes drifting away. Softer than shatter. |
| Unseen Servant | motion | `ethereal-drift` | `ethereal-drift @ 0.4` | Same profile, lower intensity. Even more "barely here." |
| Echo Knight Echo | motion | `ethereal-drift` | `mirror-wobble @ 0.4` | Echo flickers in/out of phase — wobble at low intensity reads "not quite stable." |
| Echo Knight Echo | spawn | `hex-crystal-form` | `echo-step` | Translucent master-silhouette ghost materializes into the echo over 0.5 s. |
| Echo Knight Echo | death | `hex-shatter` | `echo-collapse` | Vertical line of motes fades up and out. |
| Pact of the Chain (Imp / Quasit) | spawn | `belle-bloom` | `infernal-bloom` | Red-orange ember motes + brief sulfur-smoke wisp. **Per-variant** — Pseudodragon + Sprite use family default. |
| Pact of the Chain (Imp / Quasit) | death | `belle-fade` | `infernal-fade` | Variant of `belle-fade` with red-orange ember-puff at end. **Per-variant**. |
| Animate Dead | spawn | `belle-bloom` | `bone-rise` | Bone-white motes rise from ground (not erupt from center) over 1.5 s. Token scales 0.7 → 1.0 from a lying-prone baseline. |
| Animate Dead | death | `belle-fade` | `bone-collapse` | Token desaturates to bone-white, scales 1.0 → 0.7, alpha fade. Reads "collapse back into corpse." |
| Summon Dragon | spawn | `hex-crystal-form` | (family default) | Default is the right read — element-color tinting on the dragon's spawn motes comes via the variant's `hueColor`, not a different animation. |
| Summon Dragon | death | `hex-shatter` | (family default) | Same logic — element tint via variant filter, not new animation. |
| Find Familiar (all 15) | (no overrides) | — | — | Family defaults all the way. The bloom *is* the iconic Find Familiar moment. Bespoking per-variant inflates work without payoff. |

**Override counts:**
- Motion overrides: 5 (all reuse existing Plan 2 motion profiles — no new motion code).
- Spawn signatures: 4 — `mage-hand-sparks`, `echo-step`, `infernal-bloom`, `bone-rise`.
- Death signatures: 5 — `icyShatter` (existing), `mage-hand-dissolve`, `echo-collapse`, `infernal-fade`, `bone-collapse`.

---

## 6. Spawn-dialog UX

Two surfaces. One consistent vocabulary across the module — the variant picker matches Restyle's 720 × auto width and 2-column layout.

### 6.1 Gallery dialog (640 × 480 px)

Entry points:
- Manager → Spawn New tab (browse all available templates).
- Future: GM bulk-spawn flow. Architecture should not preclude this; not built in Plan 3.

Layout:
- Scrollable 3-column grid of template cards (180 × 180 px each).
- Card content: thumbnail 96 × 96 + name (Cinzel 16 px) + 1-line tagline (italic, muted) + variant-count badge if `variants.length > 1` (gold pill, e.g., "15 variants").
- **Family stripe** on the card's left edge — 4 px wide, gold (`--luxsum-accent`) for Belle Époque, cyan (`--luxsum-hex-accent`) for Hextech. Subtle family-identity cue without committing to full per-family chrome (deferred to Plan 5).
- Hover: shadow lift + 2 px upward translate; border brightens.
- Click: always opens the variant-picker modal (§6.2), even for N=1. Consistency over special-casing.

Footer: Cancel only. No "spawn defaults" shortcut — every spawn goes through the variant picker, even for single-variant templates. The extra click for single-variant templates is the cost of consistent UX (always-info-card-visible, always-place-via-modal).

### 6.2 Variant-picker modal (720 × 500 px)

2-column layout, matches Restyle dialog's width.

**Left column (320 px) — variant grid:**
- 3-column grid of variant cards (88 × 88 px each), scrollable if N > 9.
- Card content: thumbnail (64 × 64) + small name (12 px, centered below).
- Click: selects (gold border highlight, same as Restyle's color-picker pattern). Info card on the right updates to show that variant's stats.
- Double-click: equivalent to selecting + clicking Place.
- For single-variant templates: one card visible, pre-selected.

**Right column (360 px) — summon-details info card:**
- Reuses the existing `summon-details.hbs` partial from Plan 2.
- Shows AC / HP / speed / 6 ability scores with save-prof pips. Plus a 1-2 sentence variant tagline.
- "Open Foundry Sheet" CTA at the bottom — opens the variant's compendium actor sheet (for compendium-sourced variants) or the synthesized actor (after spawn).
- For inline-synthesized templates with minimal stats (Mage Hand: 1 HP, no abilities), the card collapses to a "description-only" variant defined in Plan 2.

**Cast-level selector:** below the variant grid, only visible for templates whose `source.mode === "compendium-scaled"`. Currently Summon Dragon only. `<select>` for 5th / 6th / 7th / 8th. Defaults to the cast's actual slot level (read from `usageConfig.level` when entering via spell-trigger); defaults to base slot level (5th) when entering via Manager.

**Footer:** Cancel + Place.

### 6.3 Multi-spawn flow (Animate Dead only)

Variant picker special-cases when `template.maxActive > 1`:

- Each variant card has a stepper `[− N +]` showing count for that variant.
- A total chip at the top of the variant grid: "Total: K / 4" (where 4 = `maxActive`).
- Place button reads "Place K tokens" (dynamic — disabled when K = 0).
- Click Place → placement overlay activates with "Token 1 of K" indicator. Places one token at a time, advancing the indicator. After the last placement, the dialog closes.
- Each placed token runs its own spawn animation (`bone-rise`) — sequential, not simultaneous, for visual clarity.

### 6.4 Cast-driven flow (Find Familiar / Pact / Simulacrum / Animate Dead / Mage Hand / Unseen Servant / Summon Dragon)

When `dnd5e.postUseActivity` fires on a spell name we know:

1. Skip the Gallery dialog entirely.
2. Open the Variant picker modal directly, scoped to the matched template (or templates — Find Familiar + Pact share `triggerSpell`).
3. For Find Familiar: picker shows the 15 SRD options + (if caster is warlock-with-pact-of-chain) the 4 Pact options. Eligibility-gated variants render with a lock icon and a "requires Pact of the Chain" tooltip on hover for non-warlocks (visual transparency without hiding the feature).
4. For Summon Dragon: cast-level selector pre-fills from `usageConfig.level`. User can downcast (rare but possible).

For feature-driven flow (Echo Knight Echo's Manifest Echo): same hook (`postUseActivity` fires on feature uses too in dnd5e v4+), matched by `activity.item.name === "Manifest Echo"`.

### 6.5 Sketch (text-only)

```
Gallery (640 × 480)
┌──────────────────────────────────────────────┐
│ Spawn New Companion                          │
├──────────────────────────────────────────────┤
│ [Simulacrum] [Find Familiar] [Pact of Chain] │  ← 3-col grid, family
│ [Animate D.] [Mage Hand]     [Unseen Serv.]  │     stripe on left edge
│ [Echo Echo]  [Summon Dragon]                 │
├──────────────────────────────────────────────┤
│                                    [Cancel]  │
└──────────────────────────────────────────────┘

           ↓ click any card

Variant picker (720 × 500)
┌──────────────────────────────────────────────────┐
│ Find Familiar — Pick a variant                   │
├─────────────────────────┬────────────────────────┤
│ [Owl] [Cat] [Bat]       │  ┌───────────────────┐ │
│ [Hawk] [Raven] [Spider] │  │ Owl               │ │
│ [Frog] [Snake] [Crab]   │  │ AC 11 / HP 1      │ │
│ [Fish] [Sea h.] [Octo.] │  │ Walk 5 / Fly 60   │ │
│ [Lizard] [Rat] [Weasel] │  │ Darkvision 120    │ │
│                         │  │ str cha …         │ │
│ Cast level: [1st ▼]    │  │ Tagline...        │ │
│ (hidden — not scaled)   │  │ [Open Foundry…]   │ │
├─────────────────────────┴────────────────────────┤
│                              [Cancel]  [Place]   │
└──────────────────────────────────────────────────┘
```

---

## 7. Data-model amendments

Template schema gains two new sub-objects (`source` and `effects`) and an expanded `variants` array.

### 7.1 Template schema

```js
{
  id: "summon-dragon",
  name: "Summon Dragon",
  description: "Summon a draconic spirit. Pick a damage type and a spell-slot level.",
  thumbnail: "modules/luxurious-summons/assets/templates-thumbs/summon-dragon.svg",

  // Trigger generalized — type discriminates spell vs. class feature.
  // Legacy `triggerSpell: "<name>"` stays readable as fallback during migration.
  trigger: { type: "spell", name: "Summon Draconic Spirit" },

  aestheticFamily: "hextech",

  // NEW: unified source descriptor (replaces ad-hoc fields)
  source: {
    mode: "compendium-scaled",
    baseUuid: "Compendium.dnd5e.monsters.Actor.<draconic-spirit-id>",  // TBD: verify in 5.2.1 compendium
    scalingTable: [
      { slotLevel: 5, hpAdd: 0,  damageAdd: 0, attackBonus: 0 },
      { slotLevel: 6, hpAdd: 10, damageAdd: 1, attackBonus: 1 },
      { slotLevel: 7, hpAdd: 20, damageAdd: 2, attackBonus: 1 },
      { slotLevel: 8, hpAdd: 30, damageAdd: 3, attackBonus: 2 }
    ]
  },

  // NEW: unified effects descriptor (motion + spawn + death in one place)
  effects: {
    motion: { profile: "ethereal-drift", intensity: 1.0 },  // hextech family default
    spawn:  "hex-crystal-form",                              // hextech family default
    death:  "hex-shatter"                                    // hextech family default
  },

  variants: [
    { id: "acid",      name: "Acid",      thumbnail: "...", defaults: { hueColor: "#9aff66" } },
    { id: "cold",      name: "Cold",      thumbnail: "...", defaults: { hueColor: "#c8e8f0" } },
    { id: "fire",      name: "Fire",      thumbnail: "...", defaults: { hueColor: "#ff7733" } },
    { id: "lightning", name: "Lightning", thumbnail: "...", defaults: { hueColor: "#ffee66" } },
    { id: "poison",    name: "Poison",    thumbnail: "...", defaults: { hueColor: "#88dd88" } }
  ],

  maxActive: 1,
  requiresApproval: false
}
```

**Source modes (Plan 3):**

| Mode | Required fields | Templates |
|---|---|---|
| `clone` | (none — derives from `actor.toObject()`) | Simulacrum |
| `compendium` | `baseUuid: string` (template level) OR per-variant `source.baseUuid` | Animate Dead. Find Familiar + Pact use per-variant source. |
| `inline-synthesized` | `inline: { name, type, system: { ... } }` | Mage Hand, Unseen Servant, Echo Knight Echo |
| `compendium-scaled` | `baseUuid` + `scalingTable: [{ slotLevel, hpAdd, damageAdd, attackBonus }]` | Summon Dragon |

### 7.2 Variant schema

```js
{
  id: string,                          // stable identifier ("owl", "imp", "acid")
  name: string,                        // display name ("Owl", "Imp", "Acid")
  thumbnail: string,                   // path to asset

  source?: SourceDescriptor,           // overrides template-level source for per-variant compendium lookups (Find Familiar's 15)

  defaults?: VisualOverrides,          // per-variant tint / outline / etc. — same shape as actor.flags.luxsum.visualOverrides

  requires?: {                         // eligibility — variant filtering in the picker
    class?: string,                    // "warlock"
    subclass?: string,                 // "pact-of-the-chain"
    classLevel?: number,               // minimum class level (rare; reserved for future)
    spellSlotLevel?: number            // for cast-level gating (rare; reserved for future)
  },

  spawnEffectOverride?: string,        // per-variant override of template.effects.spawn (Pact-Imp/Quasit → "infernal-bloom")
  deathEffectOverride?: string,        // ditto
  motionOverride?: { profile, intensity }
}
```

### 7.3 Companion-record (actor flag) changes

Existing `actor.flags["luxurious-summons"]` schema (per spec §4.1) gains one new field:

```js
{
  // ... existing fields ...
  variantId?: string,                  // which variant the user picked at spawn time; reference for re-spawn / restyle defaults
  castSlotLevel?: number               // for compendium-scaled spawns — locks the scaling tier into the actor record so respawn doesn't drift
}
```

Backward compatibility: companion records from v0.3.x and earlier lack these fields; `data-model.js` validators accept their absence and the spawn engine treats them as nullable.

### 7.4 Migration window

`effects` is the new home. `data-model.js` validators accept either shape during migration:

```js
function readEffects(template) {
  if (template.effects) return template.effects;
  // Legacy fallback (Plan 1 / Plan 2 shape)
  return {
    motion: (template.defaults?.motionProfile && template.defaults?.motionIntensity !== undefined)
      ? { profile: template.defaults.motionProfile, intensity: template.defaults.motionIntensity }
      : { profile: "none", intensity: 0 },
    spawn: null,                       // legacy has no spawn layer
    death: template.deathAnimation ?? "softFade"
  };
}
```

The spawn engine and visual-filters call `readEffects(template)` rather than reading `template.effects.*` directly.

---

## 8. Animation registries (code shape)

Three files, three layers, single tween helper.

### 8.1 `motion-profiles.js` — no new code

Plan 2's catalog covers every Plan 3 motion assignment:
- Belle Époque default: `idle-breathing`
- Hextech default: `ethereal-drift`
- Overrides: `flame-flicker`, `floating-hand`, `mirror-wobble` (all existing)

### 8.2 `spawn-animations.js` — new file, parallels `death-animations.js`

```js
// scripts/spawn-animations.js
const MODULE_ID = "luxurious-summons";

import { tweenWithTicker } from "./tween.js";   // shared helper, extracted from death-animations.js

export const spawnAnimations = {
  belleBloom:     async (token, opts = {}) => { /* gold motes erupt outward + alpha fade-in + slight scale-up */ },
  hexCrystalForm: async (token, opts = {}) => { /* 6 shards spawn radially, converge inward + alpha fade-in + scale snap-bounce */ },
  mageHandSparks: (token) => spawnAnimations.belleBloom(token, { palette: "gold", direction: "convergent" }),
  infernalBloom:  (token) => spawnAnimations.belleBloom(token, { palette: "ember", smokeWisp: true }),
  boneRise:       (token) => spawnAnimations.belleBloom(token, { palette: "bone", direction: "bottom-up", scaleFrom: 0.7 }),
  echoStep:       async (token) => { /* translucent master-silhouette ghost materializes — 0.5 s, unique */ }
};
```

**Variants reuse core functions via opts** — no duplicated tween code. The two cores are `belleBloom` (particle motes) and `hexCrystalForm` (radial shards). Everything else is a parameterization of one of those, or a small unique routine (`echoStep`).

### 8.3 `death-animations.js` — extended

```js
export const deathAnimations = {
  icyShatter,   // existing — keep for Simulacrum
  softFade,     // existing — keep as no-family fallback

  belleFade:        async (token, opts = {}) => { /* desat→0.4 + bright→0.6 + alpha→0 over 1.0 s */ },
  hexShatter:       async (token, opts = {}) => { /* mirror of hexCrystalForm — shards spawn at center, drift outward + fade */ },
  mageHandDissolve: (token) => deathAnimations.belleFade(token, { motesAtEnd: "gold" }),
  echoCollapse:     async (token) => { /* vertical line of motes up + fade — unique */ },
  infernalFade:     (token) => deathAnimations.belleFade(token, { emberPuff: true }),
  boneCollapse:     (token) => deathAnimations.belleFade(token, { desaturate: true, scaleDown: 0.7 })
};
```

### 8.4 `tween.js` — extracted shared helper

`tweenWithTicker(durationMs, onTick)` currently lives at the top of `death-animations.js`. Move it to a dedicated `tween.js` so `spawn-animations.js` can import without circular reference.

The defensive mid-animation mesh-destroyed guard shipped in v0.3.3 is already in place — keep it.

### 8.5 Shared SVG texture cache (module init)

```js
// In main.js ready hook, AFTER game.system.id check
const textures = {
  hexShard: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/hex-shard.svg"),
  goldMote: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/gold-mote.svg"),
  ember:    await PIXI.Assets.load("modules/luxurious-summons/assets/effects/ember.svg"),
  boneMote: await PIXI.Assets.load("modules/luxurious-summons/assets/effects/bone-mote.svg")
};
// Stash on a module-scoped registry rather than a window global — keeps cross-module pollution out.
import { setEffectTextures } from "./effect-textures.js";
setEffectTextures(textures);
```

`scripts/effect-textures.js` is a tiny module that holds the `textures` registry and exposes `getEffectTextures()`. `spawn-animations.js` and `death-animations.js` import from it.

### 8.6 Hook integration

`drawToken` is the entry point for new tokens appearing on canvas (per spec §6.7):

```js
// scripts/main.js (already exists; extend)
Hooks.on("drawToken", async (token) => {
  applyFiltersToToken(token);    // existing
  await maybeRunSpawnAnimation(token);  // new — checks if this is a freshly-spawned companion and plays its spawn animation
});
```

`maybeRunSpawnAnimation` reads the token's actor flag (`spawnState: "pending-spawn"`) — set by the spawn engine when the token is first created and cleared after the animation plays. Prevents the animation from re-firing on subsequent `drawToken` events (scene reload, token reveal).

```js
// scripts/spawn-engine.js (Plan 3 amendment)
async function performSpawn(payload) {
  // ... existing actor creation ...
  // ... existing token creation ...
  // NEW: mark the actor for spawn-animation playback on the next drawToken
  await newActor.setFlag(MODULE_ID, "spawnState", "pending-spawn");
  // ... rest of existing performSpawn ...
}
```

```js
// scripts/visual-filters.js (or new scripts/spawn-trigger.js)
export async function maybeRunSpawnAnimation(token) {
  const flag = token.actor?.flags?.[MODULE_ID];
  if (flag?.spawnState !== "pending-spawn") return;
  if (!game.settings.get(MODULE_ID, "enableDeathAnimations")) return;   // shares the death-animation enable gate
  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === flag.templateId);
  const effects = readEffects(template);
  const spawnId = flag.variantId
    ? template.variants?.find(v => v.id === flag.variantId)?.spawnEffectOverride ?? effects.spawn
    : effects.spawn;
  if (!spawnId) return;
  const { spawnAnimations } = await import("./spawn-animations.js");
  await spawnAnimations[spawnId]?.(token);
  await token.actor.unsetFlag(MODULE_ID, "spawnState");
}
```

---

## 9. Asset inventory

All generated assets follow: **isolated subject, transparent background, no scenic environment.** Per Plan 2 design doc §1 and the asset-planner agent's prompt vocabulary.

### 9.1 Template thumbnails (256 × 256)

| # | Template | Status | Prompt skeleton |
|---|---|---|---|
| 1 | Simulacrum | placeholder shipped | Refined version: "Translucent icy duplicate, frost-cyan glow, hextech aesthetic, transparent background, no environment" |
| 2 | Find Familiar | new | "Mystical familiar silhouette (owl/cat composite), warm gold belle époque oil-painting style, transparent background, no environment" |
| 3 | Pact of the Chain | new | "Fiendish imp silhouette, red-orange ember glow, warm gold frame, oil painting style, transparent background, no environment" |
| 4 | Animate Dead | new | "Skeletal figure rising, bone-white with wine-tinted ichor, gothic ornamental frame, transparent background, no environment" |
| 5 | Mage Hand | new | "Ethereal disembodied hand of pure arcane force, gold and cyan magical glow, transparent background, no environment" |
| 6 | Unseen Servant | new | "Faintly visible spectral servant silhouette, translucent cyan wisps, transparent background, no environment" |
| 7 | Echo Knight Echo | new | "Translucent armored echo, cool cyan-blue, geometric crystalline outline, transparent background, no environment" |
| 8 | Summon Dragon | new | "Ethereal draconic spirit, cyan crystalline wisps, hextech aesthetic, transparent background, no environment" |

### 9.2 Variant thumbnails (96 × 96)

- **Find Familiar (×15):** small isolated creature renders, each animal in alert posture. Same warm-gold treatment.
- **Pact of the Chain (×4):** Imp, Pseudodragon, Quasit, Sprite. Fiendish variants (Imp, Quasit) get red-orange ember tint; Pseudodragon + Sprite stay neutral-fey gold.
- **Animate Dead (×2):** Skeleton (bone-white), Zombie (decay-green).
- **Summon Dragon (×5):** same draconic-spirit base render, color-shifted per damage type in post-processing — cyan acid, frost-white cold, red-orange fire, electric-yellow lightning, sickly-green poison.

### 9.3 Token sprites (200 × 200)

Only for inline-synthesized templates (no compendium token to inherit):
- **Mage Hand** — "isolated ethereal hand, gold-cyan glow, transparent, no environment"
- **Unseen Servant** — "isolated faint spectral wisp, translucent cyan, transparent"
- **Echo Knight Echo** — "translucent armored figure mirroring caster pose, cool cyan-blue, transparent"

For compendium-sourced templates (Find Familiar, Pact of the Chain, Animate Dead, Summon Dragon), Foundry's actor compendium ships its own token texture — we use that as the default. Plan 4's GM Templates editor will let GMs swap these.

### 9.4 Effect SVGs (hand-authored, ship in repo)

| Asset | viewBox | Color | Purpose |
|---|---|---|---|
| `hex-shard.svg` | 12 × 12 | `#5cd3e8` | Hextech spawn / death (instanced 6 ×) |
| `gold-mote.svg` | 8 × 8 | `#c9a14b` | Belle Époque spawn / Mage Hand dissolve |
| `ember.svg` | 8 × 8 | `#d68b3c` | Infernal bloom / fade |
| `bone-mote.svg` | 8 × 8 | `#e8dcc4` | Bone rise / collapse |

Each SVG is ~8 lines of single-path geometry. Authored by hand, not by AI.

### 9.5 Generation order (cheapest unblockers first)

1. **Effect SVGs** (hand-authored, ~1 hr total) — unblocks the animation code path.
2. **Template thumbnails** (8 generated, ~1 day at Replicate cost) — gallery is empty without them.
3. **Token sprites for inline templates** (3 generated, ~3 hr) — Mage Hand / Unseen Servant / Echo placement needs textures.
4. **Variant thumbnails** (26 generated, ~1-2 days, can ship in waves) — Find Familiar's 15 is the bulk; can ship a subset (5 most-iconic) first and the rest in v0.4.x patches.

### 9.6 Total

- 8 template thumbnails (refined 1 + new 7) — generated
- 26 variant thumbnails — generated
- 3 token sprites — generated
- 4 effect SVGs — hand-authored

= **37 generated assets + 4 hand-authored SVGs**

---

## 10. Performance considerations

Plan 3 adds spawn animations + 7 templates' worth of audiovisual machinery. Performance budget concerns:

- **Spawn animations are one-shot** — no per-frame ticker work after the animation completes. Same pattern as death animations; bounded by animation duration (~1.0–1.5 s).
- **Particle counts** — `belle-bloom` peaks at ~24 motes per spawn; `hex-crystal-form` peaks at 6 shards. With multiple summons spawning simultaneously (worst case: Animate Dead's 4-token cast), total particle count is ~96 motes for ~1.2 s. Well within PIXI ParticleContainer's headroom (it can handle 10K+ in real-time).
- **Texture cache** — 4 effect SVGs pre-loaded once at module ready. No per-spawn texture loading.
- **Escape hatches** — `enableDeathAnimations: false` setting already exists; extend to gate spawn animations too. `enablePIXIFilters: false` already short-circuits motion + filters; spawn animations also respect this setting.

**Honest limitation:** Animate Dead's 4-skeleton spawn does animate 4 tokens in close succession (one placement at a time). On a low-end machine, this could read as choppy. Mitigation: each placement is sequential (player clicks → place → animate → next click), so the user is in control of pacing.

---

## 11. Testing strategy

| Test file | Coverage |
|---|---|
| `tests/lux-source-modes.test.js` | NEW. Pure-logic tests for each source mode's data-resolution: `compendium` (UUID resolution mock), `inline-synthesized` (template → actor doc generation), `compendium-scaled` (slot-level + scaling-table → final stat block). |
| `tests/lux-variant-eligibility.test.js` | NEW. Pure-logic tests for `requires` filtering — class / subclass / class-level gating. |
| `tests/lux-effects-fallback.test.js` | NEW. Pure-logic tests for `readEffects(template)` — handles new shape, legacy shape, missing fields. |
| `tests/lux-spawn-multispawn.test.js` | NEW. Pure-logic tests for the Animate Dead multi-placement counter (total ≤ maxActive, decrement on placement, completion detection). |
| Existing pure-logic tests | All 42 continue to pass; extend where touched. |
| Manual visual verification in `previews/spawn-gallery.html` | NEW. Standalone HTML preview of the gallery + variant picker, mock data per template. Iterate aesthetic before porting to Handlebars + ApplicationV2. |
| Live-Foundry verification (friend) | After preview iteration approved: spawn flow, variant picker, multi-spawn Animate Dead, cast-driven flow, dismiss + cleanup (already verified v0.3.3). |

---

## 12. Task ordering (high-level — fed to `writing-plans` skill)

Listed at a granularity the `writing-plans` skill can decompose into bite-sized tasks. Numbers are not commits — they're logical chunks.

### 12.1 Foundation (no Foundry coupling — ship preview-first)

1. **Hand-author 4 effect SVGs** — `hex-shard.svg`, `gold-mote.svg`, `ember.svg`, `bone-mote.svg`.
2. **Extract `tweenWithTicker`** into `scripts/tween.js`. Remove from `death-animations.js`, re-import.
3. **Write `scripts/spawn-animations.js`** with `belleBloom` + `hexCrystalForm` cores + 4 variants + `echoStep`.
4. **Extend `scripts/death-animations.js`** with `belleFade`, `hexShatter`, `mageHandDissolve`, `echoCollapse`, `infernalFade`, `boneCollapse`.
5. **Write `scripts/effect-textures.js`** — texture registry + setter/getter. Wire in `main.js` ready hook.
6. **New tests:** `lux-effects-fallback`, `lux-source-modes`, `lux-variant-eligibility`, `lux-spawn-multispawn`.
7. **HTML preview:** `previews/spawn-gallery.html` + `previews/spawn-gallery-preview.js`. Gallery + variant picker + multi-spawn UX. Mock data for all 8 templates.
8. **STOP for user visual review.** Iterate aesthetic + interaction until approved.

### 12.2 Data model + source modes

9. **Update `scripts/data-model.js`** — accept new `source` and `effects` shapes; add validators; `readEffects(template)` fallback helper.
10. **Update `scripts/templates-builtin.js`** — migrate Simulacrum to the new `effects` shape (no `source` change since it stays `clone`).
11. **Write inline stat blocks** for Mage Hand, Unseen Servant, Echo Knight Echo. Add to `templates-builtin.js`.
12. **Implement `compendium` source mode** in `scripts/spawn-engine.js` — UUID resolution via `fromUuid()`, clone the compendium actor.
13. **Implement `inline-synthesized` source mode** — synthesize actor doc from template's `source.inline`.
14. **Implement `compendium-scaled` source mode** — `compendium` resolution + apply scaling deltas based on `castSlotLevel`.
15. **Write variant-eligibility filter** — pure function `filterVariants(template, caster)` returns the variants the caster can use.

### 12.3 Roster authoring

16. **Author Find Familiar template** — 15 variants with compendium UUIDs (verify in dnd5e 5.2.1 compendium — bat / cat / crab / frog / hawk / lizard / octopus / owl / poisonous snake / quipper / rat / raven / sea horse / spider / weasel).
17. **Author Pact of the Chain template** — 4 variants with compendium UUIDs (imp / pseudodragon / quasit / sprite) + warlock-eligibility `requires` gates + `spawnEffectOverride: "infernal-bloom"` on Imp/Quasit.
18. **Author Animate Dead template** — 2 variants (skeleton / zombie) + `maxActive: 4`.
19. **Author Mage Hand template** — inline stat block + spawn/death overrides.
20. **Author Unseen Servant template** — inline stat block + low-alpha default.
21. **Author Echo Knight Echo template** — inline + clone-AC source mode + `trigger: { type: "feature", name: "Manifest Echo" }`.
22. **Author Summon Dragon template** — `compendium-scaled` source + 5 variants + scaling table.

### 12.4 Spawn-dialog UX

23. **New file `scripts/spawn-gallery-app.js`** — gallery dialog (ApplicationV2 + HandlebarsApplicationMixin, single-root PARTS template).
24. **New file `scripts/variant-picker-app.js`** — variant-picker modal. Reuses `summon-details.hbs` partial. Handles cast-level selector for `compendium-scaled` templates and multi-spawn counter for `maxActive > 1` templates.
25. **New templates** `templates/spawn-gallery.hbs` + `templates/variant-picker.hbs` — single-root divs; register via `loadTemplates()` (V13/V14 strict partial pre-registration).
26. **New styles** `styles/spawn-gallery.css` + `styles/variant-picker.css` — Belle Époque chrome consistent with Restyle dialog.
27. **Replace `scripts/spawn-app.js`** with the gallery + picker flow. Old `scripts/spawn-app.js` is deprecated / removed.
28. **Wire spawn-trigger flow** — `dnd5e.postUseActivity` opens variant picker directly when matching a known template's `trigger.name`.
29. **Wire multi-spawn flow** — placement overlay accepts an optional "place N tokens" mode; advances counter after each placement; dialog reopens for next placement.

### 12.5 Spawn-animation playback

30. **Tag actor with `spawnState: "pending-spawn"`** in `performSpawn` after token creation.
31. **`maybeRunSpawnAnimation(token)`** in `scripts/visual-filters.js` (or new `spawn-trigger.js`): wired to `drawToken` hook; reads actor flag, resolves variant override, plays effect, clears flag.

### 12.6 Asset generation (parallel track, can start after task 7)

32. **Generate 8 template thumbnails** via asset-planner agent.
33. **Generate 26 variant thumbnails** via asset-planner agent.
34. **Generate 3 token sprites** for inline templates.
35. **Verify and integrate generated assets** into `assets/templates-thumbs/`, `assets/variants/`, `assets/tokens/`.

### 12.7 Localization + polish

36. **Update `lang/en.json`** — new labels: gallery title, variant-picker title, cast-level selector, multi-spawn counter, all new template names + taglines + variant descriptions.
37. **Update ZIP build exclusion** — `previews/` already excluded; verify `docs/` excluded.

### 12.8 Ship

38. **Bump version to 0.4.0** (minor — feature work, not patch).
39. **Update CLAUDE.md** with v0.4.0 status-table row, list of new templates, list of new source modes, list of new audiovisual elements.
40. **Build + ship ZIP**, tag `luxurious-summons-v0.4.0`.

**Task ordering rationale:** 1–8 are zero-coupling preview work (HTML, hand-authored SVGs, pure-logic tests). Stop at #8 for user visual review. 9–22 are data-model + roster authoring (no UI changes). 23–31 are the new UI surfaces. 32–35 are the parallel asset track. 36–40 are ship preparation. The dependency chain is short — 23 depends on 9 (schema), 30 depends on 22 (templates authored), but most can ship in parallel.

---

## 13. Open questions / decisions log

1. **Q:** Should the gallery have a search box for ≥8 templates?
   **Decided:** No. 8 is below the threshold where search adds value. If Plan 4 adds more templates (via the GM editor), revisit.

2. **Q:** Should single-variant templates skip the variant picker and go straight to placement?
   **Decided:** No. The variant picker doubles as the info-card surface — players who skim stats want to see them before placing. Consistency over special-casing the N=1 path.

3. **Q:** What about the existing third-party Mage Hand module's WEBM-animated token texture pattern?
   **Decided:** Out of scope for Plan 3. The user explicitly flagged the third-party version's "full-scene render" as an anti-pattern (per Plan 2 §1). If we want animated WEBM token textures later, that's its own feature pass — Foundry handles WEBM playback natively.

4. **Q:** Should Find Familiar's 15 variants surface alphabetically, by speed, by senses, or by some "popularity" heuristic?
   **Decided:** Alphabetically for Plan 3 (predictable). Plan 4's GM editor can support custom variant ordering per-template.

5. **Q:** Should the cast-level selector for `compendium-scaled` templates also accept upcast slot levels above the spell's max (e.g., 9th for Summon Dragon)?
   **Decided:** No — clamp at the spell's RAW max slot (8th for Summon Dragon). dnd5e doesn't define behavior above max; matching RAW avoids player confusion.

6. **Q:** For Animate Dead's multi-spawn, should the placement overlay show "remaining N" indicator on the cursor or in a separate dialog corner?
   **Decided:** Both — corner of dialog shows "Token K of N", cursor shows a subtle "+N more" badge. The corner-indicator handles the case where the placement overlay has covered the dialog (which it does by default, per Plan 2's minimize-during-placement pattern).

7. **Q:** Should the gallery dialog also have a sort / filter UI for *family* (Belle Époque vs. Hextech)?
   **Decided:** No. The family-stripe on the card's left edge is enough visual chunking. Sorting / filtering at 8 templates is overkill — Plan 4 can revisit if the roster grows past ~20.

8. **Q:** Where does the `spawnState: "pending-spawn"` flag live — on the actor or the token?
   **Decided:** On the actor. Token flags don't reliably sync across multi-client in V13; actor flags do. Trade-off: actor flag mutates on spawn-finish, triggering a tiny extra `updateActor` hook — accepted for sync reliability.

9. **Q:** Does the variant picker's cast-level selector also apply to multi-spawn (Animate Dead)?
   **Decided:** No. Animate Dead doesn't scale with cast-level (it scales with spell slot at cast time mechanically — more zombies, not bigger zombies). The cast-level selector is hidden for non-`compendium-scaled` templates.

10. **Q:** Should the spawn-animation gate respect `enableDeathAnimations` setting or get its own toggle?
    **Decided:** Share `enableDeathAnimations` for Plan 3. A user toggling that off is signaling "I want low-overhead spawning"; spawn animations should go too. If Plan 4 splits these into separate settings based on real feedback, fine — YAGNI for now.

11. **Q:** What's the family for Summon Dragon's variants — all the same family (Hextech) or per-damage-type?
    **Decided:** All Hextech. The damage-type variants share the same arcane-summoning flavor; only the hueColor changes per variant. A future "infernal-themed dragon" (e.g., fire variant) might *feel* fiendish but the family system is for chrome / spawn / death vocabulary, not damage-type identification.

12. **Q:** How does the GM-bulk-spawn future scenario interact with the variant picker?
    **Decided:** Out of scope for Plan 3 architecture; the picker accepts a `mode: "single" | "bulk"` field but only `"single"` is implemented. Plan 4 fills in bulk.

---

## 14. Self-review notes

**Placeholder scan:** Two TBDs remain:
- §3, row 2 (Find Familiar): "Verify SRD count is 14 or 15 before asset gen." — verifiable against dnd5e 5.2.1 SRD compendium when authoring (§12 task 16). Not a blocker for design approval.
- §7.1: "Verify Draconic Spirit UUID in dnd5e 5.2.1 compendium before asset gen." — same, deferred to task 22.

No structural placeholders. All decisions in §13 marked **Decided:**.

**Internal consistency check:**
- Family assignments in §3 match §4's family vocabularies and §5's override table. Belle Époque: 3 templates (Find Familiar, Pact, Animate Dead). Hextech: 5 templates (Simulacrum, Mage Hand, Unseen Servant, Echo Knight Echo, Summon Dragon). Sum is 8. ✓
- Source modes in §3 match §7.1's mode descriptors and §12's task list. Four modes total in Plan 3. ✓
- §5's override count (5 motion + 4 spawn + 5 death = 14 overrides) plus §4's 6 family defaults = 20 audiovisual elements. Cross-references §10 (performance) and §8 (animation registries). ✓
- §6's cast-level selector references `compendium-scaled` mode, which §7.1 defines and §8 / §12 plumb through. ✓

**Scope check:** Doc covers Plan 3 only. Plan 4 (level-scaling, multi-token, mirror-instance, GM editor) referenced explicitly as out-of-scope. Plan 5 (per-family chrome variation polish) untouched. Tight.

**Ambiguity check:**
- §6.4 "cast-driven flow" — explicitly defines the data flow from `dnd5e.postUseActivity` to the variant picker, including the Find-Familiar-+-Pact eligibility filter and Summon Dragon's `usageConfig.level` plumbing. ✓
- §7.4 migration window — defines `readEffects(template)` as the single fallback point. No ambiguity about where legacy fields are read. ✓
- §8.6 spawn-animation hook integration — explicit on the actor-flag pattern (`spawnState: "pending-spawn"`) and where it's set/cleared. ✓

**Design risks worth flagging but not resolving here:**

- The variant picker's cast-level selector is a small `<select>` element. On V13/V14, Foundry's `.window-content` styling can override native `<select>` chrome inconsistently across browsers. If the styling looks off in preview, fall back to a custom `<div role="combobox">` pattern (similar to the color-picker overlay pattern from Plan 2 §9.4).
- Tagged token cleanup at `ready` (shipped v0.3.3) is GM-only. If a player loads the world before the GM, orphan tokens stay visible until the GM connects. Acceptable for now — Plan 4 may revisit if multi-GM-less-session play becomes common.
- Animate Dead's multi-spawn flow keeps the variant picker open while the placement overlay is active. Per Plan 2's minimize-during-placement pattern (`v0.1.7`), the picker should also minimize while the placement overlay is up. Implementation detail for task 24 — not a design concern.

---
