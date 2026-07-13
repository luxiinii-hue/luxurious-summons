// scripts/outline-filter.js — vendored fallback outline filter (v0.4.7 FIX 3)
//
// Live evidence: the friend's Foundry V13 build 351 ships a PIXI build with
// NEITHER `PIXI.filters.OutlineFilter` NOR `PIXI.OutlineFilter` — every outline
// control (Simulacrum's icy rim, Mage Hand's cyan rim, the Restyle Outline
// group) silently did nothing on the production runtime, with only a
// console.warn to show for it.
//
// This is a minimal, dependency-free PIXI v7 `PIXI.Filter` subclass —
// classic 8-direction alpha-sampling outline. It samples the sprite's own
// alpha channel at 8 offsets scaled by `thickness` (in texel units, via the
// PIXI v7 `inputSize.zw` reciprocal-texel-size trick). Where the current
// fragment is transparent but any neighbor is opaque, it emits the outline
// color; otherwise it passes the original fragment through unchanged.
//
// getLuxOutlineFilterClass() lazily defines the class on first call instead
// of `class X extends PIXI.Filter` at module scope. Two reasons: (1) this
// file is transitively imported by visual-filters.js, which pure-logic tests
// (lux-visual-overrides.test.js) import under node:test where no PIXI global
// exists — a module-scope `extends PIXI.Filter` throws ReferenceError at
// import time, well before any test that actually needs a filter runs; (2)
// it's also more defensively correct in Foundry itself not to assume PIXI is
// already global at ES-module-graph-evaluation time.
//
// Constructor signature intentionally matches how visual-filters.js builds
// PIXI's real OutlineFilter today: `new Outline(thickness, colorHex)`.
//
// This is a FALLBACK ONLY — visual-filters.js tries the real implementations
// first and only reaches for LuxOutlineFilter when neither is present. If
// this vendored shader ever fails to compile on some exotic renderer, the
// caller wraps construction in try/catch and skips the outline entry rather
// than letting a shader-compile failure break the whole filter chain.

const VERTEX_SRC = `
attribute vec2 aVertexPosition;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

uniform vec4 inputSize;
uniform vec4 outputFrame;

vec4 filterVertexPosition(void) {
    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;
    return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aVertexPosition * (outputFrame.zw * inputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const FRAGMENT_SRC = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform float thickness;
uniform vec3 outlineColor;

void main(void) {
    vec4 own = texture2D(uSampler, vTextureCoord);
    if (own.a > 0.0) {
        gl_FragColor = own;
        return;
    }

    // inputSize.zw is the reciprocal texel size (1/width, 1/height) — the
    // standard PIXI v7 filter convention for converting a pixel-space
    // thickness into texture-coordinate offsets.
    vec2 texel = inputSize.zw * thickness;

    float maxNeighborAlpha = 0.0;
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2( texel.x,  0.0)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2(-texel.x,  0.0)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2( 0.0,  texel.y)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2( 0.0, -texel.y)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2( texel.x,  texel.y)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2(-texel.x,  texel.y)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2( texel.x, -texel.y)).a);
    maxNeighborAlpha = max(maxNeighborAlpha, texture2D(uSampler, vTextureCoord + vec2(-texel.x, -texel.y)).a);

    if (maxNeighborAlpha > 0.0) {
        gl_FragColor = vec4(outlineColor * maxNeighborAlpha, maxNeighborAlpha);
    } else {
        gl_FragColor = vec4(0.0);
    }
}
`;

function hexToVec3(hex) {
  // Number.isFinite (not `|| fallback`) so 0x000000 stays black instead of
  // falling through to white.
  const n = Number.isFinite(Number(hex)) ? Number(hex) : 0xffffff;
  return new Float32Array([
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255
  ]);
}

let _LuxOutlineFilterClass = null;

/**
 * Lazily defines and returns the LuxOutlineFilter class. PIXI.Filter is only
 * dereferenced the first time this is actually called (i.e. when the real
 * OutlineFilter implementations are both absent) — never at module-import
 * time. Throws naturally if PIXI.Filter itself is somehow unavailable; the
 * caller in visual-filters.js wraps this in try/catch per FIX 3's contract.
 */
export function getLuxOutlineFilterClass() {
  if (_LuxOutlineFilterClass) return _LuxOutlineFilterClass;

  class LuxOutlineFilter extends PIXI.Filter {
    /**
     * @param thickness  outline thickness in pixels
     * @param color      outline color as a 0xRRGGBB integer
     */
    constructor(thickness = 2, color = 0xffffff) {
      super(VERTEX_SRC, FRAGMENT_SRC, {
        thickness: Math.max(0, Number(thickness) || 0),
        outlineColor: hexToVec3(color)
      });
      // padding tells PIXI's filter system to sample slightly outside the
      // sprite's own bounds so the outline isn't clipped at the edge.
      this.padding = Math.ceil(Math.max(0, Number(thickness) || 0));
    }

    get thickness() {
      return this.uniforms.thickness;
    }
    set thickness(value) {
      this.uniforms.thickness = Math.max(0, Number(value) || 0);
      this.padding = Math.ceil(this.uniforms.thickness);
    }

    get color() {
      return this.uniforms.outlineColor;
    }
    set color(hex) {
      this.uniforms.outlineColor = hexToVec3(hex);
    }
  }

  _LuxOutlineFilterClass = LuxOutlineFilter;
  return _LuxOutlineFilterClass;
}
