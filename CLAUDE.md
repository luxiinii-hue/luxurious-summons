<!-- Module-local notes for luxurious-summons. -->

# luxurious-summons — module-local notes

## Repo arrangement

This module is its own git repo, living at `modules/luxurious-summons/` inside the parent Laps workspace. The parent repo `.gitignore`s this directory so commits here are independent — no branch-switch interference from concurrent work on other modules in the parent repo.

## Module conventions

- Test files live in `tests/` inside this repo, prefixed `lux-*.test.js`.
- Run tests via `npm test` from inside this directory (or `node --test`).
- All console logs prefixed `[luxurious-summons]` so the user can pipe a clean log trail when reporting issues.
- Companion record state lives on `actor.flags["luxurious-summons"]` (canonical); user flag `user.flags["luxurious-summons"].activeCompanions` is a fast index regenerated from authoritative state on init.
- Chat-broker pattern (chat messages with module flags) used for player↔GM coordination — never `game.socket.emit` (per parent workspace CLAUDE.md gotcha).

## Spec & plan (in parent Laps workspace)

- Spec: `../../docs/superpowers/specs/2026-05-10-luxurious-summons-design.md`
- Plan: `../../docs/superpowers/plans/2026-05-10-luxurious-summons.md`

Plan 1 (Foundation + Simulacrum vertical slice) targets v0.1.0.

## V14 gotchas

The parent workspace's `../../CLAUDE.md` holds the universal Foundry-V14 / project-tooling gotchas. Read it before doing any module work — it covers ApplicationV2 traps, V14-specific Handlebars, scene-control wiring, FilePicker, PIXI, ChatMessage, settings scope, and other already-paid-for lessons.
