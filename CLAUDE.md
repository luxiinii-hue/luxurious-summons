<!-- Module-local notes for luxurious-summons. Self-contained for sessions running with this dir as cwd. -->

# luxurious-summons — module-local notes

## What this module is

A Foundry VTT module for D&D 5e companion-management, targeting Foundry V13 minimum / V14 verified. Players spawn and control "summon"-style companions (Simulacrum first; Mirror Image, Find Familiar, Echo Knight Echo, Beast Companion, Animate Dead, Mage Hand, Unseen Servant, etc. coming in Plan 3). Visual customization via PIXI filters + procedural motion. Per-template fancy death animations. Click-to-place placement overlay with occupancy detection. Per-master folder organization in the actor sidebar.

## Foundry environment (where the friend tests)

The friend who runs the live-Foundry verification hosts **Foundry V13 build 351** with **dnd5e v5.2.1**. V14 is the *verified target* per the manifest (`"minimum": "13", "verified": "14"`) but is NOT yet what the friend is running — they're holding on V13 because some of their other modules aren't yet V14-compatible.

This is important when reading the "gotchas" section below: every issue listed there has been paid for on V13 (that's where the friend hit it), but the wording sometimes says "V14" because the parent-workspace CLAUDE.md framed them as V14 issues. **In practice, both V13 and V14 enforce the same `ApplicationV2` strictness** — single-root PARTS, `HandlebarsApplicationMixin` requirement, `loadTemplates()` pre-registration of partials, scene-control `tools` collection. The "V14" framing is the *documentation origin*, not the *failure surface*. The failure surface is V13 build 351 today.

Implications:
- All our V14-namespaced API access has V13 fallback (`foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates`, `PIXI.filters?.OutlineFilter ?? PIXI.OutlineFilter`, etc.) — verified by code audit during the v0.1.6 fix session. Don't break the fallback chain when adding new code.
- `ChatMessage.create({ style: 0 })` works on V13 — V13 ignores the unknown `style` field and defaults `type` to 0 (OTHER), which is the intended visual treatment. No `type: 0` fallback is needed.
- The `renderChatMessage` (V13) → `renderChatMessageHTML` (V14) hook rename is the one place we register both for cross-version compat; matters when Plan 4's D-mode approval cards land.
- dnd5e v3 returns Document instances from compendium indexes, v4+ returns `_id` strings. Use `fromUuid("Compendium.dnd5e.monsters.Actor.<id>")` for compendium lookup — works on all versions, survives v4's compendium re-indexing. Plan 2's variant schema bakes this in (`variants[].compendiumEntry` is a UUID string).
- **dnd5e spell-cast hook evolution** (verified via context7 against the official dnd5e wiki + paid for in v0.1.7):
  - **v3:** `dnd5e.useItem(item, config, options)` — legacy, no longer fires in v4+.
  - **v4:** `dnd5e.useActivity(activity, usage, config)` — refactor introduced the Activity system.
  - **v4 / v5 canonical:** `dnd5e.postUseActivity(activity, usageConfig, results)` — fires after the activity is activated. `activity.item` is the spell/item Document.
  - Register all three for defensive cross-version compat, then dedupe via a `WeakSet(item)` guard so a single use doesn't fire multiple times if a build emits more than one hook. See `scripts/spell-trigger.js`.
  - For pre-cast intercept / cancellation: `dnd5e.preUseActivity` (return `false` to cancel).

## Repo arrangement

This module is its **own git repo**, living at `modules/luxurious-summons/` inside the parent `Laps` workspace. The parent repo `.gitignore`s this directory so commits here are independent — no branch-switch interference from concurrent work on other modules in the parent (e.g., `emote-wheel`, which the user iterates on simultaneously in their IDE).

When invoked with this dir as cwd, **the parent `Laps/CLAUDE.md` does NOT auto-load**. Everything you need to know to work effectively here lives in this file or in the spec/plan paths referenced below. Cross-module reads (e.g., looking at `emote-wheel`) require explicit relative paths and should be intentional, not incidental.

## Status (as of 2026-05-10)

**Plan 1 (Foundation + Simulacrum vertical slice) is functionally complete through v0.1.7.** v0.1.6 was confirmed working by the friend (manager opens, tab switching works, Simulacrum spawns via the manager). v0.1.7 fixes three follow-up bugs from that test session: Simulacrum spawning with spent rather than full spell slots, the dnd5e.postUseActivity hook missing (so casting the Simulacrum spell didn't auto-open the spawn dialog on dnd5e 5.2.1), and the manager dialog occluding the canvas during placement.

**Plan 2 (visual customization UI + motion system) is in preview-iteration phase.** Design doc finalized, HTML preview built and design-critique-revised. v0.1.7 stabilized Plan 1 enough that Plan 2 implementation can now kick off — batched spec amendment on parent `main` is the next step, then Foundry-coupled integration of the Restyle dialog. The HTML preview is at `previews/restyle.html` — open in any modern browser, no server needed.

| Version | What landed |
|---|---|
| 0.1.0 | Plan 1 ship: spawn / dismiss / repair Simulacrum end-to-end; HP halve, block natural recovery, snapshot spell slots; icyShatter death animation; per-master folder; chat-broker; placement overlay; PIXI filter chain; manager skeleton |
| 0.1.1 | Companion-card quick-access (Open Sheet, Select & Pan, Combat); sheet decoration banner identifying companion sheets at a glance |
| 0.1.2 | Fix scene-control crash — V14 needs `tools` collection on every control |
| 0.1.3 | Fix manager not opening — V14 ApplicationV2 needs `HandlebarsApplicationMixin` |
| 0.1.4 | Cast Simulacrum spell auto-opens Spawn dialog (dnd5e.useItem hook + triggerSpell field) |
| 0.1.5 | Fix manager not rendering — V14 PARTS require single root element. Wrap manager.hbs + spawn.hbs in single root div; switch manager body to flex layout (drops fragile `calc(100% - 50px)`) |
| 0.1.6 | Fix manager tab-switch crash — V14 requires Handlebars partials to be pre-registered via `loadTemplates()` before `{{> "modules/..."}}` references resolve. Initial open worked because user's My Companions tab was empty (else-branch never tried the partial); clicking Spawn New triggered the lookup and threw. |
| 0.1.7 | Three bug fixes: (1) Simulacrum now spawns with full spell slots — `onAfterSpawn` resets clone's `system.spells.<key>.value` to `.max`; recovery still blocked via extended preUpdateActor mirroring the HP-block pattern. (2) `dnd5e.postUseActivity` hook registered for v5 alongside legacy v3/v4 hooks — Simulacrum spell-cast → auto-spawn now wires correctly on dnd5e 5.2.1. WeakSet guard prevents duplicate spawn-dialog opens if multiple hooks fire. (3) Manager dialog minimizes during placement so it doesn't occlude the canvas. |
| **0.2.0** | Plan 2 motion subset shipped: procedural per-token motion via `motionOverrides` on companion record. Simulacrum gets `flame-flicker` profile @ 0.6 intensity by default (subtle icy crackle). PIXI ticker-based; respects `enablePIXIFilters` escape hatch; skipped during Foundry's own token animations (`token._animation` guard) to avoid render-loop conflicts. Cleanup on `destroyToken` hook. Template `aestheticFamily` field landed (declarative metadata). Restyle dialog UI deferred to v0.2.x. |
| **0.2.1** | Fix player dismiss (permission denied) — Foundry world-actor delete is GM-gated even for OWNER-permission actors. Routed dismiss through chat-broker: player runs softFade locally, posts `dismiss` request, primary-GM client performs the delete. Verbose logging across `deleteActor` + `refreshUserIndexes` + manager `updateUser` to diagnose any remaining stale-active-count issues. |
| **0.3.0** | Plan 2 Restyle dialog landed end-to-end. Companion card → Restyle button opens 720 px 2-column dialog: summon details info card (HP/AC/speed/abilities/saves + Open Foundry Sheet) on the left, 8 control groups (Color/Tone/Visibility/Outline/Shimmer/Motion/Naming/Card) on the right. Live PIXI filter + motion updates as sliders drag. Save commits to actor flags; Cancel reverts; Reset copies template defaults. Spawn-dialog info card + customize-expander cut deferred to v0.3.x. |
| **0.3.1** | Restyle dialog: auto-apply via debounced flag writes (350 ms after last change). Save button removed; Cancel renamed "Revert changes" (rolls flag back to state on open). Closing the X commits current state. Defensive fix: `spawn-flow.js` now filters out stale `activeCompanions` entries (actor deleted but user-flag not refreshed) before checking restrictions — unblocks resummon-after-dismiss even if the index drifts. Diagnostic logging added to `applyFiltersToToken` (mesh + texture-valid state, gated on verboseLogging) to surface the rare invisible-token race. |
| **0.3.2** | Fix invisible-token bug introduced by v0.2.0 motion. Root cause: `applyMotionToTokenWith` snapshotted `mesh.position`/`scale`/`alpha` at attach time (mid-`drawToken` hook, before Foundry's draw chain has set canonical values on V13) and wrote ALL transform dimensions every tick — even ones the profile didn't animate. The flame-flicker profile only changes alpha, but the ticker was still pinning `mesh.position` and `mesh.scale` to pre-init zeros, making the sprite invisible while the border kept rendering at the correct world position. Fix: (1) inspect `motionProfileBounds` and only write dimensions whose max delta > 0 (flame-flicker now only touches alpha); (2) lazy base snapshot on first tick once Foundry's refresh has populated the mesh. |
| **0.3.3** | Fix ghost-token bug — dismissing a companion deleted the actor but never deleted the token documents. Image still rendered (`token.texture.src` lives on the document), but selection broke (no actor = no ownership). Both the GM-direct path (`manager-app.js #onDismiss`) and the player-broker path (`installDismissBrokerHandler`) now route through a single `runDeathAndCleanup(actor, { skipAnimation? })` that orders animation → `deleteAllTokensFor(actor)` (`scene.deleteEmbeddedDocuments("Token", ...)` across every scene) → `actor.delete()`. Tokens spawned from v0.3.3 onward carry `flags.luxsum.isCompanionToken = true` so a `ready`-hook sweep (`cleanupOrphanedCompanionTokens`) clears tagged orphans that survive a reload. Pre-v0.3.3 ghosts are untagged — GM right-clicks each one time. Defensive try/catch in `death-animations.js tweenWithTicker` swallows mid-animation mesh-destroyed errors. |
| **0.4.0** | Plan 3 roster expansion (Simulacrum + 7 new templates), spawn-effect audiovisual layer, flat-gallery + variant-picker UX. New source modes: `compendium` (Find Familiar, Pact of the Chain, Animate Dead — UUID lookup; UUIDs are `*-uuid-tbd` placeholders until verified live in dnd5e 5.2.1), `inline-synthesized` (Mage Hand, Unseen Servant, Echo Knight Echo — fully self-contained), `compendium-scaled` (Summon Dragon — 5 damage variants × 4 spell-slot tiers with HP scaling). Unified `effects: { motion, spawn, death }` template descriptor (legacy `defaults.motionProfile` + `deathAnimation` fields stay readable via `readEffects()` migration helper). 6 new spawn animations (`belleBloom`, `hexCrystalForm`, `mageHandSparks`, `infernalBloom`, `boneRise`, `echoStep`) and 6 new death animations (`belleFade`, `hexShatter`, `mageHandDissolve`, `echoCollapse`, `infernalFade`, `boneCollapse`) sharing 2 core implementations (`particleBloom`, `crystalForm`) via parameter-driven variants. Shared `tween.js` helper + `effect-textures.js` PIXI texture registry. Variant eligibility gating (`variant.requires.{class,subclass,classLevel,spellSlotLevel}`) — Pact of the Chain options surface only for warlocks with the boon. Multi-spawn UX for Animate Dead (per-variant stepper + total ≤ 4 + sequential placement loop). Spawn-flow + spawn-engine refactor: signature is now `runSpawnFlow(ctx)` with `{template, variantId, castSlotLevel, sourcePlayerId, sourceActor}`; spawn-engine routes through source-modes, mirrors Echo Knight Echo's AC from caster, tags spawned actor with `spawnState: "pending-spawn"` for one-shot animation playback in the `drawToken` hook. Spell-trigger generalized — supports `trigger: { type: "spell" \| "feature", name }` (Echo Knight's Manifest Echo feature triggers correctly) and extracts `castSlotLevel` from `usageConfig` for compendium-scaled templates. Manager + spell-trigger now route through `VariantPickerApp` instead of direct spawn; legacy `spawn-app.js` + `spawn.hbs` removed. **Tests: 42 → 80** (new suites for `effects-fallback`, `variant-eligibility`, `source-modes`, `multi-spawn-counter`). Asset gen deferred to a follow-up run via asset-planner. |

| **0.4.1** | Fix V13 `renderTemplate` deprecation in `variant-picker-app.js #refreshInfoCard`. Now uses the namespaced `foundry.applications.handlebars.renderTemplate` with the V13 global as fallback. Harmless on V13 build 351 (just spammed a deprecation warning every variant click), but would break in V15 when the global is actually removed. |

| **0.4.2** | Two placement-flow QoL fixes. (1) `placement-overlay.js` probes the thumbnail URL with `fetch(url, { method: "HEAD" })` before handing to `PIXI.Sprite.from` — on 404, falls back to a gold-tinted rectangle ghost instead of letting PIXI fire an uncaught promise rejection. Removes the spam in the console while asset gen is still pending. (2) `spawn-flow.js` now minimizes the caster's character sheet AND any open caster-item sheets during placement (in addition to the Manager). Restored on placement complete or cancel. Resolves the occlusion problem where the spellbook stays open over the canvas after a cast-driven spawn. |

| **0.4.3** | Wire template thumbnails + inline-synthesized token textures to **Foundry CORE icons** (zero module dependency). Paths sourced from the dnd5e SRD spell entries (`packs/_source/spells/<level>/<name>.yml` `img:` field) — every Foundry install has these icons at `icons/...`. Mappings: Find Familiar + Pact of the Chain → `icons/creatures/birds/corvid-flying-wings-purple.webp`; Animate Dead → `icons/magic/control/fear-fright-monster-red.webp`; Mage Hand → `icons/magic/unholy/strike-hand-glow-pink.webp` (also token + portrait); Unseen Servant → `icons/creatures/magical/spirit-undead-masked-blue.webp` (also token + portrait); Echo Knight Echo → Mirror Image's SRD icon (also token + portrait); Summon Dragon → Simulacrum's icon (stopgap). Simulacrum keeps its hand-authored SVG placeholder. Eliminates ~10 PNG 404s per gallery render. |
| **0.4.4** | Two fixes. (1) **Motion ticker re-captures base on Foundry-driven movement.** The previous code captured `base.x` / `base.y` on the first ticker frame and never updated them — so when the user dragged a Mage Hand (or any token with a position-animating profile like `floating-hand`), the next ticker frame wrote `oldBase + delta` and visually snapped the mesh back to the original spawn position. The fix tracks a `wasAnimating` flag through `token._animation` cycles and re-captures `base.x` / `base.y` from `mesh.position` when the tween clears. Also catches non-tweened snaps (token-config dialog x/y edit, scripted moves) via a `lastWrite` drift check. Scale / rotation / alpha NOT re-captured — Foundry drag-and-drop doesn't touch those, and re-capturing them would compound our own last-applied delta into the new base. Simulacrum (`flame-flicker`, alpha-only) was unaffected; this bug was specific to position-animating profiles. (2) Better Foundry CORE icons for two templates with no SRD spell entry: Echo Knight Echo → `icons/equipment/chest/breastplate-cuirass-steel-grey.webp` (Knight monster's breastplate; reads as "armored figure"); Summon Dragon → `icons/creatures/abilities/dragon-fire-breath-orange.webp` (canonical dragon breath icon, used by the adult-red-dragon SRD monster). |
| **0.4.5** | Replaced 21 of 22 `*-uuid-tbd` placeholders in `templates-builtin.js` with real `dnd5e.monsters` UUIDs (Find Familiar's 15 SRD familiars, Pact of the Chain's 4, Animate Dead's Skeleton + Zombie). Find Familiar / Pact of the Chain / Animate Dead are now end-to-end functional — picker shows real stats, Place creates real compendium-cloned actors. Draconic Spirit remains placeholder — Summon Draconic Spirit is Tasha's content, lives in a different pack (likely `dnd5e.monsters24` or `dnd5e.summons`); needs a follow-up discovery pass. |
| **0.4.6** | Review-driven stabilization: a 13-finding audit of the barely-live-verified 0.2.0–0.4.5 surface, all fixes landed. (1) **Fixes invisible summons** — spawn/death animations now coordinate with the motion ticker via a shared `anim-state.js` guard (module-side equivalent of the `token._animation` guard); previously the ticker's lazy base snapshot captured the animation-zeroed alpha/scale and pinned it forever (Simulacrum permanently invisible, Animate Dead stuck at 70% scale). Spawn animations also lazy-snapshot mesh state on their first frame (same V13 rationale as v0.3.2). (2) `spawnState` flag clearing is primary-GM-only and error-wrapped — fixes an unhandled permission rejection on every non-owner client per spawn; the client-scope animations setting now gates local playback only (was: any opted-out client raced to clear the flag and could suppress the animation for everyone). (3) Manager spawn resolves source actor from controlled token → assigned character — a GM without an assigned character could not spawn at all ("no source actor"). (4) Variant eligibility gains `requires.feature`; Pact of the Chain is gated on the actual pact-boon feat (the old `requires.subclass: "pact-of-the-chain"` could never match — it's not a subclass). (5) Inline-synthesized AC works via `ac.calc: "flat"` (dnd5e ignores `ac.flat` otherwise); Echo Knight now really mirrors caster AC. (6) `extractCastSlotLevel` parses dnd5e slot-key strings ("spell6"/"pact") — upcast scaling tiers match; boolean `consume.spellSlot` no longer mistaken for a level. (7) All 26 variant thumbnails point at dnd5e system token art / core icons (were 404-broken `assets/variants/*.png`). (8) Death-animation resolution honors `variant.deathEffectOverride` and `effects.death` via `readEffects` (Imp/Quasit `infernalFade` was dead config). (9) ESC cleanly aborts a multi-spawn sequence (`runSpawnFlow` returns explicit outcome objects). (10) Draconic Spirit UUID wired to `Compendium.dnd5e.actors24.Actor.phbmobDraconicSp` (verified vs dnd5e release-5.2.1); Summon Dragon trigger matches both the 2024 name and Tasha's "Summon Draconic Spirit". (11) Dead "Open Foundry Sheet" button suppressed in the picker info card. Housekeeping: friend's screenshots moved out of `assets/` (they were shipping ~400 KB inside the 0.4.3–0.4.5 ZIPs) into `docs/reference/` with a module-stack compat writeup; `dist/` + `.staging/` + `.superpowers/` gitignored. **Tests: 89 → 121.** |
| **0.4.7** | Live-test follow-ups from the first 0.4.6 session on the friend's server. (1) **Heal sweep** (`heal-sweep.js`, ready hook, primary-GM client): rewrites broken pre-0.4.6 art paths (`assets/tokens/*.png`, baked into old actor/token documents — the "Invalid Asset" boot error AND the unselectable Unseen Servant: the failed texture load aborts `Token._draw`, breaking the hit area) to current template art; clears `pending-spawn` flags older than 5 min so stale flags don't replay spawn animations at boot. (2) Effect textures load lazily on demand (`ensureEffectTexture`) — boot-time draws happen BEFORE the `ready` preload (`Game.setupGame → initializeCanvas`), which caused "hexShard texture not loaded". (3) **Vendored outline shader** (`outline-filter.js`): V13 build 351's PIXI has neither `PIXI.filters.OutlineFilter` nor `PIXI.OutlineFilter`, so ALL outlines silently no-opped in production. 8-direction alpha-sampling PIXI v7 filter, lazily class-defined (module-scope `extends PIXI.Filter` breaks node:test imports), try/catch'd so shader failure only drops the outline entry. (4) Mage Hand de-washed (brightness 1.2→1.0, hueIntensity 0.30→0.10, texture scale 0.8) + new world setting `mageHandTokenPath` (FilePicker, imagevideo) so the token art can point at any image/animated webm. (5) Compendium art fallback (`resolveArtFallback`): Draconic Spirit ships with empty `img` in dnd5e 5.2.1 and is absent from `fa-token-mapping.json` — any compendium creature without art now falls back to the template thumbnail (size/scale preserved). **Tests: 121 → 144.** |
| **0.4.8** | Asset pass — first custom art. 9 Replicate-generated pieces (asset-planner agent; flux-1.1-pro + background-remover; isolated-subject/transparent-bg convention; converted to WebP q90 w/ alpha, 1.7 MB → 454 KB): Mage Hand (spectral teal hand, gold palm sigil), Unseen Servant (headless Belle Époque butler livery), Echo Knight Echo (monochrome spectral knight), 5 elemental Draconic Spirit variants (acid/cold/fire/lightning/poison — shared design, distinct palettes; used as BOTH variant thumbnails and token art), Simulacrum thumb (ice-robed figure; replaces the placeholder SVG, now deleted). Wiring: `resolveArtFallback` is variant-aware (`variant.thumbnail ?? template.thumbnail` — a Cold dragon spawns with cold art); **heal-sweep Sweep A reworked** from prefix-match (which would have destroyed the newly-valid `assets/tokens/` paths) to probe-based: heal when art is empty, `mystery-man.svg` (retro-fixes the stale 0.4.6-session dragon), or module-local AND a cached HEAD-probe 404s (covers stale `.png` paths — we ship `.webp` now). `mageHandTokenPath` hint reframed as an override. **Tests: 144 → 158.** |
| **0.5.0** | Conjurations wave (tier 1) + anime-style art re-roll, shipped together. **Six new templates** (8 → 14), all backed by official dnd5e 5.2.1 `actors24` stat blocks (UUIDs verified vs release-5.2.1): Spiritual Weapon, Arcane Hand (trigger aliases `["Arcane Hand","Bigby's Hand"]`), Mirror Image (fixed multi-spawn ×3 via new `fixedMultiSpawn` picker mode; new `handlers/mirror-image.js` copies the CASTER's token art + name onto each Duplicate), Find Steed (Celestial/Fey/Fiend steed variants), Phantom Steed, Flaming Sphere. **Key discovery:** Spiritual Weapon + Arcane Hand damage formulas reference `@flags.dnd5e.summon.level`/`.mod` — populated only by dnd5e's own SummonActivity, so standalone clones would break at roll time; fixed by writing those flags onto the clone at spawn (`applySummonFlags` + `computeSpellcastingMod` in source-modes, `source.substituteSpellLevel` template flag) so the original formulas resolve naturally. Unseen Servant converted to the official 2024 stat block (`phbsplUnseenServ`); Mage Hand deliberately KEPT inline — the official block ships null movement + AC 0, materially worse for play. **Art:** all 9 pieces re-rolled in an anime-webcomic style (bold ink outlines, cel shading, jewel tones — user-reference-driven); mage hand re-rolled twice more after anatomy failures in BOTH directions (6 digits shipped in 0.4.8's set, then a 4-digit "passed" QA) — the accepted QA method is now positional digit enumeration on a 2× zoom crop, recorded in the parent workspace CLAUDE.md. **Tests: 158 → 186.** |
| **0.6.0** | **GM Console** (Plan 4, slice 1) — the Manager's GM-only "All Companions" tab is live. Three-layer motion control with GM-wins precedence (`resolveEffectiveMotion` in data-model.js, 13-test matrix): global master switch + intensity dial 0–150% (world settings, `onChange` → `reapplyAllCompanionTokens()` fires on every client = instant table-wide), per-template overrides (existing `templateOverrides` world setting, Off/Subtle/Default/Lively vocabulary shared with Restyle via exported `PRESET_INTENSITY`), per-companion `gmOverrides` flag namespace (freeze sets `motionEnabled:false`; restore DELETES the key via `-=` so template decisions aren't shadowed). Two world kill switches (`gmForceDisableFilters` → tint-only world-wide; `gmForceDisableSpawnDeathAnims`) that AND with the client escape hatches and gate local playback only (0.4.6 lesson respected). GM dials can raise a player's explicit "Off" (removed the `!motion.intensity` early-return); GM freezes hold during owner Restyle previews. Console UI: Global Controls group + collapsible per-template strip + all-companions roster (player-color chips, HP bars, Sheet / cross-scene Pan / Restyle-any / Motion-freeze / force-Dismiss per card), live-refreshing via actor hooks. New partials registered in loadTemplates (v0.1.6 gotcha honored); new `styles/gm-console.css` reuses restyle.css control primitives (verified standalone selectors). Browser preview at `previews/gm-console.html` (mirrors the precedence fn). Design record: `docs/2026-07-13-gm-console-design.md`. Remaining Plan 4 slices: Templates editor, D-mode approval. **Tests: 186 → 199.** |
| **0.7.0** | **Plan 4 complete** — Templates editor + D-mode approval (slices 2+3). (1) **Effective-template layer** (`template-store.js`): builtin templates stay immutable; GM edits live in the `templateOverrides` world setting (sibling keys to the GM Console's motion overrides); `mergeTemplateOverrides` (pure, 10-test suite) applies name/thumbnail/per-variant uuid-name-thumb/removed/customVariants; ALL consumers migrated to `getEffectiveTemplate(s)()`. (2) **Templates editor tab** live: per-template accordion, display-name override, thumbnail FilePicker, per-variant rows (rename / rethumb / relink UUID with a **Test** button that resolves and names the actor / remove-restore), add-custom-variant. Editor renders from RAW builtin+override so removed variants stay restorable. (3) **Nine Summon X subscriber templates** (14 → 23): Beast/Fey/Shadowspawn/Undead/Aberration/Construct/Elemental/Celestial/Fiend, `requiresLink: true` + null-uuid "spirit" variant — picker shows "Not linked — the GM connects this stat block in Manager → Templates" until the GM pastes their DDB-imported actor's UUID (world `Actor.x` or compendium uuids both work; `substituteSpellLevel` plumbing reused). (4) **D-mode approval** (`approval.js`): player pre-places, approval card (whispered, payload+coords in flags) with GM-only Approve/Deny buttons wired via BOTH renderChatMessage/renderChatMessageHTML; Approve runs performSpawn on the clicking GM's client (no broker hop), requester gets a whispered verdict; anti-spam counts requests; denied slots don't refund (RAW trade-off). `needsGmApproval` pure + tested. (5) Settings tab stub replaced with a settings-sheet shortcut. Design record: `docs/2026-07-19-plan4-completion-design.md`. **Tests: 199 → 215.** |
| **0.7.1** | **GitHub release pipeline.** Public repo `https://github.com/luxiinii-hue/luxurious-summons`; `module.json` gains `url`/`manifest`/`download` — manifest points at `releases/latest/download/module.json` (always-current), `download` is version-pinned per release. Install/update happens INSIDE Foundry via the manifest URL (no browser ZIP download → no SmartScreen/AV reputation flags — a raw-ZIP hand-off tripped the friend's antivirus on 0.7.0; the released asset was verified byte-identical to the local build, SHA256-matched). Each release uploads TWO assets: `module.zip` and a top-level `module.json` copy. NOTE: lightweight tags need an explicit `git push origin <tag>` — `--follow-tags` only pushes annotated tags. |
| **0.7.2** | Release asset renamed to a constant `module.zip` (no version in friend-facing filenames — user request). Local `dist/` builds stay version-numbered; the upload copy is `Copy-Item dist\luxurious-summons-X.Y.Z.zip dist\module.zip`. `download` URL now ends in `/module.zip` (still version-pinned via the tag in the path). |
| **0.7.3** | Live-test fixes. (1) **Spawns no longer vanish silently.** The broker hand-off assumed an active GM client: `electPrimaryGM` returns null when no connected user has `isGM`, and `installBrokerHook` bails on every non-primary client — so with no GM online the request was posted and *nobody ever executed it*, with zero feedback (solo-testing as a player hits this every time). Now a **GM requester executes `performSpawn` directly** (no round-trip, no election dependency, failures surface to whoever clicked) and a **player requester pre-flights for a live executor**, getting `LUXSUM.Spawn.NoActiveGm` instead of silence. Brokered failures are additionally whispered back to the requester (previously GM-console-only). (2) **Manager title shows the installed version** (`get title()`), and the `ready` boot log carries it too — "which build is he running?" is now answerable from any screenshot or pasted log. (3) **Multi-spawn window churn fixed**: minimize/restore of the caster's sheet is hoisted around the WHOLE sequence (`collectOccludingWindows`/`minimizeWindows`/`restoreWindows` + `manageWindows:false`) — a 3-token Mirror Image cast no longer bounces the character sheet back open between placements. The sequence also aborts on hard failures instead of making the user click through N doomed placements. (4) Fixed multi-spawn no longer leaks the synthetic `__default__` variant id into the companion record. UUID audit: every 2024 `actors24` UUID re-verified against dnd5e's own spell data (`profiles[].uuid` in `spells24`) — all correct. |
| **0.7.4** | **INVISIBLE SUMMONS — root cause found and disarmed.** The vendored outline shader added in v0.4.7 (`outline-filter.js`, written because V13 build 351's PIXI has no OutlineFilter) was rendering every token that carried it as *nothing*. The identifying evidence: **Find Familiar — the sole template the user reported as working — is the only spawnable one with `outlineThickness: 0`**, i.e. the only one that never gets the filter; every reported-broken template has thickness > 0 (Simulacrum 3, Mage Hand/Animate Dead/Echo/Dragon/Spiritual Weapon/Arcane Hand/Flaming Sphere 2, Unseen Servant/Mirror Image/Phantom Steed 1). Timeline corroborates: the user's "most things had a clear image" test was v0.4.6 — the last build where outlines silently no-opped. **The trap: PIXI compiles filter shaders LAZILY at first render, so the `try/catch` around construction never fires — a bad shader surfaces as a WebGL console error and the mesh simply draws as nothing.** Fix: the vendored shader is now behind `enableVendoredOutline` (world setting, **default OFF**, `config: true`); a native `PIXI.OutlineFilter` is still used unconditionally where a build provides one. Disabling costs nothing that ever worked — outlines were absent on this runtime from v0.1.0 to v0.4.6 unnoticed. Also: the impl-choice log line is no longer gated behind verboseLogging. Parent-workspace CLAUDE.md updated with both the general lesson (never ship an unverified `PIXI.Filter`; lazy compilation defeats try/catch; "invisible token" ⇒ suspect the filter chain first, triage with the world kill switch) and the full GitHub-release/manifest-URL distribution pipeline. |

| **0.8.0** | **Companion control + two spawn-correctness bugs.** (1) **Summoned tokens were HOSTILE.** dnd5e compendium stat blocks ship `disposition: -1` (verified in `packs/_source/monsters/undead/skeleton.yml` @ release-5.2.1) and nothing normalized it — every compendium-sourced companion (20 of 23 templates) spawned with the red enemy ring and read as an enemy to Midi QOL target filtering and Automated Animations disposition rules. (2) **Companion HP bars never moved.** The same stat blocks ship `actorLink: false`, so token damage landed in a TokenDelta while the Manager card and GM Console roster read `actor.system.attributes.hp` — full health forever on a bloodied token (the linked-vs-unlinked trap in the workspace CLAUDE.md). Both fixed in `token-normalize.js` (pure, 12 tests) applied to `prototypeToken` before `Actor.create`; disposition is overridable via the new `companionDisposition` world setting (Friendly/Neutral/Secret) and a per-template `tokenDisposition`. (3) **Instance numbering** — a 4-skeleton Animate Dead cast produced four actors named identically; `companionDisplayName` (pure, 5 tests) suffixes "(n)" for batches and continues the count on a later cast. (4) **The Companion Bar** — the switcher requested back when everything was invisible ("a simple way of changing between which of the summons they control"). A fixed strip above the hotbar: your character, an etched brass divider, then every companion you own. Click = select + pan, shift-click = add to selection (move a skeleton pack in one drag), double-click = sheet, `Alt+C` cycles, `Alt+Shift+C` grabs all. Collapsible, per-user persisted, client setting to disable, hidden entirely when you have no companions. Chip labels strip " of \<master\>" so four skeletons don't all truncate to "SKELETON …". Positioned by measuring `#hotbar` and setting `bottom` rather than injecting into `#ui-bottom` — that container's flex direction and children have shifted between Foundry versions, and a wrong guess would shove Foundry's own chrome around. Preview at `previews/companion-bar.html`. **Tests: 215 → 232.** |

**232 unit tests passing.** Distribution ZIPs in this repo's `dist/` (gitignored as of 2026-07-13; parent `../../dist/` was the original convention but has never actually held this module's ZIPs).

### What's actively in flight / open

- **Live verification of the 0.4.x line.** The friend last confirmed v0.1.6 live; everything from 0.2.0 (motion), 0.3.x (Restyle), and 0.4.x (Plan 3 roster) has had little or no live-Foundry verification. The friend's stack is heavily automated (Midi QOL, Automated Animations + Sequencer + JB2A, DFreds — see `docs/reference/friend-environment.md`), so trigger hooks and spawn animations need testing WITH those modules enabled. Screenshot reference of their full module list is in `docs/reference/`.
- **Asset generation** (deferred from Plan 3): template thumbnails, per-variant thumbnails (`assets/variants/*.png` paths are declared in `templates-builtin.js` but the files don't exist — the placement overlay and gallery fall back gracefully), inline-synthesized token art. Route through the asset-planner agent; prompts in parent spec §9 / E.2.
- **Spec amendments on parent `main`** (§5.3, §6.6, §6.8, §6.9, §7.1, §7.2 + Plan 3/4 doc edits) — planned during the Plan 2 session, still unverified whether they ever landed. Check `git -C ../.. log main --oneline` before Plan 4 work.
- **Plan 4** (GM Console + Templates editor + per-variant CRUD + D-mode approval) — not started.

### Decisions taken during planning, important to remember

Captured during the user-feedback brainstorming and plan-mode planning session. All approved by user. Each one is non-trivial to reverse once code lands:

1. **Aesthetic family is declarative metadata on templates.** Each template has `aestheticFamily: "belle-epoque" | "hextech"`. Drives default `visualOverrides` palette + motion profile choice at *template-authoring time*, NOT runtime CSS variable swapping. Plan 5 owns the per-family chrome variation polish.
2. **Restyle dialog widens to 720 px** with a 2-column layout — left column = summon details info card, right column = controls. `@media (max-width: 900px)` stacks vertically and caps width at 480 px for narrow viewports.
3. **Info card content profile is minimal**: HP, AC, speed, 6 ability scores with save-prof pips, save chips, "Open Foundry Sheet" CTA. No spell lists / abilities / senses / languages — the actor sheet covers that with one click. `description-only` variant for non-creature summons (Mage Hand).
4. **Per-spawn customize-visuals expander on Spawn dialog is CUT.** Spec §5.3's 3-layer customize model (template-default / per-spawn / live-restyle) collapses to 2 layers. Reason: pre-spawn customization without a live canvas preview is weak; players who care about visuals iterate post-spawn with the token visible.
5. **Template variants are first-class schema.** Spec §7.1 gets `variants?: [{ id, name, thumbnail, compendiumEntry, defaultVisualOverrides?, defaultMotionOverrides?, source? }]` replacing the current `compendiumOptions: string[]`. `compendiumEntry` is a Foundry UUID like `"Compendium.dnd5e.monsters.Actor.abc123"` — name-based lookup is fragile across dnd5e v4's compendium re-indexing.
6. **Multi-variant gallery selector in Spawn dialog** (Plan 3, not 2). Find Familiar (14 SRD options) / Pact of the Chain (4) / Conjure Animals (4 CR bundles) / Drakewarden Drake (5 damage variants) / Beast Companion (3) all use the same gallery component.
7. **Slider thumbs are hexagonal, point-up, geometrically regular.** Final polygon: `polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)`. The first attempt used a horizontal hex stretched into a 1:1 square, which read as elongated (regular hex aspect is √3:2, not 1:1). Decided after preview review — user explicitly preferred hex over round; round variant + toggle removed entirely.
8. **GM per-variant editing lives in Plan 4 Templates editor**, not a new menu surface. Each variant gets its own row in the editor: name, thumbnail (FilePicker), compendium UUID, optional default visual/motion overrides (reuses the Restyle control set as a sub-form).
9. **Asset generation prompt** (Plan 3): every custom-generated token requires "isolated subject, no scenic background." Mage Hand specifically: hand only, transparent — the existing third-party Mage Hand module's full-scene render is the anti-pattern.
10. **Belle Époque + subtle steampunk** aesthetic vocabulary. Brass slider thumbs, etched track inserts, gilded swatch frames, fleur-de-lis dividers between groups, Cinzel titles. Restraint is the key word — every ornament earns its place by demarcating structure, not decorating. The hammered-metal background texture and gold-underline group titles were cut during the design-critique pass to keep the dialog from feeling cluttered.

## User preferences

- **Quality over speed.** Verify outputs before claiming done. For UI work, build a standalone HTML preview using the actual CSS and iterate visually before porting changes back, when the user can't easily test in live Foundry. The user explicitly said: "please work slowly and check your work to make it work well and look great."
- **Be genuinely critical.** Push back, don't glaze. Suggest better approaches. Go back and forth on design decisions rather than accepting the first one.
- **Trust the user with the final call.** When asked "you decide," make the call decisively and proceed — don't bounce decisions back as questions when the user has explicitly delegated. Use the brainstorming skill as a structured-thinking framework but don't kick decisions back to the user after they've delegated.
- **Verify in live Foundry.** Self-host or live-Foundry verification is on the user's friend (he hosts **Foundry V13 build 351 + dnd5e v5.2.1**). Build verbose `[luxurious-summons]` `console.log` instrumentation into dialog-open / hook / socket / broker paths so the user can paste a clear log trail when something fails. Note that the friend is intentionally on V13 (some of their other modules aren't V14-ready), so even though our manifest says `"verified": "14"`, V13 build 351 is the actual production runtime today.
- **System target:** D&D 5e (dnd5e v3+; v3.x is the friend's current version, v4.x is the V14 upgrade path). Module logs warning + disables spawn on other systems.

## Module conventions

- **Test files** in `tests/` prefixed `lux-*.test.js`. Run via `npm test` (`node --test`, no npm deps). **215 tests as of v0.7.0.**
- **All console logs** prefixed `[luxurious-summons]` so a clean log trail is paste-friendly.
- **Companion record state** on `actor.flags["luxurious-summons"]` (canonical); `user.flags["luxurious-summons"].activeCompanions` is a fast index regenerated from authoritative state on world init.
- **Chat-broker pattern** (chat messages with module flags) for player↔GM coordination — never `game.socket.emit` (drops messages silently in V14 with no error trace).
- **HTML preview workflow** (Plan 2+): standalone HTML at `previews/<dialog>.html` using actual module CSS. Loads in any modern browser from `file://` — no module imports, no server, no Foundry. Mock data inline in the preview JS. Iterate aesthetic + interaction before porting to Handlebars + ApplicationV2.
- **Cross-file dialog instance access**: export a `getActiveX()` getter from the app file (returns the instance if `.rendered`, else null). Don't import the singleton variable directly — getter centralizes the rendered-check and avoids stale references. Pattern: `manager-app.js getActiveManager()` consumed by `spawn-flow.js` for the minimize-during-placement flow. `restyle-app.js getActiveRestyleApp()` follows the same pattern.
- **Broker-routed player actions** (v0.2.1+): spawn AND dismiss both go through `chat-broker` handler registrations. Players don't have `Actor.delete()` permission on world actors regardless of OWNER perm — the primary-GM client executes via `registerBrokerHandler("dismiss", ...)`. Death animation runs locally on the requester's client BEFORE the broker post so they see the fade.
- **Draft state with debounced auto-apply** (Restyle dialog, v0.3.1+): dialog clones `actor.flags["luxurious-summons"]` into `_draft`, mutates in memory across slider drags, and schedules a debounced (~350 ms) `actor.update()` so changes persist without an explicit Save button. `_onClose` flushes any pending write so closing via the X commits. "Revert changes" button writes `_originalFlag` back. Pairs with the override-injection refactor below so live preview works without flag writes mid-drag.
- **Override-injection refactor**: `visual-filters.js` exposes both `applyFiltersToToken(token)` (reads actor flag — the hook-driven entry point used by drawToken/updateActor) AND `applyOverridesToToken(token, vOverrides, mOverrides)` (takes overrides directly — the dialog-driven entry point used by Restyle's `#applyDraft`). Lets dialogs preview draft state live on canvas without writing the flag every frame.
- **Defensive index filtering** (v0.3.1+): `user.flags.activeCompanions` is a fast-lookup index that should be kept in sync with canonical actor state via `refreshUserIndexes`, but a missed refresh leaves a ghost entry that blocks operations (e.g., resummon hits the per-template `maxActive` cap because of a stale entry). Filter the index at the *check site* (`activeCompanions.filter(c => game.actors.get(c.actorId))`) rather than trusting the refresh — unblocks the user even if the index drifts. Warn-log when filtering trims something so the underlying drift is still diagnosable.
- **Release pipeline (v0.7.1+):** after commit + tag, (1) set `module.json` `version` AND the version-pinned `download` URL (`releases/download/luxurious-summons-vX.Y.Z/luxurious-summons-X.Y.Z.zip`; `manifest` stays on `releases/latest/download/module.json`), (2) build the staged ZIP into `dist/` (versioned name for local history), then `Copy-Item` it to `dist\module.zip` — the RELEASE asset is always literally `module.zip` (v0.7.2+; the `download` URL ends `/module.zip`), (3) `Copy-Item module.json dist\module.json`, (4) `gh release create luxurious-summons-vX.Y.Z dist/module.zip dist/module.json --title ... --notes ...`, (5) verify: `curl -sL <manifest url>` shows the new version and the ZIP asset downloads byte-identical (SHA256 vs local). The friend installs/updates INSIDE Foundry via the manifest URL — never hand him a raw ZIP again (AV reputation flags). Remote: `origin https://github.com/luxiinii-hue/luxurious-summons.git`.
- **Distribution ZIP** via PowerShell. Exclude dev infrastructure (`.git/`, `.claude/`, `.gitignore`, `node_modules/`, `tests/`, `package.json`, `package-lock.json`, `CLAUDE.md`, `docs/`, `previews/`):
  ```powershell
  $src = "<repo>\modules\luxurious-summons"
  $out = "<repo>\dist\luxurious-summons-<version>.zip"
  # See git history for the staging-dir approach used in v0.1.5 ZIP build.
  Compress-Archive -Path $src -DestinationPath $out -Force
  ```

## Spec & plan locations

The canonical design + roadmap docs are split across the parent workspace and this inner repo:

| Path | What's there | Authority |
|---|---|---|
| `../../docs/superpowers/specs/2026-05-10-luxurious-summons-design.md` (parent `main`) | Full module spec (14 sections, ~750 lines + 24-entry decisions log) | **Canonical** for module-wide design intent. Read end-to-end before non-trivial design changes. Read via `git -C ../.. show main:docs/superpowers/specs/...` since parent is usually on a different branch. |
| `../../docs/superpowers/plans/2026-05-10-luxurious-summons.md` (parent `main`) | Plan 1 detailed (~30 tasks) + Plans 2–5 high-level roadmap | **Canonical** for milestone ordering and scope boundaries. |
| `docs/2026-05-10-plan-2-restyle-design.md` (inner repo) | Plan 2 design doc — Restyle dialog, motion system, aesthetic family, summon details card, hex thumb decision, whitespace targets, decisions log | **Canonical for Plan 2.** Amends the parent spec where they conflict. Gets reconciled into the parent spec once Plan 2 implementation phase begins. |
| `~/.claude/plans/ethereal-fluttering-steele.md` (Claude Code user dir) | Plan-mode plan synthesizing user's review feedback into the roadmap (audit + 6 decisions + file-modification list + verification) | **Reference** for what was decided during the planning session. Not actively edited after plan-mode exited. |

## Surrounding workspace — when you need more context

The parent `Laps` workspace (one dir up: `../`) holds adjacent context that this module's repo doesn't duplicate. **It's fine to read from it when you need broader project context — just don't write into it from this session, and don't accidentally treat its branches as relevant to this module.**

| Path | What's there | When to consult |
|---|---|---|
| `../../CLAUDE.md` | Parent project CLAUDE.md (universal Foundry/V14 conventions, build tooling, image-processing pipeline) | If something here references "the parent CLAUDE.md" and you need the original wording, or if you suspect a V14 gotcha not yet captured here |
| `../../docs/superpowers/specs/` | Design specs for both modules (this one + emote-wheel). luxurious-summons spec lives on parent `main` — read via `git show main:...`. | Spec is the canonical source for design intent |
| `../../docs/superpowers/plans/` | Implementation plans for both modules. Same git-show pattern. | Plan 1 detailed + Plans 2-5 roadmap |
| `../../dist/` | Distribution ZIPs for OTHER modules (e.g. emote-wheel) | This module's ZIPs live in this repo's own `dist/` (gitignored), NOT the parent's |
| `../emote-wheel/` | The other Foundry module in the workspace, system-agnostic emote selector | Cross-pattern reference: how does emote-wheel solve scene controls / dialogs / chat-broker / sprite anchoring? Patterns may transfer (V14 gotchas overlap) — but the user is actively iterating on emote-wheel, so don't modify |
| `../emote-wheel/CLAUDE.md` | emote-wheel's module-local notes | Reference if a pattern was paid for there |
| `../../tests/` | emote-wheel's test files (this module's tests live in this repo's `tests/`) | Don't run from this dir's `npm test` — that runs only this module's tests |
| `../../tools/` | Dev scripts (e.g., `crop-defaults.sh` for emote-wheel asset prep) | Not relevant to this module |
| `../../package.json` | Parent's npm config — minimal, just runs `node --test` from project root for emote-wheel's tests | Don't need it; this repo has its own `package.json` |

**Rule of thumb:** if asking yourself "is this part of luxurious-summons or the parent workspace?", check the path. Anything inside this repo's working tree is luxurious-summons; anything reachable via `../..` belongs to the parent workspace and is a context resource, not implementation territory.

## Foundry V13/V14 gotchas (paid for in bugs)

The friend hits these on V13 build 351. The "V14" wording in individual bullets reflects where the gotcha was first documented (parent CLAUDE.md, before we knew the friend's actual build); both versions enforce the same constraints.

### ApplicationV2 / dialogs

- **`render({ force: true })`**, not `render(true)`. V14 reads the first arg as an options object. `render(true)` is silently a no-op.
- **`ApplicationV2` is rendering-agnostic.** Subclassing it directly throws "not renderable because it does not implement the abstract methods _renderHTML and _replaceHTML" the moment .render() is called. To use the Handlebars `static PARTS = { body: { template: ... } }` pattern, mix in `HandlebarsApplicationMixin`:
  ```js
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  export class MyApp extends HandlebarsApplicationMixin(ApplicationV2) { ... }
  ```
- **Each PART template must render exactly ONE root HTML element** — paid for in v0.1.5. V14's `_parsePartHTML` throws `Template part "X" must render a single HTML element` if the template has multiple top-level siblings (e.g., `<nav>` + `<section>`), leading whitespace before the root, or a conditional that produces 0 / 2 roots. Fixes: wrap the whole template in one root `<div>`, OR split into multiple PARTS in `static PARTS = { tabs, body }` (the V14-canonical pattern when sections are conceptually independent and want selective re-render via `this.render({ parts: ["body"] })`). For a single visually-unified dialog, the wrapper div is right-sized.
- **No nested `<form>` elements.** When `tag: "form"` is on the application, the template parts must be `<div>`s. A nested `<form>` corrupts Foundry's submit handling and visibly breaks the page layout after submit.
- **Static private methods in `static DEFAULT_OPTIONS` work** — V8 installs methods before field initializers per ES2022 spec. Use `this.#methodName`.
- **Lifecycle cleanup hook is `_onClose(options)`** — not `_close`. Call `super._onClose?.(options)`.
- **Foundry's `.window-content button` forces ~26px height.** Use `<span role="button" tabindex="0">` for small custom controls.
- **Two side-by-side dialogs:** popovers in the back dialog render BEHIND the front. Teleport popovers to `<body>` after render; rewire `[data-action]` delegation manually.
- **`document`-level listeners attached in `_onRender` leak.** Always `removeEventListener(prev, true)` before re-adding.
- **`<input type="range">` `input` event + `this.render()` = sticky slider.** Update preview/state imperatively on `input`; call `render()` only on `change` (release).
- **`DialogV2.wait` in V14 needs explicit `callback: () => "<action>"` per button** for the action string to resolve. `rejectClose: false` makes the close-X resolve to `null` instead of throwing.

### Handlebars helpers (V14 ships fewer than V13)

- **`add` is NOT shipped.** `eq` IS. When in doubt, **precompute values in `_prepareContext`** rather than relying on helpers.

### Handlebars partials must be pre-registered (V14) — paid for in v0.1.6

- V13 may have auto-loaded `{{> "modules/<id>/templates/partials/foo.hbs"}}` references by path. V14 is strict: each partial path must first be registered via `loadTemplates([...])` before it can be referenced. Otherwise rendering throws `Error: The partial <path> could not be found`.
- API lookup is V13/V14 split:
  ```js
  const loader = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  await loader([
    "modules/<id>/templates/partials/foo.hbs",
    "modules/<id>/templates/partials/bar.hbs"
  ]);
  ```
- Register during the `init` hook (the hook callback can be async).
- Subtle failure mode: a partial reference inside `{{#each xs}}...{{else}}...{{/each}}` only triggers the error when `xs` is non-empty. If your initial test data happens to be empty, the bug only surfaces later when data appears. Always register every partial proactively at startup.
- `static PARTS = { ... }` on the ApplicationV2 declares TOP-LEVEL template parts, NOT inner Handlebars partials. Don't confuse them — they're separate registries.

### Scene controls (`getSceneControlButtons` hook) — paid for in v0.1.2

- **Don't pass a non-existent `layer:`** on the control config.
- **The launcher button must be a TOOL inside a CONTROL**, with `button: true` on the tool. The control needs a `tools` collection (V14: dict, V13: array). Without `tools` the canvas-draw cascades into NotesLayer querySelector failure. Pattern:
  ```js
  Hooks.on("getSceneControlButtons", (controls) => {
    const tool = { name, title, icon, button: true, visible: true, onClick, onChange };
    const control = { name, title, icon, visible: true, activeTool: name, tools: { [name]: tool } };
    if (Array.isArray(controls)) { control.tools = [tool]; controls.push(control); }
    else { controls[name] = control; }
  });
  ```
- Wire **both** `onClick` and `onChange` since V13 vs V14 differ in which fires.

### FilePicker

- V14 namespaced: `foundry.applications.apps.FilePicker.implementation`
- V13 global: `globalThis.FilePicker` (deprecated in V14)
- Always look up via fallback:
  ```js
  const FP = foundry.applications?.apps?.FilePicker?.implementation
    ?? globalThis.FilePicker;
  ```

### PIXI sprites on the canvas

- Texture loader: prefer `foundry.canvas.loadTexture`, fall back to global `loadTexture` for V13.
- `canvas.interface` is the right layer for "above tokens, world-space" overlays.
- Cleanup: `ticker.remove(tick); parent.removeChild(sprite); sprite.destroy({ children: true, texture: false })`. Pass `texture: false` so Foundry's loadTexture cache stays valid.
- **Per-frame motion via PIXI ticker** (Plan 2 paid for in v0.2.0, fully stabilised in v0.3.2): apply `profile(t, intensity)` deltas per-frame, **skip while `token._animation` is set** (`if (token._animation) return`) so motion doesn't fight Foundry's token-drag / ruler tween. Cleanup via `Hooks.on("destroyToken", ...)`. Pattern in `visual-filters.js applyMotionToTokenWith`. **Two non-obvious rules paid for in v0.3.2:** (1) **Only write the transform dimensions the profile actually animates** — inspect `motionProfileBounds`, gate each `mesh.position.set / rotation / scale.set / alpha =` write on `bounds.dX > 0`. Writing a stable `base + 0` every frame still fights Foundry's refresh and on V13 will pin the mesh to a pre-init transform (invisible sprite, border still drawn at correct world position — diagnostic was "border but no icon"). (2) **Lazy-snapshot the base on the first tick**, NOT at attach time — `drawToken` fires partway through Foundry's draw chain and `mesh.position`/`scale` may be uninitialised. By the first ticker frame, refresh has run and the snapshot is canonical.

### Cursor position for HTML overlays

- `canvas.mousePosition` is **world-space**. For `position: fixed` overlays you need **client-space** (`clientX`, `clientY`).

### ChatMessage

- V14 canonical field is `style: <number>`. `CONST.CHAT_MESSAGE_STYLES.IC === 1`. `CONST.CHAT_MESSAGE_TYPES` is removed.
- **`game.socket.emit` can drop messages silently cross-client in V14** with no error trace. For replicated state, prefer `ChatMessage.create({ flags: { "<module-id>": data } })` + `Hooks.on("createChatMessage")`.
- **Token lookup on receiver clients:** `canvas.tokens.get(tokenDoc.id)` is more reliable than `tokenDoc.object`.
- **Hook rename:** `renderChatMessage` (V13) → `renderChatMessageHTML` (V14). Register both for compat.

### Settings

- `scope: "client"` settings live in each user's localStorage — the GM CANNOT read them. If you need per-user state visible to the GM, use `user.flags["<module-id>"].field` instead.
- `registerMenu`'s `restricted: true` is UI-only. Real gating comes from `scope: "world"`.

### dnd5e compendium lookup (v3 → v4+ shift)

- The friend's V13 build 351 ships with **dnd5e v5.2.1**. Future V14 upgrade keeps dnd5e v5+ (no major system bump expected).
- dnd5e v3 returned Document instances from compendium indexes; v4+ returns `_id` strings. Code that handles one and not the other breaks across the upgrade.
- Prefer **UUID-based lookup** via `fromUuid("Compendium.dnd5e.monsters.Actor.<id>")` — works across all versions and survives v4's compendium re-indexing.
- This is why the Plan 2 variant schema uses `compendiumEntry: <uuid-string>`, not a name lookup.

### Promise idempotence

- Any fire-once callback that can be triggered from multiple paths needs a `_finished` flag guard.

## Architecture quick-reference

```
scripts/
├── main.js                  ← module entry, hook registration, effect-texture preload (v0.4.0)
├── settings.js              ← 8 world + 4 client settings
├── data-model.js            ← companion record schema, validators, flag helpers, user-flag index regen, readEffects() migration helper
├── chat-broker.js           ← player↔GM coordination via chat-message flags + electPrimaryGM
├── spawn-engine.js          ← checkRestrictions (pure) + performSpawn (routes through source-modes, v0.4.0)
├── spawn-flow.js            ← runSpawnFlow(ctx) — restrictions + placement + broker post (v0.4.0 signature change)
├── spawn-gallery-app.js     ← v0.4.0: Spawn-dialog gallery (ApplicationV2)
├── variant-picker-app.js    ← v0.4.0: Variant-picker modal — surgical class-toggle selection, multi-spawn, cast-level
├── source-modes.js          ← v0.4.0: actor-data resolution (clone / compendium / inline-synth / compendium-scaled) + scaling-tier helpers
├── variant-eligibility.js   ← v0.4.0: pure-logic variant filtering by caster class/subclass/level
├── multi-spawn-counter.js   ← v0.4.0: pure-logic per-variant counter for Animate Dead's up-to-4 flow
├── lifecycle.js             ← detectHpDeath (pure) + HP=0 hooks + master-deletion prompt + runDeathAndCleanup + orphan-token sweep
├── visual-filters.js        ← describeFilters (pure) + buildFilters (PIXI) + applyFiltersToToken / applyOverridesToToken
├── placement-overlay.js     ← isCellBlocked (pure) + activatePlacement (PIXI ghost preview)
├── death-animations.js      ← icyShatter, softFade + 6 new (belleFade, hexShatter, mageHandDissolve, echoCollapse, infernalFade, boneCollapse)
├── spawn-animations.js      ← v0.4.0: 2 core animations (particleBloom, crystalForm) + 4 variants (mageHandSparks, infernalBloom, boneRise, echoStep)
├── spawn-trigger-anim.js    ← v0.4.0: drawToken hook handler that plays the spawn animation once
├── tween.js                 ← v0.4.0: shared PIXI ticker-based tween helper (with mid-anim mesh-destroyed guard)
├── effect-textures.js       ← v0.4.0: PIXI texture registry for spawn/death effect SVG assets
├── dnd5e-mods.js            ← computeModUpdates (pure) + applyDnd5eMods + installDnd5eHooks
├── spell-trigger.js         ← postUseActivity hook → openVariantPicker (supports spell + feature triggers as of v0.4.0)
├── sheet-decorator.js       ← renderActorSheet hook → Luxurious banner + .luxsum-companion-sheet class
├── manager-app.js           ← Manager dialog (5 tabs, role-gated)
├── restyle-app.js           ← Plan 2 Restyle dialog
├── templates-builtin.js     ← 23 templates (v0.7.0): Simulacrum + Find Familiar + Pact + Animate Dead + Mage Hand + Unseen Servant + Echo Knight Echo + Summon Dragon (v0.4.0) + Spiritual Weapon + Arcane Hand + Mirror Image + Find Steed + Phantom Steed + Flaming Sphere (v0.5.0) + 9 Summon X subscriber-linked templates (v0.7.0)
├── template-store.js        ← v0.7.0: effective-template merge layer — mergeTemplateOverrides (pure) + getEffectiveTemplate(s)(), builtin templates stay immutable, GM edits live in the templateOverrides world setting
├── motion-profiles.js       ← Plan 2: 6 named motion profiles + getMotionProfile fallback. Pure functions (t, intensity) → transform deltas.
├── approval.js              ← v0.7.0: D-mode approval — whispered chat-card GM Approve/Deny, needsGmApproval (pure) + performSpawn on approve, anti-spam request counter
└── handlers/
    ├── index.js             ← handler registry + callHandler
    ├── simulacrum.js        ← Repair action + onAfterSpawn (spell-slot snapshot)
    └── mirror-image.js      ← v0.5.0: onAfterSpawn — copies caster's token/actor art onto each spawned Duplicate

styles/
├── luxurious.css            ← Base palette (wine + gold + hextech reserved tokens) + theme rules
├── manager.css              ← Companion Manager dialog layout
├── restyle.css              ← Plan 2 Restyle dialog
├── summon-details.css       ← Plan 2 summon info card chrome
├── spawn-gallery.css        ← v0.4.0: Spawn-dialog gallery — 3-col grid, family-stripe edge, hover lift
└── variant-picker.css       ← v0.4.0: Variant-picker modal — 2-column, stepper, cast-level selector, multi-spawn total

templates/
├── manager.hbs              ← Manager dialog (5 tabs)
├── spawn-gallery.hbs        ← v0.4.0: gallery dialog
├── variant-picker.hbs       ← v0.4.0: variant picker modal
├── restyle.hbs              ← Plan 2 Restyle dialog
└── partials/
    ├── companion-card.hbs   ← Manager My-Companions card
    ├── template-card.hbs    ← legacy partial (still used by Manager → Spawn New tab)
    ├── template-gallery-card.hbs ← v0.4.0: gallery dialog card
    ├── variant-card.hbs     ← v0.4.0: variant grid card with optional stepper
    └── summon-details.hbs   ← Plan 2 summon info card (reused by variant picker)

assets/
├── icons/                   ← Module icons
├── templates-thumbs/        ← Template gallery thumbnails (Simulacrum SVG; PNG generation deferred to asset-planner agent)
├── variants/                ← Per-variant thumbnails (v0.4.0; generation deferred to asset-planner)
├── tokens/                  ← Per-template token sprites for inline-synthesized templates (deferred to asset-planner)
├── effects/                 ← v0.4.0 hand-authored: hex-shard.svg, gold-mote.svg, ember.svg, bone-mote.svg
└── ui/
    └── fleur-de-lis.svg     ← Plan 2 divider ornament

previews/                  (NOT shipped in dist ZIP)
├── restyle.html          ← Plan 2: standalone HTML preview of the Restyle dialog. Three template flavors, hex thumbs, full control set, summon details card, mock motion via CSS keyframes.
└── restyle-preview.js    ← Vanilla JS wiring for the preview (no Foundry, no PIXI).

docs/                      (NOT shipped in dist ZIP)
└── 2026-05-10-plan-2-restyle-design.md  ← Plan 2 design doc; canonical for Plan 2 scope and decisions.

tests/                     (NOT shipped in dist ZIP)
├── lux-broker.test.js
├── lux-data-model.test.js
├── lux-dnd5e-mods.test.js
├── lux-lifecycle-state.test.js
├── lux-motion-profiles.test.js   ← Plan 2: 9 tests, intensity scaling + bounds + fallback behavior
├── lux-placement-occupancy.test.js
├── lux-restrictions.test.js
└── lux-visual-overrides.test.js
```

## How to resume in a new session

1. **Read this file** + the parent spec + plan (in `../../docs/superpowers/`, via `git -C ../.. show main:...`).
2. **Read `docs/2026-05-10-plan-2-restyle-design.md`** — Plan 2 canonical design.
3. **`npm test`** — all tests should pass (current count lives in the status table above; don't hardcode it here, this line went stale twice).
4. **`git log --oneline | head -10`** — see recent commits + tags. Check `git tag --list | tail -3` for the latest shipped version rather than trusting a hardcoded number here (this line went stale once already).
5. **`ls dist/luxurious-summons-*.zip`** — see latest distribution ZIPs (this repo's `dist/`, gitignored).
6. **Check the friend's live-verification state.** Last confirmed-live version: v0.1.6. Everything newer (0.2.0 motion, 0.3.x Restyle, 0.4.x roster/triggers/animations) needs live testing — see "What's actively in flight / open" above and `docs/reference/friend-environment.md` for the module-interaction risks (Midi QOL, Automated Animations).
   - If **friend reports a bug**: reproduce minimally, fix in inner repo, bump patch version, commit + tag + new ZIP.
7. **Open `previews/restyle.html`** in a browser to see the locked aesthetic of the Restyle dialog (shipped in 0.3.0; preview kept as design reference).

## Asset generation (Plan 3)

Mage Hand + Unseen Servant tokens + 13 template thumbnails — generate via Replicate via the asset-planner agent (in parent's user agents at `~/.claude/agents/asset-planner.md`). Prompts in parent spec §9 / E.2.

**Asset prompt convention** (per user feedback during Plan 2 review): **isolated subject, transparent background, no scenic / environmental elements.** Mage Hand specifically: "ethereal disembodied hand of pure arcane force, gold and cyan magical glow, transparent background, no environment." The existing third-party Mage Hand module's full-scene render is the anti-pattern.
