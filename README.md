# Luxurious Summons

A Foundry VTT module for **D&D 5e** that turns summoning from bookkeeping into a
first-class part of play. Cast the spell, pick your creature, click a tile — the
companion appears with the right stat block, the right art, and a spawn
animation. Everything afterwards is managed from one dialog.

- **Foundry:** V13 minimum, V14 verified
- **System:** dnd5e v3+ (developed and tested against 5.2.1)

---

## Install

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/luxiinii-hue/luxurious-summons/releases/latest/download/module.json
```

That's the whole process. Every later release then appears as a one-click
**Update** in Module Management — no downloads, no ZIP files to unpack, nothing
for your antivirus to be suspicious of.

Open it from the ghost icon in the left scene-controls toolbar.

---

## What it does

### Summon

Cast Find Familiar, Animate Dead, Mirror Image, Summon Dragon — or any of the 23
supported summons — and the picker opens on its own. Choose a variant, choose
how many, click to place. The spell-slot level is read from the actual cast, so
upcasting scales the creature.

Each companion is cloned into its own actor, filed in a folder named after its
summoner, owned by the summoning player, and tagged so the module can clean up
after itself. Summons arrive Friendly and actor-linked, so combat automation
treats them as allies and their health tracks properly everywhere.

### Control

The **Companion Bar** sits above the hotbar: your character, then every
companion you own.

| Action | Result |
|---|---|
| Click | Select that token and pan to it |
| Shift-click | Add to the selection — move a whole skeleton pack in one drag |
| Double-click | Open the sheet |
| `Alt+C` | Cycle to the next companion |
| `Alt+Shift+C` | Select every companion at once |

It collapses to a badge, and switches off entirely in **Manager → Settings** if
you'd rather not have it.

### Customize

Any companion can be restyled live on the canvas — tint, brightness,
transparency, outline, shimmer, and an idle motion profile (a familiar that
bobs, a spectral hand that drifts, a simulacrum that flickers). Changes apply as
you drag and save themselves.

### Run the table

The GM gets an **All Companions** console: a master switch and intensity dial
for idle animations world-wide, per-template overrides, per-companion freezes,
two kill switches, and Sheet / Pan / Restyle / Dismiss on every companion at the
table. GM settings always win over a player's own.

The **Templates** editor renames anything, swaps thumbnails, and re-links stat
blocks by UUID — which is how the nine subscriber-content templates get
connected to your own imported creatures.

Optionally, require GM approval before any summon resolves.

---

## The roster

23 templates, backed by official 2024 stat blocks wherever they exist.

- **Conjurations** — Mage Hand · Unseen Servant · Spiritual Weapon · Arcane Hand · Mirror Image · Flaming Sphere · Phantom Steed
- **Companions** — Find Familiar (15 SRD familiars) · Pact of the Chain (4) · Find Steed (3) · Echo Knight's Echo
- **Undead** — Animate Dead (Skeleton, Zombie, up to four at once)
- **Simulacrum** — half HP, frozen spell slots, no natural recovery, a Repair action, and an icy shatter when it dies
- **Summon X** — Dragon (5 elemental variants × 4 tiers), plus Beast, Fey, Shadowspawn, Undead, Aberration, Construct, Elemental, Celestial and Fiend for tables that own the subscriber content

The Summon X family ships unlinked by design — the stat blocks aren't in the
free packs. Point them at your own imported actors in the Templates editor.

---

## Settings worth knowing

| Setting | Default | Why you'd change it |
|---|---|---|
| Companion token disposition | Friendly | Neutral keeps summons out of "all allies" automation |
| Require GM approval | Off | Turns every summon into an approve/deny chat card |
| Global cap per player | 10 | Hard ceiling regardless of per-template limits |
| Token effects on this client | On | Performance escape hatch — affects only you |
| Token outlines (experimental) | **Off** | See below |

**On outlines:** some Foundry builds ship no outline filter, so this module
carries its own. That shader is unverified on live hardware and previously
caused summons to render as invisible, so it ships off. Leave it off unless
you're deliberately testing it.

---

## Troubleshooting

**A summon appeared but I can't see it.** Turn on *Disable ALL token effects* in
Manager → All Companions. If the token comes back, the filter chain is the
culprit — leave that off and open an issue.

**A player summoned and nothing happened.** Companions are created by a GM's
client, so one needs to be connected. If none is, you'll get a notification
saying exactly that rather than silence.

**Which version am I running?** It's in the Companion Manager's title bar, and
in the browser console at startup.

**A companion's token can't be selected.** Usually stale art baked into an old
document. The module runs a repair sweep at startup on the GM's client; reload
once with the GM connected.

---

## Development

```bash
npm test        # node:test pure-logic suite, no dependencies
```

Foundry-coupled code (dialogs, PIXI, hooks, sockets) is verified manually in a
running world; the unit tests cover the pure kernels — restrictions, motion
profiles, template merging, GM precedence, token normalization, naming.

---

## License & credits

MIT (see `LICENSE`).

Stat blocks, token art, and icons referenced from the **dnd5e** system belong to
their respective owners; this module links to them rather than redistributing
them. The custom companion art in `assets/` was generated for this module.

Built for one table, shared in case it's useful to yours.
