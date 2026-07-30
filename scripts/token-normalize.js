// scripts/token-normalize.js — companion token defaults
//
// Companions are cloned from dnd5e stat blocks, and those ship prototypeToken
// settings that are actively wrong for a *summon*. Verified against dnd5e
// release-5.2.1, packs/_source/monsters/undead/skeleton.yml:
//
//   disposition: -1   (HOSTILE)
//   actorLink: false
//
// Both are correct for a monster the GM drops as an enemy, and both are bugs
// the moment the same stat block becomes a player's companion:
//
//   • disposition -1 draws the red hostile ring on a token the player owns,
//     and every automation module on the table reads it as an enemy —
//     Midi QOL target filtering, Automated Animations disposition rules,
//     "attack nearest hostile" helpers. The friend's stack is automation-heavy
//     (docs/reference/friend-environment.md), so this is not cosmetic.
//
//   • actorLink false routes damage into a per-token TokenDelta instead of the
//     Actor. Each companion already has its OWN dedicated Actor document, so
//     there is nothing to gain from an unlinked token — and everything to lose:
//     every HP readout in this module (Manager companion card, GM Console
//     roster) reads actor.system.attributes.hp, which would sit at full health
//     forever while the token on canvas is nearly dead. This is the
//     linked-vs-unlinked trap documented in the workspace CLAUDE.md.
//
// Pure function — no Foundry globals — so the rules are unit-testable.

// CONST.TOKEN_DISPOSITIONS
export const DISPOSITION = { SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 };

// CONST.TOKEN_DISPLAY_MODES — ordered by increasing visibility, which is what
// makes the Math.max() below meaningful ("at least this visible").
export const DISPLAY = { NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50 };

/**
 * Apply companion-appropriate defaults to cloned prototypeToken data.
 *
 * @param {object} prototypeToken  raw prototypeToken data from the cloned stat block
 * @param {object} [opts]
 * @param {number} [opts.disposition]  override (world setting / template); defaults to FRIENDLY
 * @returns {object} a new prototypeToken object — the input is not mutated
 */
export function normalizeCompanionTokenData(prototypeToken = {}, opts = {}) {
  const disposition = Number.isInteger(opts.disposition) ? opts.disposition : DISPOSITION.FRIENDLY;

  return {
    ...prototypeToken,
    actorLink: true,
    disposition,
    // A player running four identical Skeletons needs to tell them apart
    // without opening sheets, and to read their companion's health mid-combat
    // at a glance. Math.max so a stat block that was already MORE visible
    // (e.g. displayName: ALWAYS) keeps its setting — we raise the floor only.
    displayName: Math.max(prototypeToken.displayName ?? 0, DISPLAY.OWNER_HOVER),
    displayBars: Math.max(prototypeToken.displayBars ?? 0, DISPLAY.OWNER),
    // Inline-synthesized templates (Mage Hand, Echo Knight Echo) build their
    // prototypeToken from scratch and may not declare a bar attribute at all,
    // which would leave displayBars pointing at nothing.
    bar1: prototypeToken.bar1?.attribute ? prototypeToken.bar1 : { attribute: "attributes.hp" }
  };
}
