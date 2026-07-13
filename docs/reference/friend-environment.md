# Friend's Foundry environment — module stack reference

Screenshots (`friend-module-list-2026-05-17-a.png` / `-b.png`) captured 2026-05-17 from
the friend's Module Management screen. Luxurious Summons showed **v0.1.5** installed at
capture time. Runtime: Foundry V13 build 351 + dnd5e 5.2.1.

These files previously sat in `assets/examples/` — which the ZIP build stages wholesale —
so they shipped inside the 0.4.3–0.4.5 distribution ZIPs (~400 KB of the 480 KB artifact).
Moved here 2026-07-13; `docs/` is excluded from the staging copy.

## Compatibility-relevant modules in the stack

| Module | Version | Why it matters to us |
|---|---|---|
| **Midi QOL** | 13.0.33 | Wraps the entire dnd5e activity/roll workflow. Our `dnd5e.postUseActivity` spell-trigger must be live-verified under Midi — Midi can reorder or wrap activity hooks. Top suspect if "casting the spell doesn't open the picker" ever regresses. |
| **DFreds Convenient Effects** | 8.2.4 | Applies Active Effects to tokens; could interact with our PIXI filter chain visually (tint stacking). |
| **Automated Animations** + **Sequencer** + **JB2A** | 6.5.3 / 3.6.11 / 0.8.6 | Play their own spawn/cast animations on token creation and item use. Our spawn animations (`drawToken` hook) may double up with AA's on-create effects. If the friend reports "two animations on spawn", AA is why. |
| **Active Token Effects** | v1.1.0 | Mutates token appearance via effects — same surface as our visual-filters overrides. |
| **socketlib** | v1.1.3 | Present, but we deliberately use the chat-broker pattern instead of sockets. |
| **libWrapper** | 1.13.4.0 | Present; other modules patch core methods through it. We don't use it — if a core method we rely on behaves oddly, another module may have wrapped it. |
| **DDB-Importer** | 6.6.44 | Imports non-SRD content from D&D Beyond — this is how Tasha's "Summon Draconic Spirit" (the original spell name) can exist in their world alongside dnd5e-2024's "Summon Dragon". Trigger matching must accept both names. |
| **Token Attacher** / **Token Mirror Button** / **Monk's modules** | various | Token-manipulation surface; low risk but worth remembering when a token behaves oddly. |
| **Vision 5e** | 3.0.7 | Vision/detection overrides — relevant if invisible-companion visibility questions come up. |

## Takeaways

- The stack is **heavily automated** — assume every dnd5e hook we listen to also has 2–3
  other listeners, and every token draw/update has other modules touching the mesh.
- Never diagnose a live bug without asking which modules were enabled; a minimal-modules
  repro (disable AA/Midi first) is the fastest way to split "our bug" from "interaction bug".
