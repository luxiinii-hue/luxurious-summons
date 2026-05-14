// previews/spawn-gallery-preview.js — vanilla JS wiring for the Plan 3 preview.
// Mock data, no Foundry, no PIXI. Validates layout + interaction feel only.

const templates = [
  { id: "simulacrum",       name: "Simulacrum",       family: "hextech",     tagline: "Illusory duplicate of the master.",                variants: 1,  glyph: "S" },
  { id: "find-familiar",    name: "Find Familiar",    family: "belle-epoque",tagline: "Bind a tiny spirit-creature familiar.",            variants: 15, glyph: "F" },
  { id: "pact-of-chain",    name: "Pact of the Chain",family: "belle-epoque",tagline: "Bind a fey or fiendish familiar (Warlock).",       variants: 4,  glyph: "P" },
  { id: "animate-dead",     name: "Animate Dead",     family: "belle-epoque",tagline: "Raise corpses as undead servants.",                variants: 2,  glyph: "A" },
  { id: "mage-hand",        name: "Mage Hand",        family: "hextech",     tagline: "Ethereal disembodied hand of arcane force.",       variants: 1,  glyph: "M" },
  { id: "unseen-servant",   name: "Unseen Servant",   family: "hextech",     tagline: "An invisible servant carries small objects.",      variants: 1,  glyph: "U" },
  { id: "echo-knight-echo", name: "Echo Knight Echo", family: "hextech",     tagline: "A translucent armored echo of yourself.",          variants: 1,  glyph: "E" },
  { id: "summon-dragon",    name: "Summon Dragon",    family: "hextech",     tagline: "Summon a draconic spirit. Pick a damage type.",    variants: 5,  glyph: "D" }
];

const variantData = {
  "find-familiar": [
    { id: "bat",     name: "Bat",      glyph: "Bat",   ac: 12, hp: 1, speed: "Walk 5 • Fly 30",  senses: "Blindsight 60",  tagline: "Echolocation; flyby attack." },
    { id: "cat",     name: "Cat",      glyph: "Cat",   ac: 12, hp: 2, speed: "Walk 40 • Climb 30", senses: "Darkvision 60", tagline: "Stealthy; keen smell." },
    { id: "crab",    name: "Crab",     glyph: "Crab",  ac: 11, hp: 2, speed: "Walk 25 • Swim 25", senses: "Blindsight 30", tagline: "Amphibious." },
    { id: "frog",    name: "Frog",     glyph: "Frog",  ac: 11, hp: 1, speed: "Walk 20 • Swim 20", senses: "Darkvision 30", tagline: "Amphibious; standing leap 10ft." },
    { id: "hawk",    name: "Hawk",     glyph: "Hawk",  ac: 13, hp: 1, speed: "Walk 10 • Fly 60", senses: "—",              tagline: "Keen sight." },
    { id: "lizard",  name: "Lizard",   glyph: "Liz",   ac: 10, hp: 2, speed: "Walk 20 • Climb 20", senses: "Darkvision 30", tagline: "—" },
    { id: "octopus", name: "Octopus",  glyph: "Oct",   ac: 12, hp: 3, speed: "Walk 5 • Swim 30",  senses: "Darkvision 30", tagline: "Ink cloud; water breathing." },
    { id: "owl",     name: "Owl",      glyph: "Owl",   ac: 11, hp: 1, speed: "Walk 5 • Fly 60",  senses: "Darkvision 120", tagline: "Flyby; advantage on Perception (sight/hearing)." },
    { id: "snake",   name: "P.Snake",  glyph: "Snk",   ac: 13, hp: 2, speed: "Walk 30 • Swim 30", senses: "Blindsight 10", tagline: "Poison bite." },
    { id: "quipper", name: "Quipper",  glyph: "Qup",   ac: 13, hp: 1, speed: "Swim 40",          senses: "Darkvision 60", tagline: "Water breathing only." },
    { id: "rat",     name: "Rat",      glyph: "Rat",   ac: 10, hp: 1, speed: "Walk 20",          senses: "Darkvision 30", tagline: "Keen smell." },
    { id: "raven",   name: "Raven",    glyph: "Rvn",   ac: 12, hp: 1, speed: "Walk 10 • Fly 50", senses: "—",              tagline: "Mimicry." },
    { id: "seahorse",name: "Sea Horse",glyph: "SeH",   ac: 11, hp: 1, speed: "Swim 20",          senses: "—",              tagline: "Water breathing only." },
    { id: "spider",  name: "Spider",   glyph: "Spd",   ac: 12, hp: 1, speed: "Walk 20 • Climb 20", senses: "Darkvision 30", tagline: "Poison bite; web sense." },
    { id: "weasel",  name: "Weasel",   glyph: "Wsl",   ac: 13, hp: 1, speed: "Walk 30",          senses: "—",              tagline: "Keen hearing/smell." }
  ],
  "animate-dead": [
    { id: "skeleton", name: "Skeleton", glyph: "Skl", ac: 13, hp: "13 / 13", speed: "Walk 30", senses: "Darkvision 60", tagline: "Vulnerable bludgeoning; shortbow (longbow if armed)." },
    { id: "zombie",   name: "Zombie",   glyph: "Zmb", ac:  8, hp: "22 / 22", speed: "Walk 20", senses: "Darkvision 60", tagline: "Undead Fortitude (re-roll on 0 HP); slam (bludgeoning)." }
  ],
  "summon-dragon": [
    { id: "acid",      name: "Acid",      glyph: "A",  ac: 14, hp: "—",  speed: "Walk 30 • Fly 60", senses: "Blindsight 30", tagline: "Acid breath weapon; HP and damage scale with cast level." },
    { id: "cold",      name: "Cold",      glyph: "C",  ac: 14, hp: "—",  speed: "Walk 30 • Fly 60", senses: "Blindsight 30", tagline: "Cold breath weapon." },
    { id: "fire",      name: "Fire",      glyph: "F",  ac: 14, hp: "—",  speed: "Walk 30 • Fly 60", senses: "Blindsight 30", tagline: "Fire breath weapon." },
    { id: "lightning", name: "Lightning", glyph: "L",  ac: 14, hp: "—",  speed: "Walk 30 • Fly 60", senses: "Blindsight 30", tagline: "Lightning breath weapon." },
    { id: "poison",    name: "Poison",    glyph: "P",  ac: 14, hp: "—",  speed: "Walk 30 • Fly 60", senses: "Blindsight 30", tagline: "Poison breath weapon." }
  ]
};

const dragonScalingPreview = {
  5: { hp: "50 / 50",  damage: "2d6+3" },
  6: { hp: "60 / 60",  damage: "2d6+4" },
  7: { hp: "70 / 70",  damage: "2d6+5" },
  8: { hp: "80 / 80",  damage: "2d6+5" }
};

function thumbBox(glyph, size = 96) {
  return `<div class="luxsum-template-thumb" style="width:${size}px;height:${size}px;font-size:${size / 3}px">${glyph}</div>`;
}

function variantThumb(glyph) {
  return `<div class="luxsum-variant-thumb">${glyph}</div>`;
}

function renderInfoCard(variant, extraStats = null) {
  if (!variant) return `<div class="luxsum-tagline">— select a variant —</div>`;
  const hp = extraStats?.hp ?? variant.hp;
  return `
    <h3>${variant.name}</h3>
    <dl class="luxsum-info-grid">
      <dt>AC</dt>      <dd>${variant.ac ?? "—"}</dd>
      <dt>HP</dt>      <dd>${hp ?? "—"}</dd>
      <dt>Speed</dt>   <dd>${variant.speed ?? "—"}</dd>
      <dt>Senses</dt>  <dd>${variant.senses ?? "—"}</dd>
      ${extraStats?.damage ? `<dt>Damage</dt><dd>${extraStats.damage}</dd>` : ""}
    </dl>
    <div class="luxsum-tagline">${variant.tagline ?? ""}</div>
    <button class="luxsum-open-sheet">Open Foundry Sheet</button>
  `;
}

function renderGallery(mount) {
  mount.innerHTML = `
    <div class="luxsum-spawn-gallery">
      <h2>Spawn New Companion</h2>
      <div class="luxsum-spawn-gallery-grid">
        ${templates.map(t => `
          <div class="luxsum-template-card" data-family="${t.family}" data-template-id="${t.id}">
            ${thumbBox(t.glyph)}
            <div class="luxsum-template-name">${t.name}</div>
            <div class="luxsum-template-tagline">${t.tagline}</div>
            ${t.variants > 1 ? `<div class="luxsum-template-variant-badge">${t.variants}</div>` : ""}
          </div>
        `).join("")}
      </div>
      <footer><button class="luxsum-btn-outline">Cancel</button></footer>
    </div>
  `;
}

function renderVariantPicker(mount, opts) {
  const { templateId, multispawn = false, showCastLevelSelector = false } = opts;
  const list = variantData[templateId] ?? [];
  let selectedId = list[0]?.id;
  let castLevel = 5;
  const counts = {};

  const refresh = () => {
    // Preserve scroll position of the variant grid across re-renders.
    // The real ApplicationV2 impl in Phase 4 should prefer surgical class-
    // toggle on selection (instead of wholesale re-render) so the user's
    // scroll stays fluent during variant selection.
    const prevGrid = mount.querySelector(".luxsum-variant-grid");
    const prevScrollTop = prevGrid ? prevGrid.scrollTop : 0;
    const selected = list.find(v => v.id === selectedId);
    const extra = (templateId === "summon-dragon" && selected)
      ? dragonScalingPreview[castLevel]
      : null;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    mount.innerHTML = `
      <div class="luxsum-variant-picker">
        <h2>${templates.find(t => t.id === templateId)?.name ?? templateId} — Pick a variant</h2>
        <div class="luxsum-variant-picker-body">
          <div class="luxsum-variant-picker-left">
            <div class="luxsum-variant-grid">
              ${list.map(v => `
                <div class="luxsum-variant-card ${v.id === selectedId ? "selected" : ""} ${multispawn ? "multispawn" : ""}" data-variant-id="${v.id}">
                  ${variantThumb(v.glyph)}
                  <div class="luxsum-variant-name">${v.name}</div>
                  ${multispawn ? `
                    <div class="luxsum-variant-stepper">
                      <button data-action="dec" data-variant-id="${v.id}">−</button>
                      <span>${counts[v.id] ?? 0}</span>
                      <button data-action="inc" data-variant-id="${v.id}">+</button>
                    </div>
                  ` : ""}
                </div>
              `).join("")}
            </div>
            ${multispawn ? `<div class="luxsum-multispawn-total">Total: ${total} / 4</div>` : ""}
            ${showCastLevelSelector ? `
              <div class="luxsum-cast-level-row">
                <label>Cast level:</label>
                <select class="luxsum-cast-level-select">
                  ${[5,6,7,8].map(l => `<option value="${l}" ${l===castLevel?"selected":""}>${l}${l===1?"st":l===2?"nd":l===3?"rd":"th"} level</option>`).join("")}
                </select>
              </div>
            ` : ""}
          </div>
          <div class="luxsum-variant-picker-right">
            ${renderInfoCard(selected, extra)}
          </div>
        </div>
        <footer>
          <button class="luxsum-btn-outline">Cancel</button>
          <button class="luxsum-btn-primary" ${multispawn && total === 0 ? "disabled" : ""}>
            ${multispawn ? `Place ${total} token${total === 1 ? "" : "s"}` : "Place"}
          </button>
        </footer>
      </div>
    `;
    // Restore the scroll position so clicking a variant doesn't yank the user back to the top.
    const newGrid = mount.querySelector(".luxsum-variant-grid");
    if (newGrid) newGrid.scrollTop = prevScrollTop;
    mount.querySelectorAll(".luxsum-variant-card").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".luxsum-variant-stepper")) return;
        selectedId = el.dataset.variantId;
        refresh();
      });
    });
    if (multispawn) {
      mount.querySelectorAll('.luxsum-variant-stepper button[data-action="inc"]').forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const total = Object.values(counts).reduce((a, c) => a + c, 0);
          if (total >= 4) return;
          counts[b.dataset.variantId] = (counts[b.dataset.variantId] ?? 0) + 1;
          refresh();
        });
      });
      mount.querySelectorAll('.luxsum-variant-stepper button[data-action="dec"]').forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const cur = counts[b.dataset.variantId] ?? 0;
          if (cur <= 1) delete counts[b.dataset.variantId];
          else counts[b.dataset.variantId] = cur - 1;
          refresh();
        });
      });
    }
    if (showCastLevelSelector) {
      mount.querySelector(".luxsum-cast-level-select")?.addEventListener("change", (e) => {
        castLevel = parseInt(e.target.value, 10);
        refresh();
      });
    }
  };
  refresh();
}

renderGallery(document.getElementById("gallery-mount"));
renderVariantPicker(document.getElementById("picker-mount"),         { templateId: "find-familiar" });
renderVariantPicker(document.getElementById("picker-dragon-mount"),  { templateId: "summon-dragon", showCastLevelSelector: true });
renderVariantPicker(document.getElementById("multispawn-mount"),     { templateId: "animate-dead", multispawn: true });
