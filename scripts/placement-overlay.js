// scripts/placement-overlay.js — click-to-place ghost preview, occupancy check, sequential clicks.
//
// isCellBlocked is pure-logic AABB intersection (Task 11, unit-tested).
// activatePlacement is the Foundry-side PIXI overlay (Task 12, manual smoke test).

const MODULE_ID = "luxurious-summons";

/**
 * Pure-logic. True iff the proposed rectangle overlaps any placed-token rectangle.
 */
export function isCellBlocked(proposed, placedBounds) {
  for (const b of placedBounds) {
    const overlapX = proposed.x < b.x + b.width  && proposed.x + proposed.width  > b.x;
    const overlapY = proposed.y < b.y + b.height && proposed.y + proposed.height > b.y;
    if (overlapX && overlapY) return true;
  }
  return false;
}

let _activeOverlay = null;

/**
 * Begin a placement session. Resolves with array of {x, y, sceneId} placements
 * (length 0 to opts.count) when N done OR ESC pressed.
 *
 * @param opts.tokenWidth   width of token in pixels (e.g., grid.size)
 * @param opts.tokenHeight  height in pixels
 * @param opts.thumbnailSrc image to use for the ghost preview
 * @param opts.count        number of placements to collect
 * @param opts.label        text shown at top, e.g., "Select tile(s) to summon Simulacrum"
 */
export async function activatePlacement(opts) {
  if (_activeOverlay) {
    _activeOverlay.cancel();
  }
  // Probe the thumbnail URL before handing it to PIXI. PIXI.Sprite.from(url)
  // triggers an internal texture fetch that, on 404, fires an uncaught
  // promise rejection on the texture's error event. Resolving the existence
  // up front lets us pick a graceful fallback (gold-tinted rectangle) without
  // the console spam — paid for in v0.4.2 when asset thumbnails were still placeholders.
  let thumbExists = false;
  if (opts.thumbnailSrc) {
    try {
      const resp = await fetch(opts.thumbnailSrc, { method: "HEAD" });
      thumbExists = resp.ok;
    } catch {
      thumbExists = false;
    }
  }
  return new Promise((resolve) => {
    const placements = [];
    const scene = canvas.scene;
    const grid = canvas.grid;
    const layer = canvas.interface;

    let sprite;
    if (thumbExists) {
      sprite = PIXI.Sprite.from(opts.thumbnailSrc);
      sprite.width = opts.tokenWidth;
      sprite.height = opts.tokenHeight;
      sprite.tint = 0xffffff;
    } else {
      // Neutral placeholder — token-sized gold-tinted rectangle.
      const g = new PIXI.Graphics();
      g.beginFill(0xc9a14b, 0.4);
      g.drawRect(0, 0, opts.tokenWidth, opts.tokenHeight);
      g.endFill();
      g.lineStyle(2, 0xc9a14b, 0.8);
      g.drawRect(0, 0, opts.tokenWidth, opts.tokenHeight);
      sprite = g;
    }
    sprite.alpha = 0.6;
    layer.addChild(sprite);

    const indicator = new PIXI.Graphics();
    layer.addChild(indicator);

    const labelEl = document.createElement("div");
    labelEl.className = "luxsum-placement-label";
    labelEl.textContent = `${opts.label} (${placements.length + 1}/${opts.count})`;
    Object.assign(labelEl.style, {
      position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
      background: "#1c0e1aee", color: "#c9a14b", padding: "8px 16px",
      borderRadius: "4px", border: "1px solid #c9a14b", zIndex: 10000,
      fontFamily: "Cinzel, serif", fontSize: "14px"
    });
    document.body.appendChild(labelEl);

    function getPlacedBounds() {
      return canvas.tokens.placeables.map(t => ({
        x: t.document.x, y: t.document.y,
        width: t.document.width * grid.size,
        height: t.document.height * grid.size
      }));
    }

    function snap(worldX, worldY) {
      const cellSize = grid.size;
      return {
        x: Math.floor(worldX / cellSize) * cellSize,
        y: Math.floor(worldY / cellSize) * cellSize
      };
    }

    function onMouseMove(_event) {
      const wp = canvas.mousePosition; // world-space
      const snapped = snap(wp.x, wp.y);
      sprite.x = snapped.x;
      sprite.y = snapped.y;
      const proposed = { x: snapped.x, y: snapped.y, width: opts.tokenWidth, height: opts.tokenHeight };
      const blocked = isCellBlocked(proposed, getPlacedBounds());
      indicator.clear();
      indicator.lineStyle(2, blocked ? 0xff4444 : 0x44ff44, 1);
      indicator.beginFill(blocked ? 0xff4444 : 0x44ff44, 0.2);
      indicator.drawRect(snapped.x, snapped.y, opts.tokenWidth, opts.tokenHeight);
      indicator.endFill();
    }

    function onClick(event) {
      if (event.data?.button !== 0) return;
      const wp = canvas.mousePosition;
      const snapped = snap(wp.x, wp.y);
      const proposed = { x: snapped.x, y: snapped.y, width: opts.tokenWidth, height: opts.tokenHeight };
      if (isCellBlocked(proposed, getPlacedBounds())) {
        ui.notifications?.warn(`[${MODULE_ID}] tile occupied — choose a different one`);
        return;
      }
      placements.push({ x: snapped.x, y: snapped.y, sceneId: scene.id });
      labelEl.textContent = `${opts.label} (${placements.length + 1}/${opts.count})`;
      if (placements.length >= opts.count) {
        cleanup();
        resolve(placements);
      }
    }

    function onKey(e) {
      if (e.key === "Escape") {
        console.log(`[${MODULE_ID}] placement cancelled by ESC; ${placements.length} placement(s) committed`);
        cleanup();
        resolve(placements);
      }
    }

    function cleanup() {
      canvas.stage.off("pointermove", onMouseMove);
      canvas.stage.off("pointerdown", onClick);
      document.removeEventListener("keydown", onKey, true);
      layer.removeChild(sprite); sprite.destroy({ children: true, texture: false });
      layer.removeChild(indicator); indicator.destroy();
      labelEl.remove();
      _activeOverlay = null;
    }

    canvas.stage.on("pointermove", onMouseMove);
    canvas.stage.on("pointerdown", onClick);
    document.addEventListener("keydown", onKey, true);

    _activeOverlay = { cancel: () => { cleanup(); resolve(placements); } };
  });
}

export function cancelPlacement() {
  if (_activeOverlay) _activeOverlay.cancel();
}
