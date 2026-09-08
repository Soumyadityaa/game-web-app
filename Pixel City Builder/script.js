/**
 * PIXEL CITY BUILDER - Pure Vanilla 2D Simulation Engine
 */

// ==========================================
// 1. SOUND ENGINE (Synthesized Web Audio API)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  playTone(freqStart, freqEnd, type, duration, vol = 0.2) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);
      }
      const finalVol = vol * this.volume;
      gain.gain.setValueAtTime(finalVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  click() { this.playTone(600, 800, 'sine', 0.04, 0.1); }
  build() { this.playTone(220, 440, 'square', 0.08, 0.15); }
  demolish() { this.playTone(180, 60, 'sawtooth', 0.15, 0.2); }
  cash() {
    this.playTone(523, 659, 'triangle', 0.08, 0.2);
    setTimeout(() => this.playTone(659, 1046, 'triangle', 0.12, 0.2), 70);
  }
  alarm() {
    [440, 330, 440, 330].forEach((f, i) => {
      setTimeout(() => this.playTone(f, f, 'sawtooth', 0.12, 0.25), i * 130);
    });
  }
  complete() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, f, 'sine', 0.15, 0.25), i * 90);
    });
  }
}

const audio = new SoundEngine();

// ==========================================
// 2. CONSTANTS & BUILDING DEFINITIONS
// ==========================================
const GRID_SIZE = 48; // 48x48 tile world
const TILE_SIZE = 32; // 32px rendered grid size

const TERRAIN = { GRASS: 0, WATER: 1, SAND: 2 };

const TOOLS = {
  INSPECT: 'inspect',
  ROAD: 'road',
  DEMOLISH: 'demolish',
  ZONE_RES: 'zone_res',
  ZONE_COM: 'zone_com',
  ZONE_IND: 'zone_ind',
  POWER_PLANT: 'power_plant',
  WATER_PUMP: 'water_pump',
  POLICE: 'police',
  FIRE: 'fire',
  HOSPITAL: 'hospital',
  SCHOOL: 'school',
  PARK: 'park'
};

const BUILDING_DATA = {
  [TOOLS.ROAD]: { cost: 25, upkeep: 1, name: 'Road' },
  [TOOLS.ZONE_RES]: { cost: 100, upkeep: 0, name: 'Residential Zone' },
  [TOOLS.ZONE_COM]: { cost: 100, upkeep: 0, name: 'Commercial Zone' },
  [TOOLS.ZONE_IND]: { cost: 100, upkeep: 0, name: 'Industrial Zone' },
  [TOOLS.POWER_PLANT]: { cost: 2500, upkeep: 150, powerOutput: 120, name: 'Power Plant' },
  [TOOLS.WATER_PUMP]: { cost: 1500, upkeep: 80, waterOutput: 100, name: 'Water Pump' },
  [TOOLS.POLICE]: { cost: 2000, upkeep: 120, radius: 12, name: 'Police Station' },
  [TOOLS.FIRE]: { cost: 2000, upkeep: 120, radius: 12, name: 'Fire Station' },
  [TOOLS.HOSPITAL]: { cost: 3500, upkeep: 200, radius: 14, name: 'City Hospital' },
  [TOOLS.SCHOOL]: { cost: 3000, upkeep: 180, radius: 14, name: 'Public School' },
  [TOOLS.PARK]: { cost: 400, upkeep: 20, radius: 8, name: 'City Park' }
};

// ==========================================
// 3. TILE MODEL
// ==========================================
class Tile {
  constructor(x, y, terrain = TERRAIN.GRASS) {
    this.x = x;
    this.y = y;
    this.terrain = terrain;
    this.building = null; // Key from TOOLS or null
    this.zone = null;     // 'res', 'com', 'ind' or null
    this.stage = 0;       // 0: unbuilt zone, 1-4: building level
    this.variation = Math.floor(Math.random() * 4);

    // Dynamic Simulation States
    this.hasRoad = false;
    this.hasPower = false;
    this.hasWater = false;
    this.pollution = 0;
    this.crime = 0;
    this.landValue = 30;
    this.health = 80;
    this.education = 50;
    this.traffic = 0; // 0 to 100
    this.onFire = false;
    this.fireTimer = 0;

    this.population = 0;
    this.jobs = 0;
  }
}

// ==========================================
// 4. TILEMAP & TERRAIN GENERATOR
// ==========================================
class TileMap {
  constructor(size = GRID_SIZE) {
    this.size = size;
    this.grid = [];
    this.initEmpty();
  }

  initEmpty() {
    this.grid = [];
    for (let y = 0; y < this.size; y++) {
      const row = [];
      for (let x = 0; x < this.size; x++) {
        row.push(new Tile(x, y, TERRAIN.GRASS));
      }
      this.grid.push(row);
    }
  }

  generateMap(type) {
    this.initEmpty();
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (type === 'plains') {
          // River running vertically through center
          const riverX = Math.floor(this.size / 2 + Math.sin(y / 4) * 3);
          if (x === riverX || x === riverX + 1) {
            this.grid[y][x].terrain = TERRAIN.WATER;
          } else if (Math.abs(x - riverX) <= 2) {
            this.grid[y][x].terrain = TERRAIN.SAND;
          }
        } else if (type === 'islands') {
          // Island clusters
          const dist1 = Math.hypot(x - 16, y - 24);
          const dist2 = Math.hypot(x - 34, y - 24);
          if (dist1 > 11 && dist2 > 11) {
            this.grid[y][x].terrain = TERRAIN.WATER;
          } else if (dist1 > 9 || dist2 > 9) {
            this.grid[y][x].terrain = TERRAIN.SAND;
          }
        } else if (type === 'bay') {
          // Coastal bay in corner
          if (x + y < 22 || x > 38 || y > 38) {
            this.grid[y][x].terrain = TERRAIN.WATER;
          } else if (x + y < 25 || x > 36 || y > 36) {
            this.grid[y][x].terrain = TERRAIN.SAND;
          }
        }
      }
    }
  }

  get(x, y) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return null;
    return this.grid[y][x];
  }

  getNeighbors(x, y, radius = 1) {
    const list = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const t = this.get(x + dx, y + dy);
        if (t) list.push(t);
      }
    }
    return list;
  }
}

// ==========================================
// 5. CITY SIMULATION & ECONOMY ENGINE
// ==========================================
class CityGame {
  constructor() {
    this.canvas = document.getElementById('cityCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.skylineCanvas = document.getElementById('skylineCanvas');
    this.skylineCtx = this.skylineCanvas.getContext('2d');
    this.statsChart = document.getElementById('statsChart');
    this.chartCtx = this.statsChart.getContext('2d');

    this.map = new TileMap(GRID_SIZE);

    // Camera & Pan Controls
    this.camX = 200;
    this.camY = 100;
    this.zoom = 1.0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Simulation Economy & Demographics
    this.money = 50000;
    this.population = 0;
    this.jobs = 0;
    this.powerCapacity = 0;
    this.powerDemand = 0;
    this.waterCapacity = 0;
    this.waterDemand = 0;
    this.happiness = 75;

    this.taxRes = 9;
    this.taxCom = 9;
    this.taxInd = 9;

    this.monthlyIncome = 0;
    this.monthlyExpenses = 0;

    // Time & Calendar
    this.simSpeed = 1; // 0: pause, 1, 2, 4
    this.gameMonth = 1;
    this.gameYear = 1;
    this.dayTick = 0;
    this.ambientLight = 1.0;

    // Visual Overlay View
    this.activeView = 'normal'; // normal, traffic, power, water, pollution, land, services
    this.selectedTool = TOOLS.INSPECT;

    // Objectives & Challenges
    this.activeChallenge = null;
    this.history = { pop: [], funds: [], happy: [] };

    // Settings
    this.enableDayNight = true;
    this.enableDisasters = true;
    this.autoSave = true;

    // Cars on road animation
    this.vehicles = [];

    this.selectedTile = null;
    this.lastTimestamp = 0;

    this.initSkyline();
    this.initEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.map.generateMap('plains');
  }

  resizeCanvas() {
    const parent = document.getElementById('viewport-container');
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
    this.skylineCanvas.width = window.innerWidth;
    this.skylineCanvas.height = window.innerHeight;
  }

  initSkyline() {
    this.skylineBuildings = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      this.skylineBuildings.push({
        x: (window.innerWidth / count) * i,
        w: window.innerWidth / count + 4,
        h: Math.random() * 200 + 100,
        color: ['#0f172a', '#1e293b', '#0d1f38', '#1a2234'][Math.floor(Math.random() * 4)],
        windows: Array.from({ length: 12 }, () => Math.random() > 0.4)
      });
    }
  }

  initEvents() {
    // Canvas Pan & Zoom
    this.canvas.addEventListener('mousedown', e => {
      audio.init();
      audio.resume();
      if (e.button === 0) { // Left click
        const t = this.getTileAtScreen(e.clientX, e.clientY);
        if (this.selectedTool === TOOLS.INSPECT) {
          this.inspectTile(t);
        } else {
          this.applyTool(t);
        }
      }
      this.isDragging = true;
      this.dragStartX = e.clientX - this.camX;
      this.dragStartY = e.clientY - this.camY;
    });

    window.addEventListener('mousemove', e => {
      if (this.isDragging) {
        this.camX = e.clientX - this.dragStartX;
        this.camY = e.clientY - this.dragStartY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom = Math.max(0.5, Math.min(2.2, this.zoom * zoomFactor));
    });

    // Touch Support
    this.canvas.addEventListener('touchstart', e => {
      audio.init();
      audio.resume();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const t = this.getTileAtScreen(touch.clientX, touch.clientY);
        if (this.selectedTool !== TOOLS.INSPECT) this.applyTool(t);
        else this.inspectTile(t);
        this.isDragging = true;
        this.dragStartX = touch.clientX - this.camX;
        this.dragStartY = touch.clientY - this.camY;
      }
    });

    this.canvas.addEventListener('touchmove', e => {
      if (this.isDragging && e.touches.length === 1) {
        this.camX = e.touches[0].clientX - this.dragStartX;
        this.camY = e.touches[0].clientY - this.dragStartY;
      }
    });

    this.canvas.addEventListener('touchend', () => { this.isDragging = false; });

    // Tool Selection Bindings
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.onclick = () => {
        audio.click();
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTool = btn.getAttribute('data-tool');
      };
    });

    // Overlay View Bindings
    document.querySelectorAll('.overlay-btn').forEach(btn => {
      btn.onclick = () => {
        audio.click();
        document.querySelectorAll('.overlay-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeView = btn.getAttribute('data-view');
      };
    });

    // Time Control Buttons
    document.getElementById('btn-speed-0').onclick = () => this.setSpeed(0);
    document.getElementById('btn-speed-1').onclick = () => this.setSpeed(1);
    document.getElementById('btn-speed-2').onclick = () => this.setSpeed(2);
    document.getElementById('btn-speed-4').onclick = () => this.setSpeed(4);

    // Modal Triggers
    const showModal = (id) => {
      audio.click();
      document.getElementById(id).classList.remove('hidden');
    };
    const hideModal = (id) => {
      audio.click();
      document.getElementById(id).classList.add('hidden');
    };

    document.getElementById('btn-new-city').onclick = () => showModal('modal-map-select');
    document.getElementById('btn-cancel-map').onclick = () => hideModal('modal-map-select');
    document.getElementById('btn-confirm-map').onclick = () => {
      const activeCard = document.querySelector('.map-card.active');
      const mapType = activeCard ? activeCard.getAttribute('data-map') : 'plains';
      this.startNewCity(mapType);
      hideModal('modal-map-select');
    };

    document.querySelectorAll('.map-card').forEach(card => {
      card.onclick = () => {
        audio.click();
        document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      };
    });

    document.getElementById('btn-load-city').onclick = () => this.loadCity();
    document.getElementById('btn-challenges').onclick = () => {
      this.populateChallengeModal();
      showModal('modal-challenges');
    };
    document.getElementById('btn-close-challenges').onclick = () => hideModal('modal-challenges');
    document.getElementById('btn-start-challenge').onclick = () => {
      const activeItem = document.querySelector('.ch-item.active');
      if (activeItem) {
        const id = parseInt(activeItem.getAttribute('data-id'));
        this.startChallenge(id);
      }
      hideModal('modal-challenges');
    };

    document.getElementById('btn-how-to').onclick = () => showModal('modal-how');
    document.getElementById('btn-close-how').onclick = () => hideModal('modal-how');

    document.getElementById('btn-settings').onclick = () => showModal('modal-settings');
    document.getElementById('btn-close-settings').onclick = () => hideModal('modal-settings');
    document.getElementById('btn-save-settings').onclick = () => {
      this.enableDayNight = document.getElementById('chk-daynight').checked;
      this.enableDisasters = document.getElementById('chk-disasters').checked;
      this.autoSave = document.getElementById('chk-autosave').checked;
      audio.muted = !document.getElementById('chk-sfx').checked;
      audio.volume = parseInt(document.getElementById('rng-vol').value) / 100;
      hideModal('modal-settings');
    };

    // Budget Sheet
    document.getElementById('btn-open-budget').onclick = () => {
      this.updateBudgetModalValues();
      showModal('modal-budget');
    };
    document.getElementById('btn-close-budget').onclick = () => hideModal('modal-budget');
    document.getElementById('btn-apply-budget').onclick = () => {
      this.taxRes = parseInt(document.getElementById('rng-tax-res').value);
      this.taxCom = parseInt(document.getElementById('rng-tax-com').value);
      this.taxInd = parseInt(document.getElementById('rng-tax-ind').value);
      hideModal('modal-budget');
    };

    const updateTaxLabel = (id, val) => {
      document.getElementById(id).innerText = `${val}%`;
      this.updateBudgetModalValues();
    };
    document.getElementById('rng-tax-res').oninput = e => updateTaxLabel('val-tax-res', e.target.value);
    document.getElementById('rng-tax-com').oninput = e => updateTaxLabel('val-tax-com', e.target.value);
    document.getElementById('rng-tax-ind').oninput = e => updateTaxLabel('val-tax-ind', e.target.value);

    // Statistics
    document.getElementById('btn-open-stats').onclick = () => {
      this.renderStatsDashboard();
      showModal('modal-stats');
    };
    document.getElementById('btn-close-stats').onclick = () => hideModal('modal-stats');

    // Pause Menu
    document.getElementById('btn-pause-menu').onclick = () => {
      audio.click();
      document.getElementById('screen-game').classList.add('hidden');
      document.getElementById('screen-menu').classList.remove('hidden');
      this.saveCity();
    };

    // Close Inspector
    document.getElementById('btn-close-insp').onclick = () => {
      document.getElementById('tile-inspector').classList.add('hidden');
      this.selectedTile = null;
    };
  }

  setSpeed(spd) {
    audio.click();
    this.simSpeed = spd;
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-speed-${spd}`).classList.add('active');
  }

  startNewCity(mapType) {
    this.map.generateMap(mapType);
    this.money = 50000;
    this.population = 0;
    this.jobs = 0;
    this.happiness = 75;
    this.gameMonth = 1;
    this.gameYear = 1;
    this.dayTick = 0;
    this.vehicles = [];
    this.history = { pop: [0], funds: [50000], happy: [75] };
    this.activeChallenge = null;

    document.getElementById('objective-banner').classList.add('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');
    this.resizeCanvas();

    // Center camera
    this.camX = this.canvas.width / 2 - (GRID_SIZE * TILE_SIZE) / 2;
    this.camY = this.canvas.height / 2 - (GRID_SIZE * TILE_SIZE) / 2;
  }

  startChallenge(id) {
    this.startNewCity('plains');
    const challenges = [
      { id: 1, title: 'Reach 2,500 Population', targetPop: 2500 },
      { id: 2, title: 'Maintain 80% Happiness with 1,000+ Pop', targetPop: 1000, targetHappy: 80 },
      { id: 3, title: 'Accumulate $100,000 in Treasury', targetFunds: 100000 }
    ];
    this.activeChallenge = challenges.find(c => c.id === id);
    if (this.activeChallenge) {
      document.getElementById('objective-banner').classList.remove('hidden');
      document.getElementById('obj-title').innerText = `OBJECTIVE: ${this.activeChallenge.title}`;
    }
  }

  populateChallengeModal() {
    const list = document.getElementById('challenge-list-container');
    list.innerHTML = `
      <div class="ch-item active" data-id="1">
        <h4>MISSION 1: BOOMTOWN</h4>
        <p>Attract citizens and construct infrastructure to reach 2,500 population.</p>
      </div>
      <div class="ch-item" data-id="2">
        <h4>MISSION 2: UTOPIA</h4>
        <p>Maintain 80% citywide happiness with at least 1,000 residents.</p>
      </div>
      <div class="ch-item" data-id="3">
        <h4>MISSION 3: FISCAL TITAN</h4>
        <p>Build a thriving industrial and commercial base to amass $100,000.</p>
      </div>
    `;
    list.querySelectorAll('.ch-item').forEach(item => {
      item.onclick = () => {
        audio.click();
        list.querySelectorAll('.ch-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      };
    });
  }

  getTileAtScreen(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const worldX = (screenX - rect.left - this.camX) / this.zoom;
    const worldY = (screenY - rect.top - this.camY) / this.zoom;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    return this.map.get(tileX, tileY);
  }

  applyTool(tile) {
    if (!tile) return;
    const tool = this.selectedTool;

    if (tool === TOOLS.DEMOLISH) {
      if (tile.building || tile.zone) {
        if (this.money >= 10) {
          this.money -= 10;
          tile.building = null;
          tile.zone = null;
          tile.stage = 0;
          tile.hasRoad = false;
          tile.population = 0;
          tile.jobs = 0;
          audio.demolish();
        }
      }
      return;
    }

    if (tile.terrain === TERRAIN.WATER && tool !== TOOLS.ROAD) return; // Water only allows bridge roads

    const def = BUILDING_DATA[tool];
    if (!def) return;

    if (this.money < def.cost) {
      audio.alarm();
      return;
    }

    if (tool === TOOLS.ROAD) {
      tile.building = TOOLS.ROAD;
      tile.hasRoad = true;
      tile.zone = null;
      tile.stage = 0;
      this.money -= def.cost;
      audio.build();
    } else if ([TOOLS.ZONE_RES, TOOLS.ZONE_COM, TOOLS.ZONE_IND].includes(tool)) {
      if (!tile.building) {
        tile.zone = tool.replace('zone_', '');
        tile.stage = 0;
        this.money -= def.cost;
        audio.build();
      }
    } else {
      // Municipal, Utility, or Civic Buildings
      tile.building = tool;
      tile.zone = null;
      tile.stage = 1;
      this.money -= def.cost;
      audio.build();
    }
  }

  inspectTile(tile) {
    if (!tile) return;
    this.selectedTile = tile;
    const panel = document.getElementById('tile-inspector');
    const title = document.getElementById('insp-title');
    const body = document.getElementById('insp-body');

    panel.classList.remove('hidden');
    let buildingName = 'OPEN LAND / GRASS';
    if (tile.building) {
      buildingName = BUILDING_DATA[tile.building] ? BUILDING_DATA[tile.building].name : 'STRUCTURE';
    } else if (tile.zone) {
      buildingName = `${tile.zone.toUpperCase()} ZONE (LVL ${tile.stage})`;
    }

    title.innerText = buildingName;
    body.innerHTML = `
      <div class="insp-row"><span>POPULATION:</span><strong>${tile.population}</strong></div>
      <div class="insp-row"><span>JOBS:</span><strong>${tile.jobs}</strong></div>
      <div class="insp-row"><span>POWER:</span><strong class="${tile.hasPower ? 'green' : 'red'}">${tile.hasPower ? 'CONNECTED' : 'NO POWER'}</strong></div>
      <div class="insp-row"><span>WATER:</span><strong class="${tile.hasWater ? 'green' : 'red'}">${tile.hasWater ? 'SUPPLIED' : 'DRY'}</strong></div>
      <div class="insp-row"><span>LAND VALUE:</span><strong>$${tile.landValue}/sq.m</strong></div>
      <div class="insp-row"><span>POLLUTION:</span><strong class="${tile.pollution > 40 ? 'red' : 'green'}">${tile.pollution}%</strong></div>
      <div class="insp-row"><span>CRIME RISK:</span><strong>${tile.crime}%</strong></div>
    `;
  }

  // ==========================================
  // 6. SIMULATION LOGIC TICK
  // ==========================================
  updateSimulation(dt) {
    if (this.simSpeed === 0) return;

    this.dayTick += dt * this.simSpeed * 12; // 12 ticks per second at 1x
    if (this.dayTick >= 30) {
      this.dayTick = 0;
      this.advanceMonth();
    }

    // Day/Night ambient shift (Sine cycle over 240 seconds)
    if (this.enableDayNight) {
      const cycle = Math.sin((Date.now() / 20000) * Math.PI);
      this.ambientLight = 0.5 + 0.5 * Math.max(0, cycle);
    } else {
      this.ambientLight = 1.0;
    }

    // Spread Utilities, Pollution, Services & Development
    this.simulateInfrastructure();
    this.simulateZoningAndGrowth();
    this.updateTrafficAndVehicles(dt);
    if (this.enableDisasters) this.simulateDisasters(dt);

    this.updateHUD();
    this.checkObjectives();
  }

  advanceMonth() {
    this.gameMonth++;
    if (this.gameMonth > 12) {
      this.gameMonth = 1;
      this.gameYear++;
    }

    // Economic Cashflow Calculation
    let resTaxIncome = 0;
    let comTaxIncome = 0;
    let indTaxIncome = 0;
    let totalUpkeep = 0;

    let totPop = 0;
    let totJobs = 0;

    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];
        totPop += t.population;
        totJobs += t.jobs;

        if (t.zone === 'res') resTaxIncome += t.population * (this.taxRes * 0.45);
        if (t.zone === 'com') comTaxIncome += t.jobs * (this.taxCom * 0.85);
        if (t.zone === 'ind') indTaxIncome += t.jobs * (this.taxInd * 1.10);

        if (t.building && BUILDING_DATA[t.building]) {
          totalUpkeep += BUILDING_DATA[t.building].upkeep || 0;
        }
      }
    }

    this.population = totPop;
    this.jobs = totJobs;

    this.monthlyIncome = Math.floor(resTaxIncome + comTaxIncome + indTaxIncome);
    this.monthlyExpenses = Math.floor(totalUpkeep);
    const net = this.monthlyIncome - this.monthlyExpenses;
    this.money += net;

    audio.cash();

    // Record History
    this.history.pop.push(this.population);
    this.history.funds.push(this.money);
    this.history.happy.push(this.happiness);
    if (this.history.pop.length > 20) {
      this.history.pop.shift();
      this.history.funds.shift();
      this.history.happy.shift();
    }

    if (this.autoSave) this.saveCity();
  }

  simulateInfrastructure() {
    let powerGen = 0;
    let waterGen = 0;

    // 1. Calculate generation capacity
    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];
        t.hasPower = false;
        t.hasWater = false;
        if (t.building === TOOLS.POWER_PLANT) powerGen += BUILDING_DATA[TOOLS.POWER_PLANT].powerOutput;
        if (t.building === TOOLS.WATER_PUMP) waterGen += BUILDING_DATA[TOOLS.WATER_PUMP].waterOutput;
      }
    }

    this.powerCapacity = powerGen;
    this.waterCapacity = waterGen;

    // 2. Flood fill power and water along road networks and adjacent zones
    const powerSources = [];
    const waterSources = [];

    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];
        if (t.building === TOOLS.POWER_PLANT) powerSources.push(t);
        if (t.building === TOOLS.WATER_PUMP) waterSources.push(t);
      }
    }

    // Propagate utility flags (BFS)
    const propagateUtility = (sources, flagKey) => {
      const visited = new Set();
      const queue = [...sources];
      sources.forEach(s => {
        s[flagKey] = true;
        visited.add(`${s.x},${s.y}`);
      });

      while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = this.map.getNeighbors(curr.x, curr.y, 1);
        for (let n of neighbors) {
          const key = `${n.x},${n.y}`;
          if (!visited.has(key) && (n.building || n.zone)) {
            visited.add(key);
            n[flagKey] = true;
            queue.push(n);
          }
        }
      }
    };

    propagateUtility(powerSources, 'hasPower');
    propagateUtility(waterSources, 'hasWater');

    // 3. Service Coverages, Pollution & Crime Calculations
    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];

        // Base Pollution from Industry
        if (t.zone === 'ind' && t.stage > 0) {
          t.pollution = Math.min(100, t.stage * 25);
          this.map.getNeighbors(x, y, 2).forEach(n => {
            n.pollution = Math.max(n.pollution, t.pollution * 0.45);
          });
        } else if (t.building === TOOLS.PARK) {
          t.pollution = 0;
          this.map.getNeighbors(x, y, 2).forEach(n => { n.pollution = Math.max(0, n.pollution - 20); });
        } else {
          t.pollution = Math.max(0, t.pollution - 2);
        }

        // Land Value calculation
        let val = 30;
        if (t.hasPower) val += 15;
        if (t.hasWater) val += 15;
        val -= t.pollution * 0.4;
        t.landValue = Math.max(10, Math.floor(val));
      }
    }
  }

  simulateZoningAndGrowth() {
    let happyTotal = 0;
    let zoneCount = 0;

    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];
        if (!t.zone) continue;
        zoneCount++;

        // Check if zone has adjacent road
        const hasAdjacentRoad = this.map.getNeighbors(x, y, 1).some(n => n.building === TOOLS.ROAD);

        if (hasAdjacentRoad && t.hasPower && t.hasWater && Math.random() < 0.08) {
          // Promote Zone Density
          if (t.stage < 4) {
            t.stage++;
          }
        } else if ((!t.hasPower || !t.hasWater || !hasAdjacentRoad) && Math.random() < 0.04) {
          // Abandonment
          if (t.stage > 0) t.stage--;
        }

        // Set Pop and Jobs by density stage
        if (t.zone === 'res') {
          t.population = [0, 8, 30, 90, 250][t.stage];
          t.jobs = 0;
        } else if (t.zone === 'com') {
          t.population = 0;
          t.jobs = [0, 6, 25, 75, 200][t.stage];
        } else if (t.zone === 'ind') {
          t.population = 0;
          t.jobs = [0, 10, 40, 110, 300][t.stage];
        }

        // Zone happiness formula
        let tileHappy = 70;
        if (t.hasPower) tileHappy += 10;
        if (t.hasWater) tileHappy += 10;
        tileHappy -= t.pollution * 0.3;
        tileHappy -= (this.taxRes - 9) * 2;
        happyTotal += tileHappy;
      }
    }

    this.happiness = zoneCount > 0 ? Math.max(10, Math.min(100, Math.floor(happyTotal / zoneCount))) : 75;
  }

  updateTrafficAndVehicles(dt) {
    // Spawn pixel cars along road network
    if (this.vehicles.length < 25 && Math.random() < 0.2) {
      const roadTiles = [];
      for (let y = 0; y < this.map.size; y++) {
        for (let x = 0; x < this.map.size; x++) {
          if (this.map.grid[y][x].building === TOOLS.ROAD) roadTiles.push(this.map.grid[y][x]);
        }
      }
      if (roadTiles.length > 1) {
        const start = roadTiles[Math.floor(Math.random() * roadTiles.length)];
        this.vehicles.push({
          x: start.x * TILE_SIZE + 12,
          y: start.y * TILE_SIZE + 12,
          tileX: start.x,
          tileY: start.y,
          color: ['#ffdd00', '#ff2255', '#00f0ff', '#ffffff'][Math.floor(Math.random() * 4)],
          life: 8.0
        });
      }
    }

    // Move vehicles along connected roads
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.life -= dt;
      if (v.life <= 0) {
        this.vehicles.splice(i, 1);
        continue;
      }
      const neighbors = this.map.getNeighbors(v.tileX, v.tileY, 1).filter(n => n.building === TOOLS.ROAD);
      if (neighbors.length > 0) {
        const target = neighbors[Math.floor(Math.random() * neighbors.length)];
        v.x += (target.x * TILE_SIZE + 12 - v.x) * 0.08;
        v.y += (target.y * TILE_SIZE + 12 - v.y) * 0.08;
        v.tileX = target.x;
        v.tileY = target.y;
      }
    }
  }

  simulateDisasters(dt) {
    // Random fire breakout (1 in 3000 chance per frame)
    if (Math.random() < 0.0003) {
      const flammable = [];
      for (let y = 0; y < this.map.size; y++) {
        for (let x = 0; x < this.map.size; x++) {
          const t = this.map.grid[y][x];
          if ((t.zone || t.building) && !t.onFire) flammable.push(t);
        }
      }
      if (flammable.length > 0) {
        const target = flammable[Math.floor(Math.random() * flammable.length)];
        target.onFire = true;
        target.fireTimer = 15;
        audio.alarm();
        document.getElementById('disaster-banner').classList.remove('hidden');
        setTimeout(() => document.getElementById('disaster-banner').classList.add('hidden'), 4000);
      }
    }

    // Fire spreading & extinguishing
    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const t = this.map.grid[y][x];
        if (t.onFire) {
          t.fireTimer -= dt * this.simSpeed;
          // Check for nearby fire stations
          const hasFireRescue = this.map.getNeighbors(x, y, 6).some(n => n.building === TOOLS.FIRE);
          if (hasFireRescue) t.fireTimer -= dt * 4;

          if (t.fireTimer <= 0) {
            t.onFire = false;
            t.stage = 0; // destroyed
            t.population = 0;
            t.jobs = 0;
          }
        }
      }
    }
  }

  checkObjectives() {
    if (!this.activeChallenge) return;
    const ch = this.activeChallenge;
    let completed = false;

    if (ch.targetPop) {
      document.getElementById('obj-bar-fill').style.width = `${Math.min(100, (this.population / ch.targetPop) * 100)}%`;
      document.getElementById('obj-counter').innerText = `${this.population} / ${ch.targetPop}`;
      if (this.population >= ch.targetPop) {
        if (!ch.targetHappy || this.happiness >= ch.targetHappy) completed = true;
      }
    } else if (ch.targetFunds) {
      document.getElementById('obj-bar-fill').style.width = `${Math.min(100, (this.money / ch.targetFunds) * 100)}%`;
      document.getElementById('obj-counter').innerText = `$${this.money} / $${ch.targetFunds}`;
      if (this.money >= ch.targetFunds) completed = true;
    }

    if (completed) {
      audio.complete();
      alert(`CHALLENGE COMPLETED: ${ch.title}! Outstanding leadership, Mayor!`);
      this.activeChallenge = null;
      document.getElementById('objective-banner').classList.add('hidden');
    }
  }

  updateHUD() {
    document.getElementById('hud-money').innerText = `$${this.money.toLocaleString()}`;
    document.getElementById('hud-pop').innerText = this.population.toLocaleString();
    document.getElementById('hud-jobs').innerText = this.jobs.toLocaleString();
    document.getElementById('hud-power').innerText = `${this.population * 2}/${this.powerCapacity} MW`;
    document.getElementById('hud-water').innerText = `${Math.floor(this.population * 1.5)}/${this.waterCapacity} U`;
    document.getElementById('hud-happy').innerText = `${this.happiness}%`;

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    document.getElementById('hud-date').innerText = `YEAR ${this.gameYear}, ${months[this.gameMonth - 1]}`;

    if (this.selectedTile) this.inspectTile(this.selectedTile);
  }

  updateBudgetModalValues() {
    const res = Math.floor(this.population * (this.taxRes * 0.45));
    const com = Math.floor(this.jobs * 0.4 * (this.taxCom * 0.85));
    const ind = Math.floor(this.jobs * 0.6 * (this.taxInd * 1.10));
    const income = res + com + ind;

    document.getElementById('lbl-budget-income').innerText = `+$${income.toLocaleString()}`;
    document.getElementById('lbl-budget-expenses').innerText = `-$${this.monthlyExpenses.toLocaleString()}`;
    const net = income - this.monthlyExpenses;
    const netLbl = document.getElementById('lbl-net-balance');
    netLbl.innerText = `${net >= 0 ? '+' : ''}$${net.toLocaleString()}`;
    netLbl.className = net >= 0 ? 'green' : 'red';
  }

  renderStatsDashboard() {
    document.getElementById('st-pop').innerText = this.population.toLocaleString();
    document.getElementById('st-jobs').innerText = this.jobs.toLocaleString();
    document.getElementById('st-happy').innerText = `${this.happiness}%`;
    document.getElementById('st-crime').innerText = this.happiness > 60 ? 'LOW' : 'HIGH';
    document.getElementById('st-poll').innerText = this.jobs > 500 ? 'MODERATE' : 'LOW';

    // Draw retro Canvas statistics graph
    const ctx = this.chartCtx;
    ctx.clearRect(0, 0, this.statsChart.width, this.statsChart.height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 20; y < 180; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(560, y);
      ctx.stroke();
    }

    const drawLine = (data, maxVal, color) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * 540 + 10;
        const y = 170 - (val / maxVal) * 140;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    const maxPop = Math.max(100, ...this.history.pop);
    const maxFunds = Math.max(50000, ...this.history.funds);

    drawLine(this.history.pop, maxPop, '#39ff14');
    drawLine(this.history.funds, maxFunds, '#ffaa00');
    drawLine(this.history.happy, 100, '#00f0ff');
  }

  // ==========================================
  // 7. CANVAS RENDERING ENGINE
  // ==========================================
  render() {
    // 1. Render Menu Skyline when in Menu
    if (!document.getElementById('screen-menu').classList.contains('hidden')) {
      this.renderSkyline();
      return;
    }

    // 2. Render Gameplay Map
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // Draw Terrain & Buildings
    for (let y = 0; y < this.map.size; y++) {
      for (let x = 0; x < this.map.size; x++) {
        const tile = this.map.grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Base Terrain
        if (tile.terrain === TERRAIN.WATER) {
          ctx.fillStyle = (Math.floor(Date.now() / 400) + x + y) % 2 === 0 ? '#1b4d89' : '#174276';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (tile.terrain === TERRAIN.SAND) {
          ctx.fillStyle = '#c2b280';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#345c31' : '#2f542c';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        // Road or Bridge
        if (tile.building === TOOLS.ROAD) {
          this.renderRoad(ctx, tile, px, py);
        }

        // Zones & Stages
        if (tile.zone) {
          this.renderZone(ctx, tile, px, py);
        }

        // Special / Municipal Buildings
        if (tile.building && tile.building !== TOOLS.ROAD) {
          this.renderSpecialBuilding(ctx, tile, px, py);
        }

        // Fire Visual FX
        if (tile.onFire) {
          ctx.fillStyle = Math.random() < 0.5 ? '#ff2200' : '#ffaa00';
          ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }

        // Active Overlays
        this.renderOverlay(ctx, tile, px, py);
      }
    }

    // Render Vehicles
    this.vehicles.forEach(v => {
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x - 3, v.y - 3, 6, 6);
    });

    // Ambient Day/Night Lighting Filter
    if (this.enableDayNight && this.ambientLight < 0.95) {
      ctx.fillStyle = `rgba(10, 16, 38, ${1.0 - this.ambientLight})`;
      ctx.fillRect(0, 0, this.map.size * TILE_SIZE, this.map.size * TILE_SIZE);
    }

    ctx.restore();
  }

  renderRoad(ctx, tile, px, py) {
    ctx.fillStyle = '#2c323d';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // White dashed center line
    ctx.fillStyle = '#e2e8f0';
    const hasN = this.map.get(tile.x, tile.y - 1)?.building === TOOLS.ROAD;
    const hasS = this.map.get(tile.x, tile.y + 1)?.building === TOOLS.ROAD;
    const hasE = this.map.get(tile.x + 1, tile.y)?.building === TOOLS.ROAD;
    const hasW = this.map.get(tile.x - 1, tile.y)?.building === TOOLS.ROAD;

    if (hasN || hasS) ctx.fillRect(px + 14, py, 4, TILE_SIZE);
    if (hasE || hasW) ctx.fillRect(px, py + 14, TILE_SIZE, 4);
    if (!hasN && !hasS && !hasE && !hasW) {
      ctx.fillRect(px + 14, py + 14, 4, 4);
    }
  }

  renderZone(ctx, tile, px, py) {
    const colors = { res: '#38a169', com: '#3182ce', ind: '#d69e2e' };
    ctx.fillStyle = colors[tile.zone] || '#fff';

    if (tile.stage === 0) {
      // Empty Zone outline
      ctx.strokeStyle = colors[tile.zone];
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    } else if (tile.stage === 1) {
      // Small Cottage / Bodega / Workshop
      ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    } else if (tile.stage === 2) {
      // Brick Building
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(px + 8, py + 8, 6, 6);
      ctx.fillRect(px + 18, py + 8, 6, 6);
    } else if (tile.stage === 3) {
      // Commercial / Apartment Block
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#edf2f7';
      for (let r = 6; r < TILE_SIZE - 6; r += 8) {
        ctx.fillRect(px + 6, py + r, 4, 4);
        ctx.fillRect(px + 14, py + r, 4, 4);
        ctx.fillRect(px + 22, py + r, 4, 4);
      }
    } else {
      // High-rise Tower
      ctx.fillStyle = '#1a365d';
      ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
  }

  renderSpecialBuilding(ctx, tile, px, py) {
    const type = tile.building;
    if (type === TOOLS.POWER_PLANT) {
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === TOOLS.WATER_PUMP) {
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(px + 10, py + 10, 12, 12);
    } else if (type === TOOLS.POLICE) {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(px + 8, py + 8, 16, 16);
    } else if (type === TOOLS.FIRE) {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(px + 8, py + 8, 16, 16);
    } else if (type === TOOLS.HOSPITAL) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(px + 13, py + 6, 6, 20);
      ctx.fillRect(px + 6, py + 13, 20, 6);
    } else if (type === TOOLS.SCHOOL) {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px + 12, py + 4, 8, 8);
    } else if (type === TOOLS.PARK) {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderOverlay(ctx, tile, px, py) {
    if (this.activeView === 'power' && !tile.hasPower && (tile.building || tile.zone)) {
      ctx.fillStyle = 'rgba(255, 0, 55, 0.45)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    } else if (this.activeView === 'water' && !tile.hasWater && (tile.building || tile.zone)) {
      ctx.fillStyle = 'rgba(0, 150, 255, 0.45)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    } else if (this.activeView === 'pollution' && tile.pollution > 10) {
      ctx.fillStyle = `rgba(180, 80, 0, ${tile.pollution / 150})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    } else if (this.activeView === 'land') {
      ctx.fillStyle = `rgba(0, 255, 100, ${tile.landValue / 120})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  renderSkyline() {
    const ctx = this.skylineCtx;
    ctx.clearRect(0, 0, this.skylineCanvas.width, this.skylineCanvas.height);

    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, this.skylineCanvas.width, this.skylineCanvas.height);

    // Draw pixel stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 37) % this.skylineCanvas.width;
      const sy = (i * 61) % (this.skylineCanvas.height * 0.6);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Skyline silhouettes with animated windows
    this.skylineBuildings.forEach(b => {
      ctx.fillStyle = b.color;
      const y = this.skylineCanvas.height - b.h;
      ctx.fillRect(b.x, y, b.w, b.h);

      // Window lights
      ctx.fillStyle = '#ffdd00';
      b.windows.forEach((on, idx) => {
        if (on && Math.sin(Date.now() / 1000 + idx) > -0.2) {
          ctx.fillRect(b.x + 8 + (idx % 3) * 12, y + 12 + Math.floor(idx / 3) * 18, 6, 8);
        }
      });
    });
  }

  saveCity() {
    try {
      const data = {
        money: this.money,
        population: this.population,
        jobs: this.jobs,
        happiness: this.happiness,
        gameMonth: this.gameMonth,
        gameYear: this.gameYear,
        taxRes: this.taxRes,
        taxCom: this.taxCom,
        taxInd: this.taxInd,
        grid: this.map.grid.map(row => row.map(t => ({
          terrain: t.terrain,
          building: t.building,
          zone: t.zone,
          stage: t.stage,
          hasRoad: t.hasRoad
        })))
      };
      localStorage.setItem('pixel_city_save', JSON.stringify(data));
    } catch (e) {}
  }

  loadCity() {
    try {
      const raw = localStorage.getItem('pixel_city_save');
      if (!raw) {
        alert('No saved city found!');
        return;
      }
      const data = JSON.parse(raw);
      this.money = data.money;
      this.population = data.population;
      this.jobs = data.jobs;
      this.happiness = data.happiness;
      this.gameMonth = data.gameMonth;
      this.gameYear = data.gameYear;
      this.taxRes = data.taxRes;
      this.taxCom = data.taxCom;
      this.taxInd = data.taxInd;

      this.map.initEmpty();
      for (let y = 0; y < this.map.size; y++) {
        for (let x = 0; x < this.map.size; x++) {
          const src = data.grid[y][x];
          const t = this.map.grid[y][x];
          t.terrain = src.terrain;
          t.building = src.building;
          t.zone = src.zone;
          t.stage = src.stage;
          t.hasRoad = src.hasRoad;
        }
      }

      document.getElementById('screen-menu').classList.add('hidden');
      document.getElementById('screen-game').classList.remove('hidden');
      this.resizeCanvas();
    } catch (e) {
      alert('Failed to load city state.');
    }
  }

  loop(timestamp) {
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.updateSimulation(dt);
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }
}

// Start simulation on load
window.addEventListener('load', () => {
  const game = new CityGame();
  requestAnimationFrame(t => game.loop(t));
});