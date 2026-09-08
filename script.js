/**
 * CYBER ARCADE 1984 - RETRO CORE & SYNTHESIZER ENGINE
 * High-performance, scalable web game portal with authentic 8-bit sound synth.
 */
"use strict";

/* ==========================================================================
   1. SCALABLE GAME DATA ENGINE
   Add any new game by simply pushing a new entry to this array.
   ========================================================================== */
const GAMES_DATA = [
  {
    id: "block-master",
    title: "Block Master Retro Puzzle",
    folder: "Block Master Retro Puzzle",
    category: "Puzzle",
    description: "Classic tetromino falling-block arcade challenge. Clear lines and beat high score.",
    thumbnail: "" // Empty triggers retro animated glyph placeholder
  },
  {
    id: "pixel-city-builder",
    title: "Pixel City Builder",
    folder: "Pixel City Builder",
    category: "Simulation",
    description: "Zone, power, and govern your thriving 16-bit isometric cyberpunk metropolis.",
    thumbnail: ""
  },
  {
    id: "pixel-commando-jungle",
    title: "Pixel Commando Jungle Assault",
    folder: "Pixel Commando Jungle Assault",
    category: "Action",
    description: "Battle through enemy lines in this run-and-gun jungle warfare shootout.",
    thumbnail: ""
  },
  {
    id: "pixel-commando",
    title: "Pixel Commando",
    folder: "pixel-commando",
    category: "Action",
    description: "The original arcade commando raid. Infiltrate enemy headquarters with heavy lead.",
    thumbnail: ""
  },
  {
    id: "pixel-grand-prix",
    title: "Pixel Grand Prix",
    folder: "pixel-grand-prix",
    category: "Racing",
    description: "High-octane top-down Formula racing. Burn retro rubber across 8 tricky circuits.",
    thumbnail: ""
  },
  {
    id: "super-mario-bros",
    title: "Super Mario Bros",
    folder: "Super Mario Bros",
    category: "Platformer",
    description: "The timeless 8-bit mushroom kingdom adventure. Stomp Goombas and rescue the Princess.",
    thumbnail: ""
  }
];

const CATEGORY_GLYPHS = {
  Action: "💥",
  Puzzle: "🧱",
  Racing: "🏎️",
  Simulation: "🏙️",
  Platformer: "🍄",
  Default: "👾"
};

/* ==========================================================================
   2. SYNTHESIZER ENGINE (Web Audio API Procedural 8-Bit SFX)
   Zero external audio files needed! Generates authentic chiptunes in real time.
   ========================================================================== */
class RetroSynthEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // 8-Bit UI Hover Beep
  playHover() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  // 8-Bit Select / Switch Tab Click
  playSelect() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // Double Chime Coin Insert (Game Launch)
  playCoinInsert() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    
    // Note 1 (B5)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(987.77, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Note 2 (E6)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1318.51, now + 0.09);
    gain2.gain.setValueAtTime(0.08, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.35);
  }

  // CRT Power-down warp
  playPowerDown() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }
}

const SoundFX = new RetroSynthEngine();

/* ==========================================================================
   3. APP STATE & DOM CACHE
   ========================================================================== */
const AppState = {
  activeCategory: "All",
  searchQuery: "",
  activeGame: null,
  crtShader: true
};

const DOM = {
  gamesGrid: document.getElementById("gamesGrid"),
  categoryFilters: document.getElementById("categoryFilters"),
  searchInput: document.getElementById("searchInput"),
  searchClearBtn: document.getElementById("searchClearBtn"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  emptyState: document.getElementById("emptyState"),
  gameCountDisplay: document.getElementById("gameCountDisplay"),
  
  // Toggles
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  soundStatusText: document.getElementById("soundStatusText"),
  crtToggleBtn: document.getElementById("crtToggleBtn"),
  crtStatusText: document.getElementById("crtStatusText"),

  // Modal
  modal: document.getElementById("gameModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalWindow: document.getElementById("modalWindow"),
  modalViewport: document.getElementById("modalViewport"),
  modalGameTitle: document.getElementById("modalGameTitle"),
  modalCategoryBadge: document.getElementById("modalCategoryBadge"),
  gameIframe: document.getElementById("gameIframe"),
  iframeLoader: document.getElementById("iframeLoader"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn")
};

/* ==========================================================================
   4. INITIALIZATION & CATEGORY BUILDER
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initPortal();
});

function initPortal() {
  renderCategoryFilters();
  applyFiltersAndRender();
  bindEvents();
}

function renderCategoryFilters() {
  const categories = ["All", ...new Set(GAMES_DATA.map(game => game.category))];
  DOM.categoryFilters.innerHTML = "";

  categories.forEach(category => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-btn ${category === AppState.activeCategory ? "active" : ""}`;
    btn.textContent = `[ ${category.toUpperCase()} ]`;
    btn.setAttribute("data-category", category);

    btn.addEventListener("mouseenter", () => SoundFX.playHover());
    btn.addEventListener("click", () => {
      if (AppState.activeCategory === category) return;
      SoundFX.playSelect();
      AppState.activeCategory = category;

      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      applyFiltersAndRender();
    });

    DOM.categoryFilters.appendChild(btn);
  });
}

/* ==========================================================================
   5. FILTERING & RENDERING
   ========================================================================== */
function applyFiltersAndRender() {
  const query = AppState.searchQuery.toLowerCase().trim();

  const filteredGames = GAMES_DATA.filter(game => {
    const matchesCategory = AppState.activeCategory === "All" || game.category === AppState.activeCategory;
    const matchesSearch = !query || 
      game.title.toLowerCase().includes(query) ||
      game.category.toLowerCase().includes(query) ||
      (game.description && game.description.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  renderGrid(filteredGames);
  updateCounter(filteredGames.length);
}

function renderGrid(games) {
  DOM.gamesGrid.innerHTML = "";

  if (games.length === 0) {
    DOM.emptyState.hidden = false;
    DOM.gamesGrid.hidden = true;
    return;
  }

  DOM.emptyState.hidden = true;
  DOM.gamesGrid.hidden = false;

  const fragment = document.createDocumentFragment();

  games.forEach((game, index) => {
    const card = document.createElement("article");
    card.className = "arcade-card";

    let thumbnailMarkup = "";
    if (game.thumbnail && game.thumbnail.trim() !== "") {
      thumbnailMarkup = `
        <img src="${sanitizeHTML(game.thumbnail)}" alt="${sanitizeHTML(game.title)}" class="card-thumbnail" loading="lazy" />
      `;
    } else {
      const glyph = CATEGORY_GLYPHS[game.category] || CATEGORY_GLYPHS.Default;
      thumbnailMarkup = `
        <div class="card-fallback">
          <span class="fallback-glyph">${glyph}</span>
          <span class="fallback-tag">${sanitizeHTML(game.category.toUpperCase())} UNIT</span>
        </div>
      `;
    }

    const paddedId = String(index + 1).padStart(2, "0");

    card.innerHTML = `
      <div class="card-screen-wrap">
        ${thumbnailMarkup}
      </div>
      <div class="card-body">
        <div class="card-meta-bar">
          <span class="pixel-pill">${sanitizeHTML(game.category)}</span>
          <span class="cartridge-id">ROM #${paddedId}</span>
        </div>
        <h3 class="card-title">${sanitizeHTML(game.title)}</h3>
        <p class="card-description">${sanitizeHTML(game.description || "Authentic retro gaming session.")}</p>
        <button type="button" class="btn-arcade-play" data-game-id="${game.id}">
          <span>► INSERT COIN</span>
        </button>
      </div>
    `;

    card.addEventListener("mouseenter", () => SoundFX.playHover());

    fragment.appendChild(card);
  });

  DOM.gamesGrid.appendChild(fragment);
}

function updateCounter(count) {
  DOM.gameCountDisplay.textContent = String(count).padStart(2, "0");
}

/* ==========================================================================
   6. CRT LAUNCHER & TV SHUT-OFF SEQUENCE
   ========================================================================== */
function launchGame(game) {
  AppState.activeGame = game;
  SoundFX.playCoinInsert();

  // Safe URI encoding for subfolder paths with spaces
  const gameUrl = `./${encodeURIComponent(game.folder)}/index.html`;

  DOM.modalGameTitle.textContent = game.title.toUpperCase();
  DOM.modalCategoryBadge.textContent = game.category.toUpperCase();

  DOM.iframeLoader.classList.remove("hidden");
  DOM.gameIframe.src = gameUrl;

  DOM.gameIframe.onload = () => {
    DOM.iframeLoader.classList.add("hidden");
  };

  DOM.modal.hidden = false;
  document.body.classList.add("modal-open");

  // Trigger CRT TV Turn-On Animation
  DOM.modalWindow.classList.remove("crt-power-off");
  DOM.modalWindow.classList.add("crt-power-on");
}

function closeGame() {
  SoundFX.playPowerDown();

  // Trigger CRT TV Turn-Off Line Collapse Animation
  DOM.modalWindow.classList.remove("crt-power-on");
  DOM.modalWindow.classList.add("crt-power-off");

  setTimeout(() => {
    DOM.modal.hidden = true;
    document.body.classList.remove("modal-open");

    // Clear iframe to kill background audio loops and memory
    DOM.gameIframe.src = "about:blank";
    AppState.activeGame = null;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    DOM.modalWindow.classList.remove("is-fullscreen");
  }, 320);
}

function toggleFullscreen() {
  SoundFX.playSelect();
  if (!document.fullscreenElement) {
    if (DOM.modalWindow.requestFullscreen) {
      DOM.modalWindow.requestFullscreen().catch(() => {
        DOM.modalWindow.classList.toggle("is-fullscreen");
      });
    } else {
      DOM.modalWindow.classList.toggle("is-fullscreen");
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    DOM.modalWindow.classList.remove("is-fullscreen");
  }
}

/* ==========================================================================
   7. EVENT LISTENERS
   ========================================================================== */
function bindEvents() {
  // Delegate Play buttons
  DOM.gamesGrid.addEventListener("click", (e) => {
    const playBtn = e.target.closest(".btn-arcade-play");
    if (!playBtn) return;

    const gameId = playBtn.getAttribute("data-game-id");
    const game = GAMES_DATA.find(g => g.id === gameId);
    if (game) launchGame(game);
  });

  // Search input events
  let searchTimeout;
  DOM.searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    AppState.searchQuery = e.target.value;
    DOM.searchClearBtn.hidden = !AppState.searchQuery;

    searchTimeout = setTimeout(() => {
      applyFiltersAndRender();
    }, 120);
  });

  DOM.searchClearBtn.addEventListener("click", () => {
    SoundFX.playSelect();
    DOM.searchInput.value = "";
    AppState.searchQuery = "";
    DOM.searchClearBtn.hidden = true;
    DOM.searchInput.focus();
    applyFiltersAndRender();
  });

  DOM.resetFiltersBtn.addEventListener("click", () => {
    SoundFX.playSelect();
    AppState.searchQuery = "";
    AppState.activeCategory = "All";
    DOM.searchInput.value = "";
    DOM.searchClearBtn.hidden = true;
    renderCategoryFilters();
    applyFiltersAndRender();
  });

  // Sound FX Toggle
  DOM.soundToggleBtn.addEventListener("click", () => {
    SoundFX.muted = !SoundFX.muted;
    DOM.soundToggleBtn.classList.toggle("active", !SoundFX.muted);
    DOM.soundStatusText.textContent = SoundFX.muted ? "OFF" : "ON";
    if (!SoundFX.muted) SoundFX.playSelect();
  });

  // CRT Shader Toggle
  DOM.crtToggleBtn.addEventListener("click", () => {
    AppState.crtShader = !AppState.crtShader;
    document.body.classList.toggle("crt-active", AppState.crtShader);
    DOM.crtToggleBtn.classList.toggle("active", AppState.crtShader);
    DOM.crtStatusText.textContent = AppState.crtShader ? "ON" : "OFF";
    SoundFX.playSelect();
  });

  // Modal Controls
  DOM.closeModalBtn.addEventListener("click", closeGame);
  DOM.modalBackdrop.addEventListener("click", closeGame);
  DOM.fullscreenBtn.addEventListener("click", toggleFullscreen);

  document.addEventListener("fullscreenchange", () => {
    DOM.modalWindow.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });

  // Global ESC Key to Close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !DOM.modal.hidden) {
      closeGame();
    }
  });
}

function sanitizeHTML(str) {
  const temp = document.createElement("div");
  temp.textContent = str || "";
  return temp.innerHTML;
}