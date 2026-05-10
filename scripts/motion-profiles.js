// scripts/motion-profiles.js — Named motion profile catalog.
//
// Each profile is a pure function (t, intensity) → { dx, dy, dRotation, dScale, dAlpha }
// returning per-frame transform deltas applied on top of the token's base state.
//
//   t          : seconds since the profile started running on this token (float)
//   intensity  : multiplier from `motionOverrides.intensity`; 0 = no motion, 1 = template default
//
// All deltas are bounded so peak magnitude × intensity stays well below the values that would
// look jarring on a typical 100×100 token sprite. Tuning constants are paid for in the design
// spec §3.3 — change with care, they affect every token using the profile.
//
// The motion ticker calls one profile per frame per token; profiles are intentionally cheap
// (a few trig ops, no allocations besides the returned object).

const TAU = Math.PI * 2;

export const motionProfiles = {
  // No motion. Used as the safe fallback for unknown profile names and for templates that
  // shouldn't animate (e.g. classic skeletons in Animate Dead).
  none: (_t, _intensity) => ({ dx: 0, dy: 0, dRotation: 0, dScale: 0, dAlpha: 0 }),

  // Mage Hand. Gentle vertical bob with a slow rotational sway and tiny scale breathing.
  // Reads as "a hand of force casually floating in mid-air."
  "floating-hand": (t, intensity) => ({
    dx: 0,
    dy: Math.sin(t * 1.2) * 4 * intensity,
    dRotation: Math.sin(t * 0.6) * 0.05 * intensity,
    dScale: Math.sin(t * 0.9) * 0.02 * intensity,
    dAlpha: 0
  }),

  // Unseen Servant, Echo Knight Echo. Slow horizontal drift + alpha breathing.
  // Reads as "an arcane presence not quite anchored to a single point."
  "ethereal-drift": (t, intensity) => ({
    dx: Math.sin(t * 0.4) * 3 * intensity,
    dy: 0,
    dRotation: 0,
    dScale: 0,
    dAlpha: Math.sin(t * 0.5) * 0.08 * intensity
  }),

  // Mirror Image. High-frequency micro-jitter on position with two incommensurable frequencies
  // so the motion never quite repeats — reads as uncanny / "this might not be real."
  "mirror-wobble": (t, intensity) => ({
    dx: (Math.sin(t * 8) + Math.sin(t * 11.3)) * 0.5 * intensity,
    dy: (Math.cos(t * 9.1) + Math.sin(t * 12.7)) * 0.4 * intensity,
    dRotation: 0,
    dScale: 0,
    dAlpha: 0
  }),

  // Familiars, Beast Companions, Drakes. Slow scale pulse — subtle "breathing" effect.
  "idle-breathing": (t, intensity) => ({
    dx: 0,
    dy: 0,
    dRotation: 0,
    dScale: Math.sin(t * 0.8) * 0.03 * intensity,
    dAlpha: 0
  }),

  // Simulacrum, Wildfire Spirit (future). Alpha + brightness micro-oscillation reads as
  // "the surface is shimmering with cold magical energy" or "this thing is alight."
  // For Simulacrum specifically: keeps the token visually still but visibly "magical."
  "flame-flicker": (t, intensity) => ({
    dx: 0,
    dy: 0,
    dRotation: 0,
    dScale: 0,
    dAlpha: Math.sin(t * 14) * 0.05 * intensity + Math.sin(t * 6.5) * 0.03 * intensity
  })
};

// Safe lookup. Unknown names → `none` profile, logged once per session.
// The implementation file is shared between Foundry runtime (where `console.warn` works) and
// the standalone HTML preview / node test (also fine). No Foundry-only dependencies.
const _warnedNames = new Set();
export function getMotionProfile(name) {
  const profile = motionProfiles[name];
  if (profile) return profile;
  if (!_warnedNames.has(name)) {
    _warnedNames.add(name);
    console.warn(`[luxurious-summons] unknown motion profile "${name}" — falling back to "none"`);
  }
  return motionProfiles.none;
}

// Available profile names — useful for the Advanced disclosure dropdown in the Restyle dialog.
export const motionProfileNames = Object.keys(motionProfiles);

// Bound estimate per profile — the maximum absolute value any delta can reach across all t,
// for a given intensity. Used by tests to verify profiles stay within sane bounds; useful
// for runtime sanity checks too.
export const motionProfileBounds = {
  none:             { dx: 0,   dy: 0,   dRotation: 0,    dScale: 0,    dAlpha: 0     },
  "floating-hand":  { dx: 0,   dy: 4,   dRotation: 0.05, dScale: 0.02, dAlpha: 0     },
  "ethereal-drift": { dx: 3,   dy: 0,   dRotation: 0,    dScale: 0,    dAlpha: 0.08  },
  "mirror-wobble":  { dx: 1,   dy: 0.8, dRotation: 0,    dScale: 0,    dAlpha: 0     },
  "idle-breathing": { dx: 0,   dy: 0,   dRotation: 0,    dScale: 0.03, dAlpha: 0     },
  "flame-flicker":  { dx: 0,   dy: 0,   dRotation: 0,    dScale: 0,    dAlpha: 0.08  }
};
