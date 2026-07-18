# Plan 4 completion design record (v0.7.0 — Templates editor + D-mode approval)

Closes Plan 4 (slices 2+3; slice 1 = GM Console shipped in 0.6.0). User decisions (2026-07-19):
editor scope = built-in editing + the Summon X subscriber unlock; D-mode placement = player
pre-places, approval spawns at the chosen spot.

## Effective-template layer (`scripts/template-store.js`)

Builtin templates stay immutable shipped data; GM edits live in the `templateOverrides` world
setting (same per-template namespace as the GM Console's motion keys — sibling keys coexist).
`mergeTemplateOverrides(template, override)` (pure, 10-test suite) applies: `nameOverride`,
`thumbnailOverride`, `variantOverrides[vid] = { name, thumbnail, uuid, removed }`,
`customVariants[]`. Every consumer (manager, picker via callers, spell-trigger's
`handleItemUse`, spawn-engine, lifecycle, heal-sweep, sheet-decorator, restyle) now resolves
through `getEffectiveTemplate(s)()`; `findTemplatesByItem` keeps its injectable default for
tests. The EDITOR renders from the RAW builtin + override entry (not the merged view) so
removed variants stay restorable.

## Summon X subscriber templates

Nine templates (summon-beast/fey/shadowspawn/undead/aberration/construct/elemental/celestial/
fiend, 14 → 23 total) generated from a spec table. `source: { mode: "compendium",
requiresLink: true, substituteSpellLevel: true, baseSpellLevel }` — the spirit stat blocks are
subscriber content reachable only via the world's DDB imports, so they ship with a single
null-uuid "spirit" variant. `templateNeedsLink`/`variantHasLink` (template-store) drive an
"Unlinked" badge in the editor and a "Not linked — the GM connects this stat block in
Manager → Templates" ineligibility reason in the picker. World-actor uuids (`Actor.xyz`) work
as well as compendium uuids — `fromUuid` resolves both; the editor's per-row **Test** button
verifies a link and prints the resolved actor's name.

## D-mode approval (`scripts/approval.js`)

`needsGmApproval({ isGM, requireAll, templateRequires })` — pure, GM always exempt. Flow:
placement completes normally, THEN the gate decides "spawn now" vs "post approval card". The
card (player-created chat message, whispered to GMs + requester) carries the full performSpawn
payload including coordinates in message flags. Buttons wired via BOTH `renderChatMessage`
(V13/jQuery) and `renderChatMessageHTML` (V14/HTMLElement), GM-gated; Approve runs
`performSpawn(payload)` on the clicking GM's client (no broker hop — the click is the
election), Deny just resolves; either way the card re-renders decided and the requester gets a
whispered verdict. Anti-spam timestamps count approval REQUESTS so card-flooding is capped.
Known accepted trade-offs: denied requests don't refund the spell slot (slot burns at cast per
the v0.1.x RAW decision); a sub-millisecond two-GM race could double-spawn (buttons disable on
click + live-status re-read closes the practical window).

## Also

Settings tab stub replaced with an "Open module settings" shortcut + pointer to the console.
Editor accordion state and per-row link-test results are client-local UI state only.
