// scripts/handlers/mirror-image.js — Mirror Image post-spawn hook.
//
// RAW-flavor decision (per v0.5.0 spec): each of the 3 duplicates should
// LOOK like the caster, not like dnd5e's generic "Duplicate" stat block art
// (source: Compendium.dnd5e.actors24.Actor.phbDuplicate0000, img: '').
// Copies the caster's own token texture onto the duplicate's actor img +
// prototypeToken texture, mirroring the echo-knight-echo AC-copy pattern in
// spawn-engine.js performSpawn step 8.
//
// Called from spawn-engine.js performSpawn AFTER Actor.create() (step 8),
// BEFORE the token-placement step (step 9) — newActor.getTokenDocument()
// reads the actor's current img/prototypeToken, so this update must land
// before that call for the placed token to pick up the caster's art.

const MODULE_ID = "luxurious-summons";

/**
 * @param companion   the newly-created Duplicate actor
 * @param caster      the source actor being duplicated
 */
export async function onAfterSpawn(companion, caster) {
  const casterImg = caster.img;
  const casterTokenSrc = caster.prototypeToken?.texture?.src ?? casterImg;

  if (!casterImg && !casterTokenSrc) {
    console.log(`[${MODULE_ID}] mirror-image onAfterSpawn: caster "${caster?.name}" has no art to copy — leaving duplicate's default art`);
    return;
  }

  const updates = {};
  if (casterImg) updates.img = casterImg;
  if (casterTokenSrc) {
    updates["prototypeToken.texture.src"] = casterTokenSrc;
    // Preserve the Duplicate stat block's own scale/anchor/fit — only the
    // src changes, so a caster with an oddly-cropped portrait doesn't also
    // inherit unrelated texture transform values.
  }

  await companion.update(updates);
  console.log(`[${MODULE_ID}] mirror-image onAfterSpawn: copied caster "${caster?.name}" art onto duplicate "${companion?.name}" (${companion?.id})`);
}
