# GM Console design record (v0.6.0 — Plan 4, slice 1)

Short design record; the full plan lived in the plan-mode file for the 2026-07-13 session.
Canonical decisions below. Templates editor + D-mode approval are the remaining Plan 4 slices.

## User decisions

1. **Scope:** GM Console only this iteration (Templates editor + D-mode approval deferred).
2. **Placement:** GM-only "All Companions" tab inside the existing Companion Manager.
3. **Motion control in three layers, GM wins over player Restyle settings.**
4. **GM reach:** full — opens the real Restyle dialog for any companion, plus force-dismiss.
5. Preview-first workflow (`previews/gm-console.html`) — user approved the direction, trusting
   final look to implementation ("I believe in your instincts").

## The precedence model (single source of truth)

`resolveEffectiveMotion(companionFlag, templateOverrides, gmGlobals)` in `scripts/data-model.js`
(pure, 13-test matrix in `tests/lux-gm-effective-motion.test.js`; the preview JS carries a mirror):

```
0                                   if gmMotionEnabled === false            (global switch)
0                                   if gmForceDisableFilters === true       (world kill switch)
0                                   if gmOverrides.motionEnabled === false  (per-companion)
0                                   if templateOverrides[tid].motionEnabled === false (per-template)
else (gmOverrides.motionIntensity ?? templateOverrides[tid].motionIntensity
      ?? player motionOverrides.intensity) × gmMotionIntensity
```

Notes that matter later:
- A GM dial can RAISE a player's explicit "Off" (GM wins both directions) — the old
  `!motion.intensity` early-return in `applyMotionToTokenWith` was removed for this.
- Restoring a per-companion freeze REMOVES the `gmOverrides.motionEnabled` key
  (`setGmOverride(actor, key, null)` → Foundry `-=` deletion) rather than storing `true`,
  so future template-level decisions aren't shadowed.
- GM freezes hold even during the owner's live Restyle preview (the draft path merges the
  draft over the actor flag before resolving).
- Visual styling has NO separate GM layer by design — the GM edits the same shared Restyle
  fields as the owner (last writer wins). A parallel GM-visuals layer would make owners'
  controls mysteriously dead. A per-companion "Lock visuals" control is noted as a possible
  future addition, deliberately not built.

## State storage

- Global: world settings `gmMotionEnabled`, `gmMotionIntensity` (0–1.5), `gmForceDisableFilters`,
  `gmForceDisableSpawnDeathAnims` — all `config: false`, the console is their UI. Their
  `onChange` (fires on every client) calls `reapplyAllCompanionTokens()` → instant table-wide.
- Per-template: the pre-existing `templateOverrides` world setting,
  `{ [templateId]: { motionEnabled?, motionIntensity? } }`, same onChange.
- Per-companion: `actor.flags["luxurious-summons"].gmOverrides` — GM writes directly (document
  authority; no broker). `updateActor` re-apply condition includes `gmOverrides` and its
  `-=`-deletion keys.

## Kill-switch semantics

Both world switches AND with the client escape hatches (`enablePIXIFilters`,
`enableDeathAnimations`) and gate LOCAL PLAYBACK / rendering only — never shared-flag clears
(the 0.4.6 lesson). `gmForceDisableFilters` short-circuits to tint-only in
`applyOverridesToToken` and detaches motion tickers.

## UI

Three `.luxsum-restyle-group` blocks in the tab (control primitives reused from restyle.css —
verified standalone selectors): Global Controls (master toggle, brass dial 0–150%, two kill
switches), collapsible Per-Template Motion (rows for templates with active companions +
show-all disclosure; Off/Subtle/Default/Lively vocabulary shared with Restyle via the now-exported
`PRESET_INTENSITY`), and the Active Companions roster (player-filter chips in user colors,
GM cards with Sheet / cross-scene Pan / Restyle / Motion-freeze / Dismiss). Roster data comes
from scanning `game.actors` (authoritative), not the player-scoped user-flag index. Live
refresh via createActor/deleteActor/updateActor hooks while the tab is open.
