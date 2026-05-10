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

**v0.1.0** — Simulacrum vertical slice. A player can spawn / dismiss / repair a Simulacrum end-to-end with HP halving, no natural HP recovery, frozen spell slots, and an icyShatter death animation.

Roadmap (subsequent releases):
- **Plan 2** — visual customization (per-spawn override, live restyle dialog)
- **Plan 3** — 11 more shipped templates (Find Familiar, Echo Knight Echo, Beast Companion, Animate Dead, Mage Hand, etc.) + Replicate-generated assets
- **Plan 4** — GM Console + Templates editor + GM-approval mode
- **Plan 5** — full Luxurious aesthetic polish + 1.0 ship

## How to use (v0.1.0)

1. Click the ghost icon on the left scene controls.
2. Open the **Spawn New** tab → click the Simulacrum card.
3. Click **Place** → drag your cursor on the canvas → click a free tile.
4. The Simulacrum spawns with pale-blue tint + cyan glow + 85% alpha; it lives in a `<your character>'s Companions` folder in the Actor sidebar.
5. Open **My Companions** to see / dismiss / repair it.

## Limitations in v0.1.0

- Only Simulacrum. Other templates land in Plan 3.
- Visual customization is template-defaults only — per-spawn and live-restyle overrides land in Plan 2.
- D-mode (GM-approval-required spawning) is not yet wired even though the toggle exists in settings — Plan 4.
- All Companions and Templates tabs are stubs — Plan 4.
- Simulacrum thumbnail is a placeholder; final art via Replicate in Plan 3.

## License

MIT.
