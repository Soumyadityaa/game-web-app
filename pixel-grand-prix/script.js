/**
 * PIXEL GRAND PRIX - Retro Racing Simulation
 * 100% Vanilla JS Pseudo-3D Racing Engine
 */

// ==========================================
// 1. SOUND ENGINE (Web Audio API Synthesizer)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.skidGain = null;
    this.skidNoise = null;
    this.lastCrashTime = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Primary Engine Oscillator
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();

    // Tire Skid Synthesizer (White Noise with Bandpass Filter)
    const bufSize = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    this.skidNoise = this.ctx.createBufferSource();
    this.skidNoise.buffer = noiseBuf;
    this.skidNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.skidNoise.connect(filter);
    filter.connect(this.skidGain);
    this.skidGain.connect(this.ctx.destination);
    this.skidNoise.start();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  updateEngine(rpmRatio, throttle) {
    if (!this.ctx || !this.engineOsc) return;
    const freq = 65 + rpmRatio * 260;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    const targetVol = 0.04 + (throttle ? 0.08 : 0.02);
    this.engineGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.05);
  }

  setSkid(intensity) {
    if (!this.ctx || !this.skidGain) return;
    this.skidGain.gain.setTargetAtTime(Math.min(0.18, intensity * 0.18), this.ctx.currentTime, 0.05);
  }

  muteEngine() {
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    if (this.skidGain) this.skidGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  playTone(freq, type, duration, vol = 0.2) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  beep(high = false) { this.playTone(high ? 880 : 440, 'square', 0.15, 0.2); }
  
  crash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCrashTime < 0.15) return;
    this.lastCrashTime = now;
    this.playTone(120, 'sawtooth', 0.35, 0.3);
  }

  draftWhoosh() { this.playTone(320, 'sine', 0.25, 0.15); }
  checkpoint() { this.playTone(660, 'triangle', 0.2, 0.2); }
  victoryJingle() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'square', 0.25, 0.25), i * 140);
    });
  }
}

const audio = new SoundEngine();

// ==========================================
// 2. CAR ROSTER & SPECIFICATIONS
// ==========================================
const CARS = [
  { id: 0, name: "Pixel GT", class: "BALANCED RACER", speed: 75, accel: 70, handling: 85, brake: 80, grip: 85, fuelCap: 100, color: "#e6002e", stripe: "#ffffff" },
  { id: 1, name: "Thunder RS", class: "SPEED DEMON", speed: 90, accel: 85, handling: 65, brake: 70, grip: 70, fuelCap: 90, color: "#0066ff", stripe: "#ffcc00" },
  { id: 2, name: "Falcon XR", class: "ENDURANCE GP", speed: 80, accel: 75, handling: 80, brake: 85, grip: 80, fuelCap: 110, color: "#009944", stripe: "#ffd700" },
  { id: 3, name: "Turbo ZX", class: "ACCELERATION MONSTER", speed: 95, accel: 90, handling: 55, brake: 60, grip: 60, fuelCap: 80, color: "#8800cc", stripe: "#ff00bb" },
  { id: 4, name: "Velocity R", class: "CORNERING MASTER", speed: 85, accel: 80, handling: 75, brake: 75, grip: 75, fuelCap: 95, color: "#00ddcc", stripe: "#111122" }
];

// ==========================================
// 3. TRACK DEFINITIONS
// ==========================================
const TRACKS = [
  {
    id: 0,
    name: "Sunset Circuit",
    laps: 3,
    sky: ["#2c1144", "#772244", "#d45533", "#f8a055"],
    roadColor: { light: "#3a3a48", dark: "#343440", rumble: "#ff3344", rumbleAlt: "#ffffff", grass: "#264e36" },
    scenery: 'palm',
    generate(segments) {
      addRoad(segments, 100, 100, 0, 0);
      addRoad(segments, 150, 150, 2, 20);
      addRoad(segments, 150, 150, 0, -20);
      addRoad(segments, 200, 200, -2.5, 15);
      addRoad(segments, 200, 200, 0, -15);
      addRoad(segments, 250, 250, 1.5, 0);
      addRoad(segments, 350, 350, 0, 0);
    }
  },
  {
    id: 1,
    name: "Mountain Run",
    laps: 3,
    sky: ["#0b1d3a", "#1b3b6f", "#4682b4", "#90caf9"],
    roadColor: { light: "#2e2e38", dark: "#282830", rumble: "#ffbb00", rumbleAlt: "#ffffff", grass: "#1c3322" },
    scenery: 'pine',
    generate(segments) {
      addRoad(segments, 150, 150, 0, 0);
      addRoad(segments, 200, 200, 4, 50);
      addRoad(segments, 200, 200, -4, -50);
      addRoad(segments, 250, 250, 4.5, 60);
      addRoad(segments, 250, 250, -4.5, -60);
      addRoad(segments, 200, 200, 0, 30);
      addRoad(segments, 200, 200, 0, -30);
      addRoad(segments, 350, 350, 0, 0);
    }
  },
  {
    id: 2,
    name: "Neon City",
    laps: 4,
    sky: ["#050014", "#15002b", "#310055", "#00ffff"],
    roadColor: { light: "#22222a", dark: "#1c1c22", rumble: "#00ffff", rumbleAlt: "#ff0055", grass: "#0d081a" },
    scenery: 'building',
    generate(segments) {
      addRoad(segments, 100, 100, 0, 0);
      addRoad(segments, 150, 150, 4.5, 0);
      addRoad(segments, 150, 150, 0, 0);
      addRoad(segments, 150, 150, -4.5, 0);
      addRoad(segments, 200, 200, 0, 0);
      addRoad(segments, 200, 200, 5, 0);
      addRoad(segments, 250, 250, -3, 0);
      addRoad(segments, 400, 400, 0, 0);
    }
  },
  {
    id: 3,
    name: "Desert Rally",
    laps: 3,
    sky: ["#2d1b00", "#5c3300", "#a65c00", "#e09f3e"],
    roadColor: { light: "#6e553c", dark: "#604a34", rumble: "#cc4400", rumbleAlt: "#ffdd99", grass: "#b08d57" },
    scenery: 'cactus',
    generate(segments) {
      addRoad(segments, 150, 150, 0, 0);
      addRoad(segments, 250, 250, 2.5, 25);
      addRoad(segments, 250, 250, -2.5, -25);
      addRoad(segments, 300, 300, 0, 15);
      addRoad(segments, 300, 300, 3, -15);
      addRoad(segments, 450, 450, 0, 0);
    }
  },
  {
    id: 4,
    name: "Grand Prix Circuit",
    laps: 5,
    sky: ["#0f172a", "#1e293b", "#334155", "#64748b"],
    roadColor: { light: "#33333e", dark: "#2a2a34", rumble: "#ffffff", rumbleAlt: "#cc0000", grass: "#1e3f20" },
    scenery: 'grandstand',
    generate(segments) {
      addRoad(segments, 150, 150, 0, 0);
      addRoad(segments, 200, 200, 3, 20);
      addRoad(segments, 200, 200, -3, -20);
      addRoad(segments, 150, 150, -4.5, 0);
      addRoad(segments, 150, 150, 4.5, 0);
      addRoad(segments, 250, 250, 0, 15);
      addRoad(segments, 250, 250, 3.5, -15);
      addRoad(segments, 500, 500, 0, 0);
    }
  }
];

function addRoad(segments, enter, hold, curve, y) {
  const startY = segments.length > 0 ? segments[segments.length - 1].p2.world.y : 0;
  const endY = startY + (y * 200);
  const total = enter + hold;
  for (let n = 0; n < enter; n++) {
    segments.push(createSegment(segments.length, easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total)));
  }
  for (let n = 0; n < hold; n++) {
    segments.push(createSegment(segments.length, curve, easeInOut(startY, endY, (enter + n) / total)));
  }
}

function createSegment(index, curve, y) {
  const segLength = 200;
  return {
    index: index,
    p1: { world: { x: 0, y: y, z: index * segLength }, camera: {}, screen: {} },
    p2: { world: { x: 0, y: y, z: (index + 1) * segLength }, camera: {}, screen: {} },
    curve: curve
  };
}

function easeIn(a, b, percent) { return a + (b - a) * Math.pow(percent, 2); }
function easeInOut(a, b, percent) { return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5); }

// ==========================================
// 4. PARTICLES SYSTEM
// ==========================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, count, color, speed = 2, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.8 + 0.2) * speed;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 1,
        color: color,
        size: Math.random() * size + 2,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    ctx.restore();
  }
}

// ==========================================
// 5. SIMULATION & RACE ENGINE
// ==========================================
class RaceEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.mCtx = this.minimapCanvas.getContext('2d');
    this.previewCanvas = document.getElementById('carPreviewCanvas');
    this.pCtx = this.previewCanvas.getContext('2d');

    this.particles = new ParticleSystem();

    // Game States
    this.state = 'MENU';
    this.playerCarIdx = 0;
    this.currentTrackIdx = 0;
    this.isChampionship = false;
    this.champRound = 0;
    this.champScores = [];

    // Track Geometry
    this.segments = [];
    this.trackLength = 0;
    this.segmentLength = 200;
    this.rumbleLength = 3;
    this.roadWidth = 2000;
    this.drawDistance = 260;
    this.cameraHeight = 1000;
    this.cameraDepth = 0.84;

    // Dynamics
    this.playerX = 0;
    this.position = 0;
    this.speed = 0;
    this.maxSpeed = 0;
    this.accel = 0;
    this.handling = 0;
    this.brakingPower = 0;
    this.grip = 100;
    this.fuel = 100;
    this.damage = 0;

    this.lap = 1;
    this.raceTimer = 0;
    this.lapStartTime = 0;
    this.bestLapTime = Infinity;
    this.currentLapTime = 0;
    this.overtakes = 0;

    // Tactical State
    this.isDrafting = false;
    this.inPitZone = false;
    this.pitServicing = false;

    // AI
    this.aiCars = [];
    this.aiNames = ["V. Rossi", "M. Weber", "A. Prost", "L. Hamilton", "N. Lauda"];

    // Input States
    this.keys = { up: false, down: false, left: false, right: false, hb: false };

    this.lastTime = 0;
    this.initInputs();
    this.initUI();
    this.drawCarPreview();
  }

  initInputs() {
    window.addEventListener('keydown', e => {
      audio.init();
      audio.resume();
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space') this.keys.hb = true;
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyR' && this.state === 'RACING') this.startRace();
    });

    window.addEventListener('keyup', e => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (e.code === 'Space') this.keys.hb = false;
    });

    const bindTouch = (id, key) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const onStart = (e) => { e.preventDefault(); audio.init(); audio.resume(); this.keys[key] = true; };
      const onEnd = (e) => { e.preventDefault(); this.keys[key] = false; };
      btn.addEventListener('touchstart', onStart);
      btn.addEventListener('touchend', onEnd);
      btn.addEventListener('mousedown', onStart);
      btn.addEventListener('mouseup', onEnd);
    };
    bindTouch('t-left', 'left');
    bindTouch('t-right', 'right');
    bindTouch('t-gas', 'up');
    bindTouch('t-brake', 'down');
    bindTouch('t-hb', 'hb');
  }

  initUI() {
    const showScreen = (id) => {
      document.querySelectorAll('.screen-layer').forEach(s => s.classList.add('hidden'));
      if (id) document.getElementById(id).classList.remove('hidden');
    };

    document.getElementById('btn-quick-race').onclick = () => {
      this.isChampionship = false;
      showScreen('screen-tracks');
    };
    document.getElementById('btn-garage').onclick = () => {
      this.updateGarageStats();
      showScreen('screen-garage');
    };
    document.getElementById('btn-track-select').onclick = () => showScreen('screen-tracks');
    document.getElementById('btn-championship').onclick = () => {
      this.isChampionship = true;
      this.champRound = 0;
      this.champScores = [
        { name: "Player", pts: 0, car: CARS[this.playerCarIdx].name },
        ...this.aiNames.map((n, i) => ({ name: n, pts: 0, car: CARS[(i + 1) % CARS.length].name }))
      ];
      this.startChampionshipRound();
    };
    document.getElementById('btn-how-to').onclick = () => showScreen('screen-how-to');

    document.getElementById('btn-prev-car').onclick = () => {
      this.playerCarIdx = (this.playerCarIdx - 1 + CARS.length) % CARS.length;
      this.updateGarageStats();
      this.drawCarPreview();
    };
    document.getElementById('btn-next-car').onclick = () => {
      this.playerCarIdx = (this.playerCarIdx + 1) % CARS.length;
      this.updateGarageStats();
      this.drawCarPreview();
    };
    document.getElementById('btn-confirm-car').onclick = () => showScreen('screen-main');
    document.getElementById('btn-garage-back').onclick = () => showScreen('screen-main');
    document.getElementById('btn-tracks-back').onclick = () => showScreen('screen-main');
    document.getElementById('btn-how-back').onclick = () => showScreen('screen-main');

    document.querySelectorAll('.track-card').forEach(card => {
      card.onclick = () => {
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.currentTrackIdx = parseInt(card.getAttribute('data-track'));
      };
    });
    document.getElementById('btn-start-selected-track').onclick = () => this.startRace();

    document.getElementById('btn-resume').onclick = () => this.togglePause();
    document.getElementById('btn-restart').onclick = () => {
      showScreen(null);
      this.startRace();
    };
    document.getElementById('btn-quit-race').onclick = () => {
      audio.muteEngine();
      this.state = 'MENU';
      document.getElementById('hud-layer').classList.add('hidden');
      showScreen('screen-main');
    };

    document.getElementById('btn-pit-refuel').onclick = () => this.performPitService('fuel');
    document.getElementById('btn-pit-tires').onclick = () => this.performPitService('tires');
    document.getElementById('btn-pit-repair').onclick = () => this.performPitService('repair');
    document.getElementById('btn-pit-all').onclick = () => this.performPitService('all');

    document.getElementById('btn-res-next').onclick = () => {
      if (this.isChampionship) {
        this.showChampionshipTable();
      } else {
        showScreen('screen-tracks');
      }
    };
    document.getElementById('btn-res-retry').onclick = () => this.startRace();
    document.getElementById('btn-res-menu').onclick = () => {
      this.state = 'MENU';
      showScreen('screen-main');
    };

    document.getElementById('btn-champ-next').onclick = () => {
      this.champRound++;
      if (this.champRound < TRACKS.length) {
        this.currentTrackIdx = this.champRound;
        this.startRace();
      } else {
        showScreen('screen-main');
      }
    };
    document.getElementById('btn-champ-quit').onclick = () => showScreen('screen-main');
  }

  updateGarageStats() {
    const c = CARS[this.playerCarIdx];
    document.getElementById('garage-car-name').innerText = c.name;
    document.getElementById('garage-car-class').innerText = c.class;
    document.getElementById('stat-speed').style.width = `${c.speed}%`;
    document.getElementById('stat-accel').style.width = `${c.accel}%`;
    document.getElementById('stat-handling').style.width = `${c.handling}%`;
    document.getElementById('stat-braking').style.width = `${c.brake}%`;
    document.getElementById('stat-grip').style.width = `${c.grip}%`;
    document.getElementById('stat-fuel').style.width = `${(c.fuelCap / 120) * 100}%`;
  }

  drawCarPreview() {
    const ctx = this.pCtx;
    ctx.clearRect(0, 0, 280, 150);
    const car = CARS[this.playerCarIdx];
    this.renderCarSprite(ctx, 140, 95, 3.2, car.color, car.stripe, 0, false, 0);
  }

  startChampionshipRound() {
    this.currentTrackIdx = this.champRound;
    this.startRace();
  }

  showChampionshipTable() {
    document.querySelectorAll('.screen-layer').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-championship').classList.remove('hidden');

    this.champScores.sort((a, b) => b.pts - a.pts);
    const tbody = document.getElementById('championship-table-body');
    tbody.innerHTML = '';
    this.champScores.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="${i === 0 ? 'gold' : ''}">${i + 1}</td>
        <td>${row.name}</td>
        <td>${row.car}</td>
        <td class="gold">${row.pts}</td>
      `;
      tbody.appendChild(tr);
    });

    const nextBtn = document.getElementById('btn-champ-next');
    if (this.champRound >= TRACKS.length - 1) {
      nextBtn.innerText = "CHAMPIONSHIP COMPLETE";
    } else {
      nextBtn.innerText = `NEXT: ROUND ${this.champRound + 2}`;
    }
  }

  startRace() {
    audio.init();
    audio.resume();
    document.querySelectorAll('.screen-layer').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud-layer').classList.remove('hidden');

    this.segments = [];
    const trackDef = TRACKS[this.currentTrackIdx];
    trackDef.generate(this.segments);
    this.trackLength = this.segments.length * this.segmentLength;

    const car = CARS[this.playerCarIdx];
    this.maxSpeed = (car.speed / 100) * 12000;
    this.accel = (car.accel / 100) * 4800;
    this.handling = (car.handling / 100) * 4.2;
    this.brakingPower = (car.brake / 100) * 9000;
    this.grip = 100;
    this.fuel = car.fuelCap;
    this.damage = 0;

    this.playerX = 0;
    this.position = 0;
    this.speed = 0;
    this.lap = 1;
    this.raceTimer = 0;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.bestLapTime = Infinity;
    this.overtakes = 0;

    this.aiCars = [];
    for (let i = 0; i < 5; i++) {
      const aiCarDef = CARS[(this.playerCarIdx + i + 1) % CARS.length];
      this.aiCars.push({
        id: i,
        name: this.aiNames[i],
        car: aiCarDef,
        offset: (i % 2 === 0 ? 0.45 : -0.45),
        z: (i + 1) * 700 + 400,
        speed: (aiCarDef.speed / 100) * 11200,
        maxSpeed: (aiCarDef.speed / 100) * (11200 + (Math.random() * 600 - 300)),
        skill: 0.85 + Math.random() * 0.15,
        lap: 1
      });
    }

    this.state = 'COUNTDOWN';
    const cdOverlay = document.getElementById('countdown-overlay');
    const cdText = document.getElementById('countdown-text');
    cdOverlay.classList.remove('hidden');

    let count = 3;
    cdText.innerText = count;
    audio.beep(false);

    const intv = setInterval(() => {
      count--;
      if (count > 0) {
        cdText.innerText = count;
        audio.beep(false);
      } else if (count === 0) {
        cdText.innerText = "GO!";
        audio.beep(true);
      } else {
        cdOverlay.classList.add('hidden');
        clearInterval(intv);
        this.state = 'RACING';
      }
    }, 1000);
  }

  togglePause() {
    if (this.state === 'RACING') {
      this.state = 'PAUSED';
      audio.muteEngine();
      document.getElementById('screen-pause').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'RACING';
      document.getElementById('screen-pause').classList.add('hidden');
    }
  }

  performPitService(type) {
    if (this.pitServicing) return;
    this.pitServicing = true;
    audio.draftWhoosh();

    const bar = document.getElementById('pit-timer-bar');
    const fill = document.getElementById('pit-progress-fill');
    bar.classList.remove('hidden');
    fill.style.width = '0%';

    let duration = 2400;
    let start = Date.now();

    const pitIntv = setInterval(() => {
      let elapsed = Date.now() - start;
      let pct = Math.min(100, (elapsed / duration) * 100);
      fill.style.width = `${pct}%`;

      if (pct >= 100) {
        clearInterval(pitIntv);
        const car = CARS[this.playerCarIdx];
        if (type === 'fuel' || type === 'all') this.fuel = car.fuelCap;
        if (type === 'tires' || type === 'all') this.grip = 100;
        if (type === 'repair' || type === 'all') this.damage = 0;

        document.getElementById('screen-pit').classList.add('hidden');
        bar.classList.add('hidden');
        this.pitServicing = false;
        this.state = 'RACING';
      }
    }, 50);
  }

  // ==========================================
  // 6. MAIN SIMULATION UPDATE LOOP
  // ==========================================
  update(dt) {
    if (this.state !== 'RACING' && this.state !== 'COUNTDOWN') return;

    const car = CARS[this.playerCarIdx];
    const currentSegment = this.findSegment(this.position);
    const speedRatio = this.speed / this.maxSpeed;

    if (this.state === 'RACING') {
      this.raceTimer += dt;
      this.currentLapTime = this.raceTimer - this.lapStartTime;

      const fuelBurn = (0.35 + Math.pow(speedRatio, 1.6) * 1.2) * dt;
      this.fuel = Math.max(0, this.fuel - fuelBurn);
      const fuelPct = (this.fuel / car.fuelCap) * 100;

      let fuelSpeedLimit = this.maxSpeed;
      if (fuelPct < 15) {
        document.getElementById('hud-warning-banner').classList.remove('hidden');
        if (fuelPct <= 0) fuelSpeedLimit = this.maxSpeed * 0.25;
      } else {
        document.getElementById('hud-warning-banner').classList.add('hidden');
      }

      if (this.keys.hb || (Math.abs(this.playerX) > 0.85 && this.speed > 5000)) {
        this.grip = Math.max(20, this.grip - 6.0 * dt);
        audio.setSkid(0.8);
      } else if (this.grip < 100 && this.speed < this.maxSpeed * 0.7) {
        this.grip = Math.min(100, this.grip + 1.2 * dt);
        audio.setSkid(0.0);
      } else {
        audio.setSkid(0.0);
      }
      const gripRatio = this.grip / 100;

      const damagePowerFactor = Math.max(0.45, 1 - (this.damage / 100) * 0.55);

      if (this.keys.up && this.fuel > 0) {
        this.speed += this.accel * gripRatio * damagePowerFactor * dt;
      } else if (this.keys.down) {
        this.speed -= this.brakingPower * dt;
      } else {
        this.speed -= 1800 * dt;
      }

      if (this.keys.hb) {
        this.speed -= 3800 * dt;
        this.particles.spawn(this.canvas.width / 2 + (this.playerX * 120), this.canvas.height - 40, 2, '#ffffff', 2);
      }

      const isOffroad = Math.abs(this.playerX) > 1.0;
      if (isOffroad) {
        this.speed -= 5500 * dt;
        this.particles.spawn(this.canvas.width / 2 + (this.playerX * 160), this.canvas.height - 30, 2, '#8b5a2b', 3);
      }

      this.speed = Math.max(0, Math.min(this.speed, Math.min(this.maxSpeed, fuelSpeedLimit)));

      const steerPower = this.handling * (1.1 - speedRatio * 0.45) * gripRatio;
      const dx = dt * 2.0 * speedRatio;

      if (this.keys.left) this.playerX -= dx * steerPower;
      if (this.keys.right) this.playerX += dx * steerPower;

      this.playerX -= dx * speedRatio * currentSegment.curve * 1.5;

      this.isDrafting = false;
      this.aiCars.forEach(ai => {
        if (Math.abs(ai.offset - this.playerX) < 0.35 && ai.z > this.position && ai.z < this.position + 1400) {
          this.isDrafting = true;
          this.speed = Math.min(this.maxSpeed * 1.15, this.speed + 1200 * dt);
          if (Math.random() < 0.15) audio.draftWhoosh();
        }
      });

      const draftBanner = document.getElementById('hud-draft-banner');
      if (this.isDrafting) draftBanner.classList.remove('hidden');
      else draftBanner.classList.add('hidden');

      audio.updateEngine(speedRatio, this.keys.up);

      if (this.position < 1600 && this.playerX > 0.85 && this.speed < 2400 && !this.inPitZone) {
        this.inPitZone = true;
        this.state = 'PIT';
        audio.muteEngine();
        document.getElementById('screen-pit').classList.remove('hidden');
      }
      if (this.position > 2000) this.inPitZone = false;
    }

    this.position = (this.position + this.speed * dt);
    while (this.position >= this.trackLength) {
      this.position -= this.trackLength;
      this.onLapComplete();
    }

    this.updateAI(dt);
    this.particles.update(dt);
    this.updateHUD();
  }

  updateAI(dt) {
    this.aiCars.forEach(ai => {
      const seg = this.findSegment(ai.z);
      const isCurving = Math.abs(seg.curve) > 2;

      let targetSpeed = ai.maxSpeed;
      if (isCurving) targetSpeed *= 0.72;

      if (ai.speed < targetSpeed) ai.speed += 2800 * dt;
      else ai.speed -= 3500 * dt;

      ai.offset += (seg.curve * -0.015) * dt * (ai.speed / 10000);
      ai.offset = Math.max(-0.8, Math.min(0.8, ai.offset));

      ai.z = (ai.z + ai.speed * dt);
      while (ai.z >= this.trackLength) {
        ai.z -= this.trackLength;
        ai.lap++;
      }

      const distZ = Math.abs(ai.z - this.position);
      if (distZ < 250 && Math.abs(ai.offset - this.playerX) < 0.28) {
        this.speed *= 0.65;
        ai.speed *= 0.75;
        this.damage = Math.min(100, this.damage + 8);
        this.playerX += (this.playerX > ai.offset ? 0.25 : -0.25);
        audio.crash();
        this.particles.spawn(this.canvas.width / 2 + (this.playerX * 120), this.canvas.height - 40, 15, '#ffaa00', 4);
      }
    });
  }

  onLapComplete() {
    if (this.currentLapTime < this.bestLapTime && this.lap > 1) {
      this.bestLapTime = this.currentLapTime;
      audio.checkpoint();
      const techBanner = document.getElementById('hud-technique-banner');
      techBanner.innerText = `FASTEST LAP! ${this.formatTime(this.bestLapTime)}`;
      techBanner.classList.remove('hidden');
      setTimeout(() => techBanner.classList.add('hidden'), 2500);
    }

    this.lapStartTime = this.raceTimer;
    this.lap++;

    const totalLaps = TRACKS[this.currentTrackIdx].laps;
    if (this.lap > totalLaps) {
      this.finishRace();
    }
  }

  finishRace() {
    this.state = 'RESULTS';
    audio.muteEngine();
    audio.victoryJingle();
    document.getElementById('hud-layer').classList.add('hidden');

    const playerTotalTime = this.raceTimer;
    const allDrivers = [
      { name: "Player", isPlayer: true, time: playerTotalTime, car: CARS[this.playerCarIdx] },
      ...this.aiCars.map(ai => ({ name: ai.name, isPlayer: false, time: playerTotalTime + (Math.random() * 8 - 4), car: ai.car }))
    ];
    allDrivers.sort((a, b) => a.time - b.time);

    const playerPos = allDrivers.findIndex(d => d.isPlayer) + 1;
    const pointsMap = [25, 18, 15, 12, 10, 8];
    const earnedPoints = pointsMap[playerPos - 1] || 4;

    if (this.isChampionship) {
      allDrivers.forEach((d, i) => {
        const entry = this.champScores.find(s => s.name === d.name);
        if (entry) entry.pts += (pointsMap[i] || 4);
      });
    }

    document.getElementById('results-headline').innerText = playerPos === 1 ? "VICTORY! 1ST PLACE" : "RACE COMPLETE";
    document.getElementById('res-pos').innerText = `${playerPos}${playerPos === 1 ? 'ST' : (playerPos === 2 ? 'ND' : (playerPos === 3 ? 'RD' : 'TH'))}`;
    document.getElementById('res-time').innerText = this.formatTime(playerTotalTime);
    document.getElementById('res-best').innerText = this.bestLapTime !== Infinity ? this.formatTime(this.bestLapTime) : this.formatTime(playerTotalTime);
    document.getElementById('res-overtakes').innerText = String(Math.max(1, 6 - playerPos + Math.floor(Math.random() * 3)));
    document.getElementById('res-fuel').innerText = `${Math.floor((this.fuel / CARS[this.playerCarIdx].fuelCap) * 100)}%`;
    document.getElementById('res-dmg').innerText = `${Math.floor(this.damage)}%`;
    document.getElementById('res-points').innerText = `+${earnedPoints} PTS`;

    document.getElementById('screen-results').classList.remove('hidden');
  }

  updateHUD() {
    const track = TRACKS[this.currentTrackIdx];
    const speedKmh = Math.floor(this.speed * 0.024);

    let rank = 1;
    this.aiCars.forEach(ai => {
      const aiScore = ai.lap * 100000 + ai.z;
      const playerScore = this.lap * 100000 + this.position;
      if (aiScore > playerScore) rank++;
    });

    document.getElementById('hud-pos').innerText = `${rank}/6`;
    document.getElementById('hud-lap').innerText = `${Math.min(this.lap, track.laps)}/${track.laps}`;
    document.getElementById('hud-time').innerText = this.formatTime(this.raceTimer);
    document.getElementById('hud-best-lap').innerText = this.bestLapTime !== Infinity ? this.formatTime(this.bestLapTime) : "--:--.---";

    const car = CARS[this.playerCarIdx];
    const fuelPct = Math.max(0, (this.fuel / car.fuelCap) * 100);
    document.getElementById('hud-fuel-bar').style.width = `${fuelPct}%`;
    document.getElementById('hud-fuel-text').innerText = `${Math.floor(fuelPct)}%`;

    document.getElementById('hud-grip-bar').style.width = `${this.grip}%`;
    document.getElementById('hud-grip-text').innerText = `${Math.floor(this.grip)}%`;

    document.getElementById('hud-dmg-bar').style.width = `${this.damage}%`;
    document.getElementById('hud-dmg-text').innerText = `${Math.floor(this.damage)}%`;

    document.getElementById('hud-speed').innerText = speedKmh;
    const gear = Math.min(5, Math.floor(speedKmh / 50) + 1);
    document.getElementById('hud-gear').innerText = gear;
    const rpmPct = ((speedKmh % 55) / 55) * 100;
    document.getElementById('hud-rpm-bar').style.width = `${rpmPct}%`;

    this.drawMinimap(rank);
  }

  drawMinimap(playerRank) {
    const ctx = this.mCtx;
    ctx.clearRect(0, 0, 130, 130);

    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(65, 65, 50, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(63, 12, 4, 8);

    this.aiCars.forEach(ai => {
      const angle = (ai.z / this.trackLength) * Math.PI * 2 - Math.PI / 2;
      const bx = 65 + Math.cos(angle) * 50;
      const by = 65 + Math.sin(angle) * 50;
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
    });

    const pAngle = (this.position / this.trackLength) * Math.PI * 2 - Math.PI / 2;
    const px = 65 + Math.cos(pAngle) * 50;
    const py = 65 + Math.sin(pAngle) * 50;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  formatTime(s) {
    if (s === Infinity || s === 0) return "00:00.000";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
  }

  findSegment(z) {
    return this.segments[Math.floor(z / this.segmentLength) % this.segments.length];
  }

  // ==========================================
  // 7. ROBUST 3D RENDERING PIPELINE
  // ==========================================
  render() {
    if (this.segments.length === 0) return;
    const ctx = this.ctx;
    const trackDef = TRACKS[this.currentTrackIdx];

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.55);
    skyGrad.addColorStop(0, trackDef.sky[0]);
    skyGrad.addColorStop(0.4, trackDef.sky[1]);
    skyGrad.addColorStop(0.8, trackDef.sky[2]);
    skyGrad.addColorStop(1, trackDef.sky[3]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.55);

    // Distant horizon scenery
    this.renderHorizonScenery(ctx, trackDef.scenery);

    // Pre-fill bottom ground to eliminate black void glitches
    ctx.fillStyle = trackDef.roadColor.grass;
    ctx.fillRect(0, this.canvas.height * 0.5, this.canvas.width, this.canvas.height * 0.5);

    // Smooth dynamic camera position
    const baseSegment = this.findSegment(this.position);
    const basePercent = (this.position % this.segmentLength) / this.segmentLength;
    const playerWorldY = easeInOut(baseSegment.p1.world.y, baseSegment.p2.world.y, basePercent);
    const cameraY = playerWorldY + this.cameraHeight;

    // Project visible segments
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    const renderQueue = [];

    for (let n = 0; n < this.drawDistance; n++) {
      const segment = this.segments[(baseSegment.index + n) % this.segments.length];
      const looped = segment.index < baseSegment.index;
      const camZ = this.position - (looped ? this.trackLength : 0);

      this.project(segment.p1, (this.playerX * this.roadWidth) - x, cameraY, camZ, this.cameraDepth, this.canvas.width, this.canvas.height, this.roadWidth);
      this.project(segment.p2, (this.playerX * this.roadWidth) - x - dx, cameraY, camZ, this.cameraDepth, this.canvas.width, this.canvas.height, this.roadWidth);

      x += dx;
      dx += segment.curve;

      if (segment.p1.camera.z <= this.cameraDepth) continue;
      renderQueue.push(segment);
    }

    // Painter's Algorithm: Back-to-Front
    for (let i = renderQueue.length - 1; i >= 0; i--) {
      const segment = renderQueue[i];
      if (segment.p2.screen.y >= segment.p1.screen.y) continue;

      const isAlternate = Math.floor(segment.index / this.rumbleLength) % 2 === 0;
      const color = isAlternate ? trackDef.roadColor.light : trackDef.roadColor.dark;
      const rumbleColor = isAlternate ? trackDef.roadColor.rumble : trackDef.roadColor.rumbleAlt;

      // Grass terrain
      ctx.fillStyle = trackDef.roadColor.grass;
      ctx.fillRect(0, segment.p2.screen.y, this.canvas.width, segment.p1.screen.y - segment.p2.screen.y);

      // Rumble & Road Polygons
      this.drawPolygon(ctx, segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w * 1.2, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w * 1.2, rumbleColor);
      this.drawPolygon(ctx, segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w, color);

      // Center Lane Striping
      if (isAlternate) {
        this.drawPolygon(ctx, segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w * 0.03, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w * 0.03, '#ffffff');
      }

      // Pit Lane Marker
      if (segment.index < 12) {
        this.drawPolygon(ctx, segment.p1.screen.x + segment.p1.screen.w * 0.85, segment.p1.screen.y, segment.p1.screen.w * 0.15,
                              segment.p2.screen.x + segment.p2.screen.w * 0.85, segment.p2.screen.y, segment.p2.screen.w * 0.15, '#00ffff');
      }

      // Roadside Sprites
      if (segment.index % 18 === 0) {
        const side = segment.index % 36 === 0 ? -1 : 1;
        const spriteX = segment.p1.screen.x + side * segment.p1.screen.w * 1.5;
        const spriteY = segment.p1.screen.y;
        this.renderRoadsideSprite(ctx, spriteX, spriteY, segment.p1.screen.scale, trackDef.scenery);
      }

      // AI Opponents
      this.aiCars.forEach(ai => {
        if (Math.floor(ai.z / this.segmentLength) === segment.index) {
          const carX = segment.p1.screen.x + (ai.offset * segment.p1.screen.w);
          const carY = segment.p1.screen.y;
          const scale = segment.p1.screen.scale * 1.8;
          this.renderCarSprite(ctx, carX, carY, scale, ai.car.color, ai.car.stripe, 0, false, ai.speed);
        }
      });
    }

    // Player Car
    const playerCar = CARS[this.playerCarIdx];
    const steerAngle = this.keys.left ? -0.25 : (this.keys.right ? 0.25 : 0);
    this.renderCarSprite(ctx, this.canvas.width / 2, this.canvas.height - 30, 3.4, playerCar.color, playerCar.stripe, steerAngle, this.keys.down, this.speed);

    // Particles
    this.particles.draw(ctx);
  }

  project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / Math.max(0.1, p.camera.z);
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
  }

  drawPolygon(ctx, x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x2 - w2, y2);
    ctx.closePath();
    ctx.fill();
  }

  renderHorizonScenery(ctx, type) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
    for (let i = 0; i < 6; i++) {
      const hx = (i * 180) - (this.playerX * 30) % 180;
      if (type === 'building') {
        ctx.fillRect(hx, this.canvas.height * 0.35, 90, this.canvas.height * 0.2);
        ctx.fillRect(hx + 110, this.canvas.height * 0.3, 60, this.canvas.height * 0.25);
      } else {
        ctx.beginPath();
        ctx.moveTo(hx - 80, this.canvas.height * 0.55);
        ctx.lineTo(hx + 40, this.canvas.height * 0.25);
        ctx.lineTo(hx + 160, this.canvas.height * 0.55);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderRoadsideSprite(ctx, x, y, scale, type) {
    const s = scale * 180;
    if (s <= 2) return;
    ctx.save();
    if (type === 'palm') {
      ctx.fillStyle = '#664422';
      ctx.fillRect(x - s * 0.08, y - s * 1.1, s * 0.16, s * 1.1);
      ctx.fillStyle = '#228833';
      ctx.beginPath();
      ctx.arc(x, y - s * 1.1, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'building') {
      ctx.fillStyle = '#1e1e2f';
      ctx.fillRect(x - s * 0.3, y - s * 1.4, s * 0.6, s * 1.4);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(x - s * 0.2, y - s * 1.2, s * 0.1, s * 0.15);
      ctx.fillRect(x + s * 0.1, y - s * 1.2, s * 0.1, s * 0.15);
    } else {
      ctx.fillStyle = '#1b4d24';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y);
      ctx.lineTo(x, y - s * 1.2);
      ctx.lineTo(x + s * 0.35, y);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // 8. PROCEDURAL PIXEL-ART CAR RENDERER
  // ==========================================
  renderCarSprite(ctx, x, y, scale, bodyColor, stripeColor, steerAngle, isBraking, currentSpeed) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);

    // Chassis Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-22, -4, 44, 10);

    // Tires
    ctx.fillStyle = '#111115';
    ctx.fillRect(-24, -14, 8, 18);
    ctx.fillRect(16, -14, 8, 18);

    // Main Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-18, -20, 36, 18);

    // Rear Wing
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(-20, -24, 40, 5);

    // Center Racing Stripe
    ctx.fillStyle = stripeColor;
    ctx.fillRect(-3, -20, 6, 18);

    // Cockpit Glass
    ctx.fillStyle = '#111c24';
    ctx.fillRect(-11, -17, 22, 7);

    // Taillights
    ctx.fillStyle = isBraking ? '#ff0033' : '#770011';
    ctx.fillRect(-16, -6, 7, 4);
    ctx.fillRect(9, -6, 7, 4);

    // Nitro Flames
    if (currentSpeed > 8000 && Math.random() < 0.6) {
      ctx.fillStyle = Math.random() < 0.5 ? '#00ffff' : '#ffaa00';
      ctx.fillRect(-12, 1, 4, 6);
      ctx.fillRect(8, 1, 4, 6);
    }

    ctx.restore();
  }

  // ==========================================
  // 9. GAME ENGINE LOOP
  // ==========================================
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }
}

// Launch Engine on Load
window.addEventListener('load', () => {
  const engine = new RaceEngine();
  requestAnimationFrame(t => engine.loop(t));
});