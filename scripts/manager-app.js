// scripts/manager-app.js — Companion Manager dialog (5 tabs, role-gated)
import { getEffectiveTemplates, getEffectiveTemplate, mergeTemplateOverrides, templateNeedsLink } from "./template-store.js";
import { templates as builtinTemplatesRaw } from "./templates-builtin.js";
// Plan 3: spawn flow now goes Manager → VariantPickerApp → runSpawnFlow(ctx).
// The variant picker is the universal entry point; manager-app + spell-trigger
// open the picker which in turn calls runSpawnFlow internally.
import { runDeathAndCleanup } from "./lifecycle.js";
import { callHandler } from "./handlers/index.js";
import { s } from "./settings.js";
import { getCompanionFlag, setGmOverride } from "./data-model.js";
import { PRESET_INTENSITY, intensityToPreset } from "./restyle-app.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #activeTab = "my-companions";
  // v0.6.0 GM Console tab state
  #gmShowAllTemplates = false;
  #gmPlayerFilter = null;          // userId | null (= all players)
  #gmIntensityTimer = null;        // debounce for the global dial
  #gmEditorOpen = new Set();       // v0.7.0: which editor accordions stay open across renders

  get activeTab() { return this.#activeTab; }

  /**
   * Window title with the installed module version appended (v0.7.3).
   * Diagnostic ergonomics: "which version is he actually running?" was the
   * first question of every live-test round and there was no way to answer it
   * without asking him to open Module Management. Now it's on the dialog he
   * already has open. ApplicationV2 calls this getter on every render.
   */
  get title() {
    const version = game.modules.get(MODULE_ID)?.version ?? "?";
    return `${game.i18n.localize("LUXSUM.Manager.Title")} — v${version}`;
  }

  static DEFAULT_OPTIONS = {
    id: "luxsum-manager",
    classes: ["luxsum", "luxsum-manager"],
    tag: "div",
    window: {
      title: "LUXSUM.Manager.Title",
      icon: "fa-solid fa-ghost",
      resizable: true
    },
    position: { width: 720, height: 560 }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/manager.hbs" }
  };

  async _prepareContext(_options) {
    const myCompanions = (game.user.flags?.[MODULE_ID]?.activeCompanions ?? []).map(entry => {
      const actor = game.actors.get(entry.actorId);
      if (!actor) return null;
      const flag = actor.flags?.[MODULE_ID];
      const tpl = getEffectiveTemplate(flag?.templateId);
      const scene = entry.sceneId ? game.scenes.get(entry.sceneId) : null;
      return {
        actorId: actor.id,
        name: actor.name,
        templateId: flag?.templateId,
        hpValue: actor.system?.attributes?.hp?.value ?? 0,
        hpMax: actor.system?.attributes?.hp?.max ?? 0,
        sceneName: scene?.name ?? "",
        tokenImg: actor.prototypeToken?.texture?.src ?? "icons/svg/mystery-man.svg",
        templateThumb: tpl?.thumbnail ?? "",
        templateName: tpl?.name ?? "",
        borderColor: flag?.visualOverrides?.borderColor ?? "#c9a14b",
        extraActions: tpl?.extraActions ?? []
      };
    }).filter(Boolean);

    const templates = getEffectiveTemplates().map(t => ({
      ...t,
      activeCount: myCompanions.filter(c => c.templateId === t.id).length
    }));

    return {
      activeTab: this.#activeTab,
      isGM: game.user.isGM,
      myCompanions,
      templates,
      gm: game.user.isGM ? this.#prepareGmConsoleContext() : null
    };
  }

  /**
   * v0.6.0 GM Console context. Authoritative data source is game.actors (the
   * player-scoped user-flag index only sees the current user's companions).
   */
  #prepareGmConsoleContext() {
    const templateOverrides = s("templateOverrides") ?? {};

    // scene lookup: actorId → { sceneId, sceneName } (first token found wins)
    const sceneOf = (actorId) => {
      for (const scene of game.scenes) {
        if (scene.tokens.find(t => t.actorId === actorId)) return scene;
      }
      return null;
    };

    const companions = game.actors.contents
      .filter(a => a.flags?.[MODULE_ID]?.isCompanion === true)
      .map(a => {
        const flag = a.flags[MODULE_ID];
        const tpl = getEffectiveTemplate(flag.templateId);
        const owner = game.users.get(flag.sourcePlayerId);
        const scene = sceneOf(a.id);
        const hpValue = a.system?.attributes?.hp?.value ?? 0;
        const hpMax = a.system?.attributes?.hp?.max ?? 0;
        return {
          actorId: a.id,
          name: a.name,
          templateId: flag.templateId,
          templateName: tpl?.name ?? flag.templateId,
          tokenImg: a.prototypeToken?.texture?.src || a.img || "icons/svg/mystery-man.svg",
          borderColor: flag.visualOverrides?.borderColor ?? "#c9a14b",
          hpValue, hpMax,
          hpPct: hpMax > 0 ? Math.round((hpValue / hpMax) * 100) : 0,
          ownerId: flag.sourcePlayerId,
          ownerName: owner?.name ?? "?",
          ownerColor: owner?.color?.css ?? String(owner?.color ?? "#888888"),
          sceneName: scene?.name ?? "",
          onCurrentScene: scene?.id === canvas?.scene?.id,
          motionOn: flag.gmOverrides?.motionEnabled !== false
        };
      });

    const activeTemplateIds = new Set(companions.map(c => c.templateId));
    const templateRows = getEffectiveTemplates()
      .filter(t => this.#gmShowAllTemplates || activeTemplateIds.has(t.id))
      .map(t => {
        const ov = templateOverrides[t.id] ?? {};
        const enabled = ov.motionEnabled !== false;
        const preset = intensityToPreset(ov.motionIntensity ?? 1.0);
        return {
          id: t.id,
          name: t.name,
          thumbnail: t.thumbnail,
          enabled,
          presetOff: preset === "off",
          presetSubtle: preset === "subtle",
          presetDefault: preset === "default",
          presetLively: preset === "lively"
        };
      });

    const owners = [...new Map(companions.map(c => [c.ownerId, { id: c.ownerId, name: c.ownerName, color: c.ownerColor }])).values()];
    const chips = [
      { id: "", name: game.i18n.localize("LUXSUM.GmConsole.AllPlayers"), color: null, active: !this.#gmPlayerFilter },
      ...owners.map(o => ({ ...o, active: this.#gmPlayerFilter === o.id }))
    ];

    const filtered = companions.filter(c => !this.#gmPlayerFilter || c.ownerId === this.#gmPlayerFilter);

    return {
      globals: {
        motionEnabled: s("gmMotionEnabled") !== false,
        intensityPct: Math.round((typeof s("gmMotionIntensity") === "number" ? s("gmMotionIntensity") : 1.0) * 100),
        forceDisableFilters: !!s("gmForceDisableFilters"),
        forceDisableSpawnDeathAnims: !!s("gmForceDisableSpawnDeathAnims")
      },
      templateRows,
      showAll: this.#gmShowAllTemplates,
      chips,
      companions: filtered,
      shownCount: filtered.length,
      totalCount: companions.length,
      editorTemplates: this.#prepareTemplatesEditorContext(templateOverrides)
    };
  }

  /**
   * v0.7.0 Templates editor. Built from the RAW builtin data + the override
   * entry (NOT the merged view) so removed variants stay visible for restore
   * and the GM sees exactly which values are overrides vs shipped defaults.
   */
  #prepareTemplatesEditorContext(templateOverrides) {
    return builtinTemplatesRaw.map(t => {
      const ov = templateOverrides[t.id] ?? {};
      const vo = ov.variantOverrides ?? {};
      const variants = (t.variants ?? []).map(v => ({
        id: v.id,
        name: vo[v.id]?.name ?? v.name,
        thumbnail: vo[v.id]?.thumbnail ?? v.thumbnail,
        uuid: (vo[v.id]?.uuid !== undefined ? vo[v.id].uuid : (v.source?.baseUuid ?? "")) || "",
        removed: vo[v.id]?.removed === true,
        custom: false
      })).concat((ov.customVariants ?? []).map(cv => ({
        id: cv.id,
        name: cv.name ?? cv.id,
        thumbnail: cv.thumbnail || t.thumbnail,
        uuid: cv.uuid ?? "",
        removed: false,
        custom: true
      })));
      const effective = mergeTemplateOverrides(t, ov);
      return {
        id: t.id,
        name: effective.name,
        builtinName: t.name,
        nameValue: ov.nameOverride ?? "",
        thumbnail: effective.thumbnail,
        unlinked: templateNeedsLink(effective),
        overridden: !!(ov.nameOverride || ov.thumbnailOverride
          || Object.keys(vo).length > 0 || (ov.customVariants?.length ?? 0) > 0),
        open: this.#gmEditorOpen.has(t.id),
        variants
      };
    });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tab clicks
    this.element.querySelectorAll(".luxsum-tabs .item").forEach(el => {
      el.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.#activeTab = tab;
          this.render({ force: true });
        }
      });
    });

    // Template card click → open Spawn dialog → placement → broker → spawn
    this.element.querySelectorAll(".luxsum-template-card").forEach(card => {
      card.addEventListener("click", () => this.#onTemplateCardClick(card.dataset.templateId));
    });

    // Companion-card body click (anywhere except inside [data-stop-propagation]) → open sheet
    this.element.querySelectorAll('.luxsum-card[data-action="open-sheet"]').forEach(card => {
      card.addEventListener("click", (e) => {
        // Ignore clicks inside the action rows (their own listeners handle them)
        if (e.target.closest("[data-stop-propagation]")) return;
        this.#onOpenSheet(card.dataset.actorId);
      });
    });

    // Quick-access buttons
    this.element.querySelectorAll('[data-action="open-sheet"]:not(.luxsum-card)').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onOpenSheet(e.currentTarget.dataset.actorId);
      });
    });
    this.element.querySelectorAll('[data-action="select-pan"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onSelectAndPan(e.currentTarget.dataset.actorId);
      });
    });
    this.element.querySelectorAll('[data-action="toggle-combat"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onToggleCombat(e.currentTarget.dataset.actorId);
      });
    });

    // Restyle button
    this.element.querySelectorAll('[data-action="restyle"]').forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const actor = game.actors.get(e.currentTarget.dataset.actorId);
        if (!actor) return;
        const { openRestyleApp } = await import("./restyle-app.js");
        openRestyleApp(actor);
      });
    });

    // Dismiss button
    this.element.querySelectorAll('[data-action="dismiss"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onDismiss(e.currentTarget.dataset.actorId);
      });
    });

    // Extra actions (Repair, Refresh, etc.)
    this.element.querySelectorAll('[data-action="extra"]').forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const handlerId = e.currentTarget.dataset.handler;
        const actorId = e.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor || !handlerId) return;
        await callHandler(handlerId, { actor, app: this });
      });
    });

    this.#wireGmConsole();
    this.#wireTemplatesEditor();

    // Settings tab shortcut → Foundry's settings sheet, module section
    this.element.querySelector('[data-action="open-module-settings"]')?.addEventListener("click", () => {
      try {
        game.settings.sheet.render({ force: true });
      } catch (e) {
        console.warn(`[${MODULE_ID}] could not open settings sheet:`, e);
        ui.notifications?.warn("Open Game Settings from the sidebar instead.");
      }
    });
  }

  /**
   * v0.6.0 GM Console listeners. All selectors are console-scoped data attrs,
   * so this is a no-op on player clients / other tabs (querySelector misses).
   *
   * Slider rule (V13/V14 gotcha): `input` events update the readout + debounce
   * the world-setting write imperatively — NEVER this.render() mid-drag.
   * The setting's own onChange handles the world-wide live re-apply.
   */
  #wireGmConsole() {
    // Global: master motion switch
    this.element.querySelector('[data-gm-global="motionEnabled"]')?.addEventListener("change", async (e) => {
      const on = e.currentTarget.checked;
      this.element.querySelector("[data-gm-intensity-row]")?.classList.toggle("luxsum-gm-row-disabled", !on);
      await game.settings.set(MODULE_ID, "gmMotionEnabled", on);
      console.log(`[${MODULE_ID}] GM console: idle animations ${on ? "enabled" : "disabled"} world-wide`);
    });

    // Global: intensity dial (debounced write, imperative readout)
    this.element.querySelector('[data-gm-global="motionIntensity"]')?.addEventListener("input", (e) => {
      const pct = Number(e.currentTarget.value);
      const readout = this.element.querySelector("[data-gm-intensity-value]");
      if (readout) readout.textContent = `${pct}%`;
      clearTimeout(this.#gmIntensityTimer);
      this.#gmIntensityTimer = setTimeout(async () => {
        await game.settings.set(MODULE_ID, "gmMotionIntensity", pct / 100);
        console.log(`[${MODULE_ID}] GM console: global motion intensity → ${pct}%`);
      }, 350);
    });

    // Global: world-wide kill switches
    for (const key of ["forceDisableFilters", "forceDisableSpawnDeathAnims"]) {
      this.element.querySelector(`[data-gm-global="${key}"]`)?.addEventListener("change", async (e) => {
        const settingKey = key === "forceDisableFilters" ? "gmForceDisableFilters" : "gmForceDisableSpawnDeathAnims";
        await game.settings.set(MODULE_ID, settingKey, e.currentTarget.checked);
        console.log(`[${MODULE_ID}] GM console: ${settingKey} → ${e.currentTarget.checked}`);
      });
    }

    // Per-template: motion toggle
    this.element.querySelectorAll("[data-gm-template-toggle]").forEach(el => {
      el.addEventListener("change", async (e) => {
        const tid = e.currentTarget.dataset.gmTemplateToggle;
        const overrides = foundry.utils.duplicate(s("templateOverrides") ?? {});
        overrides[tid] = { ...(overrides[tid] ?? {}), motionEnabled: e.currentTarget.checked };
        await game.settings.set(MODULE_ID, "templateOverrides", overrides);
        console.log(`[${MODULE_ID}] GM console: template "${tid}" motion → ${e.currentTarget.checked}`);
        this.render({ force: true });
      });
    });

    // Per-template: intensity preset radios
    this.element.querySelectorAll("[data-gm-template-preset]").forEach(el => {
      el.addEventListener("change", async (e) => {
        const tid = e.currentTarget.dataset.gmTemplatePreset;
        const overrides = foundry.utils.duplicate(s("templateOverrides") ?? {});
        overrides[tid] = { ...(overrides[tid] ?? {}), motionIntensity: PRESET_INTENSITY[e.currentTarget.value] ?? 1.0 };
        await game.settings.set(MODULE_ID, "templateOverrides", overrides);
        console.log(`[${MODULE_ID}] GM console: template "${tid}" motion preset → ${e.currentTarget.value}`);
      });
    });

    // Show all / active-only templates
    this.element.querySelector('[data-action="gm-show-all"]')?.addEventListener("click", () => {
      this.#gmShowAllTemplates = !this.#gmShowAllTemplates;
      this.render({ force: true });
    });

    // Player filter chips
    this.element.querySelectorAll("[data-gm-chip]").forEach(el => {
      el.addEventListener("click", (e) => {
        this.#gmPlayerFilter = e.currentTarget.dataset.userId || null;
        this.render({ force: true });
      });
    });

    // Per-companion motion quick-toggle. Freezing SETS motionEnabled:false;
    // restoring REMOVES the key entirely (back to inherit) rather than storing
    // `true` — a stored true would needlessly shadow future template-level
    // decisions. setGmOverride(null) uses Foundry's `-=` deletion syntax.
    this.element.querySelectorAll('[data-action="gm-motion-toggle"]').forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const actor = game.actors.get(e.currentTarget.dataset.actorId);
        if (!actor) return;
        const currentlyOn = getCompanionFlag(actor)?.gmOverrides?.motionEnabled !== false;
        await setGmOverride(actor, "motionEnabled", currentlyOn ? false : null);
        console.log(`[${MODULE_ID}] GM console: ${actor.name} idle motion ${currentlyOn ? "frozen" : "restored"}`);
        this.render({ force: true });
      });
    });

    // Cross-scene Select & Pan (the player-card variant only sees the current
    // scene; the GM console walks all scenes and views the target's first)
    this.element.querySelectorAll('[data-action="gm-select-pan"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onGmSelectAndPan(e.currentTarget.dataset.actorId);
      });
    });
  }

  /**
   * v0.7.0 Templates editor wiring. Every mutation funnels through
   * #updateTemplateOverride — one read-modify-write of the templateOverrides
   * world setting per action, then a re-render. The setting's onChange also
   * reapplies motion world-wide, which is harmless here (editor keys are
   * ignored by the motion resolver).
   */
  #wireTemplatesEditor() {
    const list = this.element.querySelector(".luxsum-gm-editor-list");
    if (!list) return;

    // Persist accordion open/closed across re-renders
    list.querySelectorAll(".luxsum-gm-editor-card").forEach(card => {
      card.addEventListener("toggle", () => {
        const tid = card.dataset.templateId;
        if (card.open) this.#gmEditorOpen.add(tid); else this.#gmEditorOpen.delete(tid);
      });
    });

    // Template display-name override (clear the field → back to shipped name)
    list.querySelectorAll("[data-editor-name]").forEach(el => {
      el.addEventListener("change", (e) => {
        const tid = e.currentTarget.dataset.editorName;
        const value = e.currentTarget.value.trim();
        this.#updateTemplateOverride(tid, ov => {
          if (value) ov.nameOverride = value; else delete ov.nameOverride;
        });
      });
    });

    // Template thumbnail FilePicker
    list.querySelectorAll("[data-editor-thumb]").forEach(el => {
      el.addEventListener("click", (e) => {
        const tid = e.currentTarget.dataset.editorThumb;
        this.#pickImage(path => this.#updateTemplateOverride(tid, ov => { ov.thumbnailOverride = path; }));
      });
    });

    // Per-variant rows
    list.querySelectorAll(".luxsum-gm-editor-variant").forEach(row => {
      const card = row.closest(".luxsum-gm-editor-card");
      const tid = card.dataset.templateId;
      const vid = row.dataset.variantId;
      const isCustom = () => {
        const ov = (s("templateOverrides") ?? {})[tid];
        return (ov?.customVariants ?? []).some(cv => cv.id === vid);
      };
      const mutateVariant = (fn) => this.#updateTemplateOverride(tid, ov => {
        if (isCustom()) {
          const cv = (ov.customVariants ?? []).find(c => c.id === vid);
          if (cv) fn(cv);
        } else {
          ov.variantOverrides = ov.variantOverrides ?? {};
          ov.variantOverrides[vid] = ov.variantOverrides[vid] ?? {};
          fn(ov.variantOverrides[vid]);
        }
      });

      row.querySelector("[data-variant-name]")?.addEventListener("change", (e) => {
        const value = e.currentTarget.value.trim();
        if (value) mutateVariant(v => { v.name = value; });
      });
      row.querySelector("[data-variant-uuid]")?.addEventListener("change", (e) => {
        mutateVariant(v => { v.uuid = e.currentTarget.value.trim(); });
      });
      row.querySelector("[data-variant-thumb]")?.addEventListener("click", () => {
        this.#pickImage(path => mutateVariant(v => { v.thumbnail = path; }));
      });
      row.querySelector("[data-variant-test]")?.addEventListener("click", async () => {
        const uuid = row.querySelector("[data-variant-uuid]")?.value.trim();
        const out = row.querySelector("[data-link-result]");
        if (!out) return;
        if (!uuid) { out.textContent = game.i18n.localize("LUXSUM.Editor.LinkEmpty"); out.className = "luxsum-gm-link-result luxsum-gm-link-bad"; return; }
        out.textContent = "…";
        try {
          const doc = await fromUuid(uuid);
          if (doc?.documentName === "Actor") {
            out.textContent = `✓ ${doc.name}`;
            out.className = "luxsum-gm-link-result luxsum-gm-link-ok";
          } else {
            out.textContent = game.i18n.localize("LUXSUM.Editor.LinkNotActor");
            out.className = "luxsum-gm-link-result luxsum-gm-link-bad";
          }
        } catch (e) {
          out.textContent = game.i18n.localize("LUXSUM.Editor.LinkFailed");
          out.className = "luxsum-gm-link-result luxsum-gm-link-bad";
        }
      });
      row.querySelector("[data-variant-remove]")?.addEventListener("click", () => {
        this.#updateTemplateOverride(tid, ov => {
          if ((ov.customVariants ?? []).some(cv => cv.id === vid)) {
            ov.customVariants = ov.customVariants.filter(cv => cv.id !== vid);
          } else {
            ov.variantOverrides = ov.variantOverrides ?? {};
            ov.variantOverrides[vid] = { ...(ov.variantOverrides[vid] ?? {}), removed: true };
          }
        });
      });
      row.querySelector("[data-variant-restore]")?.addEventListener("click", () => {
        this.#updateTemplateOverride(tid, ov => {
          if (ov.variantOverrides?.[vid]) delete ov.variantOverrides[vid].removed;
        });
      });
    });

    // Add custom variant
    list.querySelectorAll("[data-add-variant]").forEach(el => {
      el.addEventListener("click", (e) => {
        const card = e.currentTarget.closest(".luxsum-gm-editor-card");
        const tid = card.dataset.templateId;
        const name = card.querySelector("[data-add-name]")?.value.trim();
        const uuid = card.querySelector("[data-add-uuid]")?.value.trim() ?? "";
        if (!name) { ui.notifications?.warn(game.i18n.localize("LUXSUM.Editor.AddNeedsName")); return; }
        const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "variant";
        this.#updateTemplateOverride(tid, ov => {
          ov.customVariants = ov.customVariants ?? [];
          let id = baseId, n = 2;
          const taken = new Set([
            ...(builtinTemplatesRaw.find(t => t.id === tid)?.variants ?? []).map(v => v.id),
            ...ov.customVariants.map(cv => cv.id)
          ]);
          while (taken.has(id)) id = `${baseId}-${n++}`;
          ov.customVariants.push({ id, name, uuid });
        });
      });
    });
  }

  async #updateTemplateOverride(templateId, mutate) {
    const all = foundry.utils.duplicate(s("templateOverrides") ?? {});
    const entry = all[templateId] ?? {};
    mutate(entry);
    all[templateId] = entry;
    await game.settings.set(MODULE_ID, "templateOverrides", all);
    console.log(`[${MODULE_ID}] Templates editor: override updated for "${templateId}"`);
    this.render({ force: true });
  }

  #pickImage(callback) {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) { ui.notifications?.warn("FilePicker unavailable"); return; }
    new FP({ type: "image", callback }).browse();
  }

  async #onGmSelectAndPan(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    let targetScene = null, tokenDoc = null;
    for (const scene of game.scenes) {
      const found = scene.tokens.find(t => t.actorId === actorId);
      if (found) { targetScene = scene; tokenDoc = found; break; }
    }
    if (!tokenDoc) {
      ui.notifications?.warn(`[${MODULE_ID}] no token found for ${actor.name} on any scene`);
      return;
    }
    if (targetScene.id !== canvas.scene?.id) {
      console.log(`[${MODULE_ID}] GM console: viewing scene "${targetScene.name}" to reach ${actor.name}`);
      await targetScene.view();
    }
    const token = canvas.tokens.get(tokenDoc.id) ?? tokenDoc.object;
    if (!token) {
      ui.notifications?.warn(`[${MODULE_ID}] token for ${actor.name} not available on the canvas yet — try again in a moment`);
      return;
    }
    token.control({ releaseOthers: true });
    await canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
  }

  #onOpenSheet(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    actor.sheet.render({ force: true });
  }

  async #onSelectAndPan(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const tokens = actor.getActiveTokens();
    const token = tokens[0];
    if (!token) {
      ui.notifications?.warn(`[${MODULE_ID}] no active token for ${actor.name} on the current scene`);
      return;
    }
    // If the token is on a different scene, view that scene first
    if (token.scene && token.scene.id !== canvas.scene?.id) {
      await token.scene.view();
    }
    token.control({ releaseOthers: true });
    await canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
  }

  async #onToggleCombat(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    let combat = game.combat;
    if (!combat) {
      ui.notifications?.warn(`[${MODULE_ID}] no active combat. Start one first (left toolbar).`);
      return;
    }
    const existing = combat.combatants.find(c => c.actorId === actor.id);
    if (existing) {
      await existing.delete();
      ui.notifications?.info(`[${MODULE_ID}] ${actor.name} removed from combat`);
    } else {
      // dnd5e: rollInitiative auto-creates combatants when createCombatants:true
      await actor.rollInitiative({ createCombatants: true });
      ui.notifications?.info(`[${MODULE_ID}] ${actor.name} added to combat (initiative rolled)`);
    }
  }

  async #onTemplateCardClick(templateId) {
    const tpl = getEffectiveTemplate(templateId);
    if (!tpl) return;
    // v0.4.6 FIX 9: game.user.character is null for a typical GM (the friend's
    // primary test path — he's GM and doesn't assign himself a PC). The old code
    // passed it unconditionally as sourceActor, so runSpawnFlow's "no source
    // actor" bail fired for every GM-initiated spawn from the Manager. Resolve
    // from the currently-controlled canvas token first (what the GM almost
    // certainly means when they click Spawn New with a token selected), fall
    // back to the assigned character, and warn + abort BEFORE opening the
    // picker if neither resolves — opening a picker that can never place
    // anything is worse than not opening it.
    const controlledToken = canvas.tokens?.controlled?.[0];
    const sourceActor = controlledToken?.actor ?? game.user.character;
    if (!sourceActor) {
      console.warn(`[${MODULE_ID}] #onTemplateCardClick: no source actor resolved (no controlled token, no assigned character) — aborting before opening the picker`);
      ui.notifications?.warn(game.i18n.localize("LUXSUM.Spawn.NoSourceActor") || `[${MODULE_ID}] Select a token on the canvas or assign a character to your user, then try again.`);
      return;
    }
    console.log(`[${MODULE_ID}] #onTemplateCardClick: resolved source actor "${sourceActor.name}" via ${controlledToken ? "controlled token" : "assigned character"}`);
    // Plan 3: open the variant picker instead of going straight to placement.
    // Single-variant templates open with N=1 pre-selected — same dialog
    // treatment as multi-variant, just N=1, for consistency.
    const { openVariantPicker } = await import("./variant-picker-app.js");
    openVariantPicker(tpl, { sourceActor });
  }

  async #onDismiss(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Luxurious Summons" },
      content: `<p>${game.i18n.format("LUXSUM.Companion.DismissConfirm", { name: actor.name })}</p>`,
      yes: { label: "Dismiss",  callback: () => true },
      no:  { label: "Keep",     callback: () => false },
      defaultYes: true,
      rejectClose: false
    });
    if (!proceed) return;
    // Manual dismiss flow:
    //   - GM path: runDeathAndCleanup runs softFade + token delete + actor delete in
    //     the right order (animation first so the GM sees the fade, then tokens, then
    //     actor). Paid for in v0.3.3 — previous code deleted the actor without
    //     touching the token documents, leaving ghost tokens that couldn't be selected
    //     but stayed visible.
    //   - Player path: softFade runs locally so the requester sees the fade, then
    //     broker the privileged cleanup to the GM. Player can't delete world actors
    //     or scene tokens even with OWNER on the actor.
    if (game.user.isGM) {
      const { runDeathAndCleanup } = await import("./lifecycle.js");
      await runDeathAndCleanup(actor);
      console.log(`[${MODULE_ID}] dismissed companion ${actor.id} (GM direct)`);
    } else {
      const { deathAnimations } = await import("./death-animations.js");
      const { markAnimating, clearAnimating } = await import("./anim-state.js");
      const tokens = actor.getActiveTokens();
      // Same motion-ticker coordination as runDeathAndCleanup (v0.4.6 FIX 1) —
      // this player-local softFade plays independently of the broker-side
      // cleanup (which runs with skipAnimation:true), so it needs its own
      // markAnimating/clearAnimating around the fade.
      for (const t of tokens) markAnimating(t.id);
      try {
        await Promise.all(tokens.map(t => deathAnimations.softFade?.(t) ?? Promise.resolve()));
      } finally {
        for (const t of tokens) clearAnimating(t.id);
      }
      const { postBrokerRequest } = await import("./chat-broker.js");
      await postBrokerRequest("dismiss", { actorId });
      console.log(`[${MODULE_ID}] dismiss broker request posted for ${actor.id}`);
    }
  }
}

let _managerInstance = null;
export function openManager() {
  if (!_managerInstance) _managerInstance = new ManagerApp();
  _managerInstance.render({ force: true });
}

/**
 * Get the currently-open Manager instance if it's rendered, else null.
 * Used by spawn-flow to minimize the manager during placement so it doesn't
 * occlude the canvas. Returns null if the manager isn't open.
 */
export function getActiveManager() {
  return _managerInstance?.rendered ? _managerInstance : null;
}

// v0.6.0: keep the GM Console roster live. Re-render when a companion actor is
// created / deleted / updated (HP, gmOverrides, restyles) while the GM has the
// All-Companions tab open. Renders are read-only — no write-loop risk.
function gmConsoleRefresh(doc) {
  if (!game.user?.isGM) return;
  if (doc?.flags?.[MODULE_ID]?.isCompanion !== true) return;
  if (!_managerInstance?.rendered || _managerInstance.activeTab !== "all-companions") return;
  _managerInstance.render({ force: true });
}
Hooks.on("createActor", gmConsoleRefresh);
Hooks.on("deleteActor", gmConsoleRefresh);
Hooks.on("updateActor", gmConsoleRefresh);

// Re-render the manager when our user-flag activeCompanions changes
// (signaled by the GM client running refreshUserIndexes after spawn/dismiss/delete).
Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  const hasFlagChange = changes.flags?.[MODULE_ID]?.activeCompanions !== undefined;
  if (!hasFlagChange) return;
  const newCount = changes.flags[MODULE_ID].activeCompanions.length;
  console.log(`[${MODULE_ID}] manager: own activeCompanions flag changed (now ${newCount} entr${newCount === 1 ? "y" : "ies"}); rendered=${_managerInstance?.rendered}`);
  if (_managerInstance?.rendered) _managerInstance.render({ force: true });
});
