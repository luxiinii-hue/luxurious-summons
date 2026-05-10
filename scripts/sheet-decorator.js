// scripts/sheet-decorator.js — visually mark companion actor sheets so the
// player immediately sees they're controlling a Simulacrum (or other companion)
// rather than the master character.
//
// Adds a Luxurious-themed banner at the top of the sheet showing the template
// name + master name + active dnd5e mod badges (HP halved, no recovery, etc.).
// Wraps the sheet in `.luxsum-companion-sheet` so CSS can apply a wine+gold
// border treatment.

import { isCompanion, getCompanionFlag } from "./data-model.js";
import { templates as builtinTemplates } from "./templates-builtin.js";

const MODULE_ID = "luxurious-summons";

function decorateSheet(app, html) {
  if (!isCompanion(app.actor)) return;

  // jQuery-vs-HTMLElement compat: V13 sheets are jQuery; some V14 builds raw HTMLElement
  const root = html?.jquery ? html[0] : html;
  if (!root) return;
  // The sheet's <window-content> child is the inner shell where Foundry puts content
  const windowContent = root.classList?.contains("window-content")
    ? root
    : root.querySelector?.(".window-content") ?? root;

  // Mark the outer window for CSS targeting (find the .window-app wrapper)
  const windowApp = root.closest?.(".window-app") ?? root;
  windowApp.classList?.add("luxsum-companion-sheet");

  // Idempotency: remove any previous banner before inserting
  windowContent.querySelector?.(".luxsum-companion-banner")?.remove();

  const flag = getCompanionFlag(app.actor);
  const tpl = builtinTemplates.find(t => t.id === flag.templateId);
  const master = flag.sourceActorId ? game.actors.get(flag.sourceActorId) : null;
  const borderColor = flag.visualOverrides?.borderColor ?? "#c9a14b";

  const badges = [];
  if (flag.blockNaturalRecovery) badges.push(game.i18n.localize("LUXSUM.Sheet.Mod.NoNaturalRecovery"));
  if (flag.snapshotSpells)        badges.push(game.i18n.localize("LUXSUM.Sheet.Mod.SnapshotSpells"));
  if (tpl?.dnd5eMods?.halveMaxHp) badges.push(game.i18n.localize("LUXSUM.Sheet.Mod.HpHalved"));

  const masterFragment = master
    ? game.i18n.format("LUXSUM.Sheet.OfMaster", { master: master.name })
    : "";

  const banner = document.createElement("div");
  banner.className = "luxsum-companion-banner";
  banner.style.borderColor = borderColor;
  banner.innerHTML = `
    <img class="luxsum-companion-banner-thumb" src="${tpl?.thumbnail ?? ""}" alt="">
    <div class="luxsum-companion-banner-text">
      <div class="luxsum-companion-banner-title">
        <span class="luxsum-companion-banner-prefix">${game.i18n.localize("LUXSUM.Sheet.BannerPrefix")}:</span>
        <strong>${tpl?.name ?? flag.templateId}</strong>
        <span class="luxsum-companion-banner-master">${masterFragment}</span>
      </div>
      ${badges.length > 0
        ? `<div class="luxsum-companion-banner-badges">${badges.map(b => `<span class="luxsum-companion-banner-badge">${b}</span>`).join("")}</div>`
        : ""}
    </div>
  `;
  windowContent.prepend(banner);
}

export function installSheetDecorator() {
  // dnd5e v3 uses ActorSheet (V1 base) → renderActorSheet hook
  // dnd5e v4 may use ActorSheetV2 → renderApplicationV2 hook (filter by actor presence)
  Hooks.on("renderActorSheet", decorateSheet);
  Hooks.on("renderActorSheetV2", decorateSheet);
}
