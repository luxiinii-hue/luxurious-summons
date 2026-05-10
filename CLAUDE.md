<!-- Module-local notes for luxurious-summons. Self-contained for sessions running with this dir as cwd. -->

# luxurious-summons — module-local notes

## What this module is

A Foundry VTT V14 module for D&D 5e companion-management. Players spawn and control "summon"-style companions (Simulacrum first; Mirror Image, Find Familiar, Echo Knight Echo, Beast Companion, Animate Dead, Mage Hand, Unseen Servant, etc. coming in Plan 3). Visual customization via PIXI filters. Per-template fancy death animations. Click-to-place placement overlay with occupancy detection. Per-master folder organization in the actor sidebar.

## Repo arrangement

This module is its **own git repo**, living at `modules/luxurious-summons/` inside the parent `Laps` workspace. The parent repo `.gitignore`s this directory so commits here are independent — no branch-switch interference from concurrent work on other modules in the parent (e.g., `emote-wheel`, which the user iterates on simultaneously in their IDE).

When invoked with this dir as cwd, **the parent `Laps/CLAUDE.md` does NOT auto-load**. Everything you need to know to work effectively here lives in this file or in the spec/plan paths referenced below. Cross-module reads (e.g., looking at `emote-wheel`) require explicit relative paths and should be intentional, not incidental.

## Status (as of 2026-05-10)

**Plan 1 (Foundation + Simulacrum vertical slice) is functionally complete through v0.1.5.** Awaiting friend's live-Foundry verification.

| Version | What landed |
|---|---|
| 0.1.0 | Plan 1 ship: spawn / dismiss / repair Simulacrum end-to-end; HP halve, block natural recovery, snapshot spell slots; icyShatter death animation; per-master folder; chat-broker; placement overlay; PIXI filter chain; manager skeleton |
| 0.1.1 | Companion-card quick-access (Open Sheet, Select & Pan, Combat); sheet decoration banner identifying companion sheets at a glance |
| 0.1.2 | Fix scene-control crash — V14 needs `tools` collection on every control |
| 0.1.3 | Fix manager not opening — V14 ApplicationV2 needs `HandlebarsApplicationMixin` |
| 0.1.4 | Cast Simulacrum spell auto-opens Spawn dialog (dnd5e.useItem hook + triggerSpell field) |
| 0.1.5 | Fix manager not rendering — V14 PARTS require single root element. Wrap manager.hbs + spawn.hbs in single root div; switch manager body to flex layout (drops fragile `calc(100% - 50px)`) |

**33 unit tests passing.** Distribution ZIPs in `../../dist/luxurious-summons-X.Y.Z.zip`.

**Next step depends on feedback:**
- If friend reports a bug: reproduce minimally, fix in inner repo, bump patch version (0.1.5+), commit + tag + new ZIP.
- If Plan 1 stable: kick off Plan 2 (visual customization UI — per-spawn override + live Restyle dialog).

## User preferences

- **Quality over speed.** Verify outputs before claiming done. For UI work, build a standalone HTML preview using the actual CSS and iterate visually before porting changes back, when the user can't easily test in live Foundry. The user explicitly said: "please work slowly and check your work to make it work well and look great."
- **Be genuinely critical.** Push back, don't glaze. Suggest better approaches. Go back and forth on design decisions rather than accepting the first one.
- **Verify in live Foundry.** Self-host or live-Foundry verification is on the user's friend (he hosts). Build verbose `[luxurious-summons]` `console.log` instrumentation into dialog-open / hook / socket / broker paths so the user can paste a clear log trail when something fails.
- **System target:** D&D 5e (dnd5e v3+). Module logs warning + disables spawn on other systems.

## Module conventions

- **Test files** in `tests/` prefixed `lux-*.test.js`. Run via `npm test` (`node --test`, no npm deps). 33 tests as of v0.1.4.
- **All console logs** prefixed `[luxurious-summons]` so a clean log trail is paste-friendly.
- **Companion record state** on `actor.flags["luxurious-summons"]` (canonical); `user.flags["luxurious-summons"].activeCompanions` is a fast index regenerated from authoritative state on world init.
- **Chat-broker pattern** (chat messages with module flags) for player↔GM coordination — never `game.socket.emit` (drops messages silently in V14 with no error trace).
- **Distribution ZIP** via PowerShell:
  ```powershell
  $src = "<repo>\modules\luxurious-summons"
  $out = "<repo>\dist\luxurious-summons-<version>.zip"
  Compress-Archive -Path $src -DestinationPath $out -Force
  ```

## Spec & plan (in parent Laps workspace)

- **Spec:** `../../docs/superpowers/specs/2026-05-10-luxurious-summons-design.md` — 14 sections + 24-entry Decisions log, ~750 lines. Read end-to-end before non-trivial design changes.
- **Plan:** `../../docs/superpowers/plans/2026-05-10-luxurious-summons.md` — Plan 1 detailed (~30 tasks) + Plans 2-5 high-level roadmap.
- Read with `cat ../../docs/superpowers/specs/...` from this dir; the Read tool also accepts the relative path.

## Surrounding workspace — when you need more context

The parent `Laps` workspace (one dir up: `../`) holds adjacent context that this module's repo doesn't duplicate. **It's fine to read from it when you need broader project context — just don't write into it from this session, and don't accidentally treat its branches as relevant to this module.**

| Path | What's there | When to consult |
|---|---|---|
| `../../CLAUDE.md` | Parent project CLAUDE.md (universal Foundry/V14 conventions, build tooling, image-processing pipeline) | If something here references "the parent CLAUDE.md" and you need the original wording, or if you suspect a V14 gotcha not yet captured here |
| `../../docs/superpowers/specs/` | Design specs for both modules (this one + emote-wheel) | Spec is the canonical source for design intent |
| `../../docs/superpowers/plans/` | Implementation plans for both modules | Plan 1 detailed + Plans 2-5 roadmap |
| `../../dist/` | Distribution ZIPs (gitignored in parent) for all modules | Verify the latest shipped ZIP for this module (`luxurious-summons-X.Y.Z.zip`) |
| `../emote-wheel/` | The other Foundry module in the workspace, system-agnostic emote selector | Cross-pattern reference: how does emote-wheel solve scene controls / dialogs / chat-broker / sprite anchoring? Patterns may transfer (V14 gotchas overlap) — but the user is actively iterating on emote-wheel, so don't modify |
| `../emote-wheel/CLAUDE.md` | emote-wheel's module-local notes | Reference if a pattern was paid for there |
| `../../tests/` | emote-wheel's test files (this module's tests live in this repo's `tests/`) | Don't run from this dir's `npm test` — that runs only this module's tests |
| `../../tools/` | Dev scripts (e.g., `crop-defaults.sh` for emote-wheel asset prep) | Not relevant to this module |
| `../../package.json` | Parent's npm config — minimal, just runs `node --test` from project root for emote-wheel's tests | Don't need it; this repo has its own `package.json` |

**Rule of thumb:** if asking yourself "is this part of luxurious-summons or the parent workspace?", check the path. Anything inside this repo's working tree is luxurious-summons; anything reachable via `../..` belongs to the parent workspace and is a context resource, not implementation territory.

## Foundry V14 gotchas (paid for in bugs)

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

### Promise idempotence

- Any fire-once callback that can be triggered from multiple paths needs a `_finished` flag guard.

## Architecture quick-reference

```
scripts/
├── main.js              ← module entry, hook registration
├── settings.js          ← 8 world + 4 client settings
├── data-model.js        ← companion record schema, validators, flag helpers, user-flag index regen
├── chat-broker.js       ← player↔GM coordination via chat-message flags + electPrimaryGM
├── spawn-engine.js      ← checkRestrictions (pure) + performSpawn (broker handler) + ensureMasterFolder
├── spawn-flow.js        ← runSpawnFlow shared by Manager + spell-trigger
├── lifecycle.js         ← detectHpDeath (pure) + HP=0 hooks + master-deletion prompt + runDeathAndCleanup
├── visual-filters.js    ← describeFilters (pure) + buildFilters (PIXI) + applyFiltersToToken
├── placement-overlay.js ← isCellBlocked (pure) + activatePlacement (PIXI ghost preview)
├── death-animations.js  ← icyShatter, softFade (more in Plan 3)
├── dnd5e-mods.js        ← computeModUpdates (pure) + applyDnd5eMods + installDnd5eHooks
├── spell-trigger.js     ← dnd5e.useItem hook → runSpawnFlow
├── sheet-decorator.js   ← renderActorSheet hook → Luxurious banner + .luxsum-companion-sheet class
├── manager-app.js       ← Manager dialog (5 tabs, role-gated)
├── spawn-app.js         ← Spawn Dialog (modal)
├── templates-builtin.js ← Simulacrum template (other 11 in Plan 3)
└── handlers/
    ├── index.js         ← handler registry + callHandler
    └── simulacrum.js    ← Repair action + onAfterSpawn (spell-slot snapshot)
```

## How to resume in a new session

1. **Read this file** + the spec + plan (in `../../docs/superpowers/`).
2. **`npm test`** — should print 33/33 passing.
3. **`git log --oneline | head -10`** — see recent commits + tags.
4. **`ls ../../dist/luxurious-summons-*.zip`** — see latest distribution ZIPs.
5. If iterating on a bug from the friend's report: reproduce, fix, bump patch, commit, tag, new ZIP.
6. If Plan 1 confirmed stable: kick off Plan 2 by reading the plan's "Plan 2" roadmap section.

## Asset generation (Plan 3)

Mage Hand + Unseen Servant tokens + 13 template thumbnails — generate via Replicate via the asset-planner agent (in parent's user agents at `~/.claude/agents/asset-planner.md`). Prompts in spec §9 / E.2.
