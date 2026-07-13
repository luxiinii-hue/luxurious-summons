// scripts/anim-state.js — tracks which token ids currently have a module-owned
// PIXI animation (spawn or death) actively mutating their mesh.
//
// Pure logic, no Foundry imports — unit-tested directly.
//
// Why this exists (v0.4.6 FIX 1): the motion ticker (visual-filters.js) and the
// spawn/death animations (spawn-animations.js / death-animations.js) both write
// to `token.mesh.alpha` / `.scale` / `.position` per-frame. Without coordination,
// whichever ran last on a given frame wins, and — worse — the motion ticker's
// LAZY BASE SNAPSHOT (first-tick capture of mesh.alpha/scale, see v0.3.2) can
// capture the mesh mid-animation (e.g. alpha ≈ 0 right after hexCrystalForm sets
// mesh.alpha = 0 to start its fade-in). Once that poisoned base is captured, the
// motion ticker pins the mesh back to it forever — permanently invisible token.
//
// The fix: treat `isAnimating(token.id)` exactly like Foundry's own
// `token._animation` guard in the motion ticker — skip the frame AND defer the
// base snapshot until the module animation has finished and cleared the flag.

const _animatingTokenIds = new Set();

export function markAnimating(tokenId) {
  if (!tokenId) return;
  _animatingTokenIds.add(tokenId);
}

export function clearAnimating(tokenId) {
  if (!tokenId) return;
  _animatingTokenIds.delete(tokenId);
}

export function isAnimating(tokenId) {
  return _animatingTokenIds.has(tokenId);
}
