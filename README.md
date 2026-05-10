# Luxurious Summons

A Foundry VTT V14 module for managing playable companion characters in D&D 5e — clone-based summons (Simulacrum first; more coming), with deep visual customization and per-template fancy death animations.

## Install

1. Locate Foundry's User Data Path on the Setup screen.
2. Drop the `luxurious-summons` folder into `<UserData>/Data/modules/`.
3. Activate the module in your world (Game Settings → Manage Modules).
4. Click the new ghost icon in the left scene-controls toolbar to open the Companion Manager.

> Beware Windows "Extract All" — it sometimes nests one extra level. Verify the resulting path is `<UserData>/Data/modules/luxurious-summons/module.json`.

Requires the `dnd5e` system v3+.

## Status

**v0.1.1** — Simulacrum vertical slice + control polish. A player can spawn / dismiss / repair a Simulacrum end-to-end with HP halving, no natural HP recovery, frozen spell slots, and an icyShatter death animation. Quick-access buttons (Open Sheet, Select & Pan, Combat) on each companion card. The companion's character sheet gets a Luxurious-themed banner showing template + master + active mod badges so it's always obvious which sheet you're looking at.

Roadmap (subsequent releases):
- **Plan 2** — visual customization (per-spawn override, live restyle dialog)
- **Plan 3** — 11 more shipped templates (Find Familiar, Echo Knight Echo, Beast Companion, Animate Dead, Mage Hand, etc.) + Replicate-generated assets
- **Plan 4** — GM Console + Templates editor + GM-approval mode
- **Plan 5** — full Luxurious aesthetic polish + 1.0 ship

## How to use (v0.1.1)

### Spawning
1. Click the ghost icon on the left scene controls.
2. Open the **Spawn New** tab → click the Simulacrum card.
3. Click **Place** → drag your cursor on the canvas → click a free tile.
4. The Simulacrum spawns with pale-blue tint + cyan glow + 85% alpha; it lives in a `<your character>'s Companions` folder in the Actor sidebar.

### Controlling
1. Open **My Companions** tab. Each card shows the companion's portrait, HP, scene, and quick-access buttons.
2. **Click the card body** (or **Open Sheet** button) → opens the dnd5e character sheet. The sheet has a Luxurious banner at the top showing template + master so it's clear which sheet you're looking at.
3. **Select & Pan** → selects the token and pans the canvas to it (jumps you straight into control).
4. **Combat** → adds the companion to the active combat tracker (auto-rolls initiative); click again to remove.
5. Cast spells, attack, etc. via the standard dnd5e sheet — the Simulacrum has all the master's spells and items.

### Maintaining
- **Repair** → 100gp + 1hr ritual, rolls 4d6+24 healing (RAW Simulacrum repair). The only way to heal a Simulacrum.
- **Dismiss** → fade-out animation + delete. The companion is gone.
- HP=0 in combat → automatic icyShatter animation + delete. RAW Simulacrum is destroyed at 0 HP.

## Limitations in v0.1.1

- Only Simulacrum. Other templates land in Plan 3.
- Visual customization is template-defaults only — per-spawn and live-restyle overrides land in Plan 2.
- D-mode (GM-approval-required spawning) is not yet wired even though the toggle exists in settings — Plan 4.
- All Companions and Templates tabs are stubs — Plan 4.
- Simulacrum thumbnail is a placeholder; final art via Replicate in Plan 3.

## License

MIT.
