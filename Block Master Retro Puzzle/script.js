/**
 * BLOCK MASTER: RETRO PUZZLE
 * Complete Falling-Block Puzzle Simulation Engine
 * 100% Vanilla JavaScript & Web Audio API
 */

// ==========================================
// 1. AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
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

  move() { this.playTone(280, 200, 'square', 0.04, 0.08); }
  rotate() { this.playTone(340, 480, 'sine', 0.06, 0.12); }
  softDrop() { this.playTone(160, 120, 'triangle', 0.03, 0.06); }
  hardDrop() { this.playTone(120, 40, 'sawtooth', 0.14, 0.25); }
  lock() { this.playTone(220, 110, 'square', 0.09, 0.15); }
  hold() { this.playTone(400, 600, 'triangle', 0.08, 0.14); }
  
  lineClear(count = 1) {
    if (count === 4) {
      // Quad / Master Clear Chime
      [440, 554, 659, 880].forEach((f, i) => {
        setTimeout(() => this.playTone(f, f * 1.2, 'square', 0.18, 0.25), i * 60);
      });
    } else {
      [320, 480].forEach((f, i) => {
        setTimeout(() => this.playTone(f, f + 40, 'triangle', 0.12, 0.18), i * 50);
      });
    }
  }

  combo(multiplier) {
    const base = 300 + Math.min(600, multiplier * 80);
    this.playTone(base, base * 1.3, 'sine', 0.15, 0.2);
  }

  levelUp() {
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, f, 'sine', 0.18, 0.22), i * 80);
    });
  }

  gameOver() {
    [300, 260, 220, 160].forEach((f, i) => {
      setTimeout(() => this.playTone(f, f - 20, 'sawtooth', 0.25, 0.25), i * 120);
    });
  }

  button() { this.playTone(600, 800, 'sine', 0.05, 0.1); }
}

const audio = new SoundEngine();

// ==========================================
// 2. TETROMINO PIECE DEFINITIONS & 7-BAG
// ==========================================
const SHAPES = {
  I: {
    id: 'I',
    matrix: [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0]
    ],
    color: '#00f0ff',
    shadow: '#008899',
    highlight: '#c8ffff'
  },
  O: {
    id: 'O',
    matrix: [
      [1,1],
      [1,1]
    ],
    color: '#ffdd00',
    shadow: '#aa9900',
    highlight: '#ffffcc'
  },
  T: {
    id: 'T',
    matrix: [
      [0,1,0],
      [1,1,1],
      [0,0,0]
    ],
    color: '#bb00ff',
    shadow: '#660099',
    highlight: '#f0c8ff'
  },
  S: {
    id: 'S',
    matrix: [
      [0,1,1],
      [1,1,0],
      [0,0,0]
    ],
    color: '#39ff14',
    shadow: '#1b8808',
    highlight: '#d5ffcc'
  },
  Z: {
    id: 'Z',
    matrix: [
      [1,1,0],
      [0,1,1],
      [0,0,0]
    ],
    color: '#ff2255',
    shadow: '#990022',
    highlight: '#ffccd8'
  },
  J: {
    id: 'J',
    matrix: [
      [1,0,0],
      [1,1,1],
      [0,0,0]
    ],
    color: '#0066ff',
    shadow: '#003399',
    highlight: '#cce0ff'
  },
  L: {
    id: 'L',
    matrix: [
      [0,0,1],
      [1,1,1],
      [0,0,0]
    ],
    color: '#ff7700',
    shadow: '#994400',
    highlight: '#ffe4cc'
  }
};

class PieceBag {
  constructor() {
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      const keys = Object.keys(SHAPES);
      // Fisher-Yates shuffle
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      this.bag = keys.map(k => JSON.parse(JSON.stringify(SHAPES[k])));
    }
    return this.bag.pop();
  }
}

// ==========================================
// 3. PARTICLE & VISUAL FX SYSTEM
// ==========================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnBlockExplosion(x, y, color, size, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: color,
        size: Math.random() * size * 0.4 + 2,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.vy += 9.8 * dt; // Gravity
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
// 4. STORAGE & HIGHSCORE MANAGER
// ==========================================
class StorageManager {
  static getScores(mode) {
    try {
      const data = localStorage.getItem(`bm_scores_${mode}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveScore(mode, entry) {
    try {
      const list = this.getScores(mode);
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      const top10 = list.slice(0, 10);
      localStorage.setItem(`bm_scores_${mode}`, JSON.stringify(top10));
      return top10;
    } catch (e) {
      return [];
    }
  }
}

// ==========================================
// 5. GAME ENGINE
// ==========================================
class GameEngine {
  constructor() {
    this.boardCanvas = document.getElementById('boardCanvas');
    this.bCtx = this.boardCanvas.getContext('2d');
    this.holdCanvas = document.getElementById('holdCanvas');
    this.hCtx = this.holdCanvas.getContext('2d');
    this.nextCanvas = document.getElementById('nextCanvas');
    this.nCtx = this.nextCanvas.getContext('2d');
    this.bgCanvas = document.getElementById('bgCanvas');
    this.bgCtx = this.bgCanvas.getContext('2d');

    this.cols = 10;
    this.rows = 20;
    this.blockSize = 30; // 10 cols * 30 = 300 width, 20 rows * 30 = 600 height

    this.particles = new ParticleSystem();
    this.bag = new PieceBag();

    this.state = 'MENU'; // MENU, MODES, CHALLENGES, SCORES, SETTINGS, HOW, PLAYING, PAUSED, GAMEOVER
    this.mode = 'classic'; // classic, timeattack, sprint, marathon, challenge
    this.difficulty = 'normal';
    this.ghostEnabled = true;
    this.reducedMotion = false;

    // Board Matrix
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));

    // Active Pieces
    this.currentPiece = null;
    this.holdPiece = null;
    this.nextPieces = [];
    this.canHold = true;

    // Timing & Physics
    this.dropCounter = 0;
    this.dropInterval = 1000;
    this.lockTimer = 0;
    this.lockLimit = 500; // ms to slide before locking
    this.lastTime = 0;

    // Stats
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.backToBack = false;
    this.gameTimer = 0;
    this.timeLimit = 120; // For time attack

    // Clearing Animation State
    this.clearingLines = [];
    this.clearAnimTimer = 0;

    // Challenges Configuration
    this.challenges = [
      { id: 1, name: "QUICK SPRINT", desc: "Clear 10 lines within 45 seconds.", linesGoal: 10, timeLimit: 45 },
      { id: 2, name: "MASTER COMBO", desc: "Achieve a 4x Combo streak.", comboGoal: 4 },
      { id: 3, name: "QUAD BLAST", desc: "Clear 2 Quad (4-line) rows.", quadsGoal: 2, quadsDone: 0 },
      { id: 4, name: "SCORE SURGE", desc: "Score 8,000 points in under 60 seconds.", scoreGoal: 8000, timeLimit: 60 },
      { id: 5, name: "HYPER SURVIVAL", desc: "Survive 60s on Extreme Speed.", timeGoal: 60, speed: 120 }
    ];
    this.activeChallenge = null;

    // Background Animated Polys
    this.bgPolys = [];
    this.initBgPolys();

    this.initInputs();
    this.initUI();
    this.resizeBg();
    window.addEventListener('resize', () => this.resizeBg());
  }

  resizeBg() {
    this.bgCanvas.width = window.innerWidth;
    this.bgCanvas.height = window.innerHeight;
  }

  initBgPolys() {
    const keys = Object.keys(SHAPES);
    for (let i = 0; i < 20; i++) {
      this.bgPolys.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        shape: SHAPES[keys[Math.floor(Math.random() * keys.length)]],
        size: Math.random() * 18 + 12,
        speed: Math.random() * 40 + 20,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 1.5,
        alpha: Math.random() * 0.15 + 0.05
      });
    }
  }

  initInputs() {
    window.addEventListener('keydown', e => {
      audio.init();
      audio.resume();

      if (this.state === 'PLAYING') {
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.movePiece(-1);
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.movePiece(1);
        if (['ArrowDown', 'KeyS'].includes(e.code)) this.softDrop();
        if (['ArrowUp', 'KeyX'].includes(e.code)) this.rotatePiece(1);
        if (e.code === 'KeyZ') this.rotatePiece(-1);
        if (e.code === 'Space') this.hardDrop();
        if (['KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) this.holdCurrentPiece();
        if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
        if (e.code === 'KeyR') this.startNewGame();
      } else if (this.state === 'PAUSED') {
        if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
        if (e.code === 'KeyR') this.startNewGame();
      }

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    // Touch Virtual Key Bindings
    const bindTouch = (id, action) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const handler = (e) => {
        e.preventDefault();
        audio.init();
        audio.resume();
        if (this.state === 'PLAYING') action();
      };
      btn.addEventListener('touchstart', handler);
      btn.addEventListener('mousedown', handler);
    };

    bindTouch('t-left', () => this.movePiece(-1));
    bindTouch('t-right', () => this.movePiece(1));
    bindTouch('t-down', () => this.softDrop());
    bindTouch('t-rot-cw', () => this.rotatePiece(1));
    bindTouch('t-rot-ccw', () => this.rotatePiece(-1));
    bindTouch('t-hold', () => this.holdCurrentPiece());
    bindTouch('t-drop', () => this.hardDrop());
  }

  initUI() {
    const showScreen = (id) => {
      audio.button();
      document.querySelectorAll('.screen-panel').forEach(s => s.classList.add('hidden'));
      document.getElementById(id).classList.remove('hidden');
    };

    // Main Menu Nav
    document.getElementById('btn-menu-start').onclick = () => {
      this.mode = 'classic';
      this.activeChallenge = null;
      this.startNewGame();
    };
    document.getElementById('btn-menu-modes').onclick = () => showScreen('screen-modes');
    document.getElementById('btn-menu-challenges').onclick = () => {
      this.renderChallengeList();
      showScreen('screen-challenges');
    };
    document.getElementById('btn-menu-scores').onclick = () => {
      this.renderLeaderboards('classic');
      showScreen('screen-scores');
    };
    document.getElementById('btn-menu-how').onclick = () => showScreen('screen-how');
    document.getElementById('btn-menu-settings').onclick = () => showScreen('screen-settings');

    // Modes Screen
    document.querySelectorAll('.mode-card').forEach(card => {
      card.onclick = () => {
        audio.button();
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.mode = card.getAttribute('data-mode');
      };
    });
    document.getElementById('btn-mode-launch').onclick = () => {
      this.activeChallenge = null;
      this.startNewGame();
    };
    document.getElementById('btn-mode-back').onclick = () => showScreen('screen-menu');

    // Challenges Screen
    document.getElementById('btn-challenge-back').onclick = () => showScreen('screen-menu');
    document.getElementById('btn-launch-challenge').onclick = () => {
      if (this.activeChallenge) {
        this.mode = 'challenge';
        this.startNewGame();
      }
    };

    // Scores Screen
    document.getElementById('btn-scores-back').onclick = () => showScreen('screen-menu');
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.onclick = () => {
        audio.button();
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderLeaderboards(tab.getAttribute('data-tab'));
      };
    });

    // Back Buttons
    document.getElementById('btn-how-back').onclick = () => showScreen('screen-menu');
    document.getElementById('btn-settings-back').onclick = () => {
      this.saveSettings();
      showScreen('screen-menu');
    };

    // Pause Modals
    document.getElementById('btn-pause-resume').onclick = () => this.togglePause();
    document.getElementById('btn-pause-restart').onclick = () => this.startNewGame();
    document.getElementById('btn-pause-menu').onclick = () => {
      document.getElementById('modal-pause').classList.add('hidden');
      this.state = 'MENU';
      showScreen('screen-menu');
    };

    // Game Over Modals
    document.getElementById('btn-go-retry').onclick = () => {
      this.saveCurrentHighScore();
      this.startNewGame();
    };
    document.getElementById('btn-go-menu').onclick = () => {
      this.saveCurrentHighScore();
      document.getElementById('modal-gameover').classList.add('hidden');
      this.state = 'MENU';
      showScreen('screen-menu');
    };
  }

  saveSettings() {
    this.difficulty = document.getElementById('sel-difficulty').value;
    audio.muted = !document.getElementById('chk-sfx').checked;
    audio.volume = parseInt(document.getElementById('rng-volume').value) / 100;
    this.ghostEnabled = document.getElementById('chk-ghost').checked;
    this.reducedMotion = document.getElementById('chk-reduced-motion').checked;
  }

  renderChallengeList() {
    const container = document.getElementById('challenge-container');
    container.innerHTML = '';
    this.challenges.forEach((ch, idx) => {
      const card = document.createElement('div');
      card.className = `challenge-card ${idx === 0 ? 'active' : ''}`;
      card.innerHTML = `
        <div class="ch-info">
          <h4>#${ch.id} ${ch.name}</h4>
          <p>${ch.desc}</p>
        </div>
        <span class="ch-status">READY</span>
      `;
      card.onclick = () => {
        audio.button();
        document.querySelectorAll('.challenge-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.activeChallenge = ch;
      };
      container.appendChild(card);
    });
    this.activeChallenge = this.challenges[0];
  }

  renderLeaderboards(mode) {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    const scores = StorageManager.getScores(mode);
    if (scores.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#6688aa; padding:20px;">NO HIGH SCORES RECORDED</td></tr>`;
      return;
    }
    scores.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="${i === 0 ? 'gold' : ''}">${i + 1}</td>
        <td>${entry.name}</td>
        <td class="gold">${entry.score}</td>
        <td>${entry.lines}</td>
        <td>${entry.level}</td>
        <td>${entry.date}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  startNewGame() {
    document.querySelectorAll('.screen-panel').forEach(s => s.classList.add('hidden'));
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-gameover').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');

    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.bag = new PieceBag();
    this.holdPiece = null;
    this.canHold = true;
    this.nextPieces = [this.bag.next(), this.bag.next(), this.bag.next()];

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.backToBack = false;
    this.gameTimer = 0;
    this.dropCounter = 0;
    this.clearingLines = [];

    // Mode Specific Objectives
    if (this.mode === 'challenge' && this.activeChallenge) {
      if (this.activeChallenge.quadsGoal) this.activeChallenge.quadsDone = 0;
    }

    this.updateSpeed();
    this.spawnPiece();
    this.state = 'PLAYING';
    this.updateHUD();
  }

  updateSpeed() {
    const diffMultipliers = { easy: 1.25, normal: 1.0, hard: 0.75, extreme: 0.4 };
    const mult = diffMultipliers[this.difficulty] || 1.0;
    // Standard retro gravity curve (ms per row drop)
    const baseInterval = Math.max(80, (1000 - (this.level - 1) * 75) * mult);
    this.dropInterval = (this.mode === 'challenge' && this.activeChallenge && this.activeChallenge.speed)
      ? this.activeChallenge.speed
      : baseInterval;
  }

  spawnPiece() {
    this.currentPiece = this.nextPieces.shift();
    this.nextPieces.push(this.bag.next());
    this.canHold = true;

    // Centered spawn coordinates
    this.currentPiece.x = Math.floor((this.cols - this.currentPiece.matrix[0].length) / 2);
    this.currentPiece.y = 0;

    // Collision upon spawn = Top out (Game Over)
    if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.triggerGameOver('TOP OUT');
    }
  }

  checkCollision(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const targetX = px + c;
          const targetY = py + r;

          // Wall / Bottom boundaries
          if (targetX < 0 || targetX >= this.cols || targetY >= this.rows) {
            return true;
          }
          // Board Occupied Cells (ignore above ceiling)
          if (targetY >= 0 && this.grid[targetY][targetX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  movePiece(dir) {
    if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x + dir, this.currentPiece.y)) {
      this.currentPiece.x += dir;
      audio.move();
      this.lockTimer = 0; // Reset lock delay
    }
  }

  rotatePiece(dir) {
    const original = this.currentPiece.matrix;
    const N = original.length;
    // Matrix transpose + reverse for rotation
    const rotated = original.map((row, i) =>
      row.map((val, j) => (dir === 1 ? original[N - 1 - j][i] : original[j][N - 1 - i]))
    );

    // Super Wall-Kick System offsets
    const kicks = [0, -1, 1, -2, 2];
    for (let k of kicks) {
      if (!this.checkCollision(rotated, this.currentPiece.x + k, this.currentPiece.y)) {
        this.currentPiece.matrix = rotated;
        this.currentPiece.x += k;
        audio.rotate();
        this.lockTimer = 0;
        return;
      }
    }
  }

  softDrop() {
    if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      this.score += 1; // Soft drop bonus
      audio.softDrop();
      this.updateHUD();
    }
  }

  hardDrop() {
    let dropDist = 0;
    while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      dropDist++;
    }
    this.score += dropDist * 2; // Hard drop bonus (+2/cell)
    audio.hardDrop();

    if (!this.reducedMotion) {
      // Spawn dust shockwaves at landing
      const px = this.currentPiece.x * this.blockSize + (this.currentPiece.matrix[0].length * this.blockSize) / 2;
      const py = (this.currentPiece.y + this.currentPiece.matrix.length) * this.blockSize;
      this.particles.spawnBlockExplosion(px, py, this.currentPiece.color, this.blockSize, 12);
    }

    this.lockPiece();
  }

  holdCurrentPiece() {
    if (!this.canHold) return;
    audio.hold();
    if (!this.holdPiece) {
      this.holdPiece = JSON.parse(JSON.stringify(SHAPES[this.currentPiece.id]));
      this.spawnPiece();
    } else {
      const temp = JSON.parse(JSON.stringify(SHAPES[this.currentPiece.id]));
      this.currentPiece = JSON.parse(JSON.stringify(SHAPES[this.holdPiece.id]));
      this.holdPiece = temp;
      this.currentPiece.x = Math.floor((this.cols - this.currentPiece.matrix[0].length) / 2);
      this.currentPiece.y = 0;
    }
    this.canHold = false;
    this.drawHoldPiece();
  }

  getGhostPosition() {
    const ghost = { ...this.currentPiece, y: this.currentPiece.y };
    while (!this.checkCollision(ghost.matrix, ghost.x, ghost.y + 1)) {
      ghost.y++;
    }
    return ghost.y;
  }

  lockPiece() {
    audio.lock();
    const mat = this.currentPiece.matrix;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (mat[r][c]) {
          const gy = this.currentPiece.y + r;
          const gx = this.currentPiece.x + c;
          if (gy >= 0 && gy < this.rows) {
            this.grid[gy][gx] = this.currentPiece.color;
          }
        }
      }
    }

    this.checkLines();
  }

  checkLines() {
    this.clearingLines = [];
    for (let r = 0; r < this.rows; r++) {
      if (this.grid[r].every(cell => cell !== 0)) {
        this.clearingLines.push(r);
      }
    }

    if (this.clearingLines.length > 0) {
      this.clearAnimTimer = this.reducedMotion ? 0 : 200; // Flash effect
      audio.lineClear(this.clearingLines.length);

      // Score Computation & Multipliers
      const lineScores = [0, 100, 300, 500, 800];
      let pts = lineScores[this.clearingLines.length] * this.level;

      // Back to back 4-line clear bonus
      if (this.clearingLines.length === 4) {
        if (this.backToBack) pts = Math.floor(pts * 1.5);
        this.backToBack = true;
        if (this.mode === 'challenge' && this.activeChallenge && this.activeChallenge.quadsGoal) {
          this.activeChallenge.quadsDone++;
        }
      } else {
        this.backToBack = false;
      }

      // Combo Chain Bonus
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (this.combo > 1) {
        const comboBonus = 50 * (this.combo - 1) * this.level;
        pts += comboBonus;
        audio.combo(this.combo);
        this.showComboPopup(`COMBO x${this.combo}! +${comboBonus}`);
      }

      this.score += pts;
      this.lines += this.clearingLines.length;

      // Particles along completed lines
      if (!this.reducedMotion) {
        this.clearingLines.forEach(rowIdx => {
          for (let colIdx = 0; colIdx < this.cols; colIdx++) {
            this.particles.spawnBlockExplosion(
              colIdx * this.blockSize + this.blockSize / 2,
              rowIdx * this.blockSize + this.blockSize / 2,
              this.grid[rowIdx][colIdx] || '#fff',
              this.blockSize,
              4
            );
          }
        });
      }

      // Level Progression (Every 10 lines)
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        this.updateSpeed();
        audio.levelUp();
        this.showBanner('LEVEL UP!');
      }

      this.checkModeObjectives();
    } else {
      this.combo = 0;
      this.spawnPiece();
    }

    this.updateHUD();
  }

  finalizeLineRemoval() {
    this.clearingLines.forEach(rowIdx => {
      this.grid.splice(rowIdx, 1);
      this.grid.unshift(Array(this.cols).fill(0));
    });
    this.clearingLines = [];
    this.spawnPiece();
  }

  checkModeObjectives() {
    if (this.mode === 'sprint' && this.lines >= 40) {
      this.triggerGameOver('VICTORY!', '40 LINES CLEARED');
    } else if (this.mode === 'marathon' && this.lines >= 150) {
      this.triggerGameOver('VICTORY!', 'MARATHON SURVIVED');
    } else if (this.mode === 'challenge' && this.activeChallenge) {
      const ch = this.activeChallenge;
      if (ch.linesGoal && this.lines >= ch.linesGoal) this.triggerGameOver('CHALLENGE COMPLETE!');
      if (ch.comboGoal && this.combo >= ch.comboGoal) this.triggerGameOver('CHALLENGE COMPLETE!');
      if (ch.quadsGoal && ch.quadsDone >= ch.quadsGoal) this.triggerGameOver('CHALLENGE COMPLETE!');
      if (ch.scoreGoal && this.score >= ch.scoreGoal) this.triggerGameOver('CHALLENGE COMPLETE!');
    }
  }

  showBanner(txt) {
    const el = document.getElementById('hud-banner');
    el.innerText = txt;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 1200);
  }

  showComboPopup(txt) {
    const el = document.getElementById('hud-combo');
    el.innerText = txt;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 900);
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('modal-pause').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('modal-pause').classList.add('hidden');
    }
  }

  triggerGameOver(title = 'GAME OVER', subtitle = 'BOARD OVERFLOW') {
    this.state = 'GAMEOVER';
    audio.gameOver();

    document.getElementById('go-title').innerText = title;
    document.getElementById('go-subtitle').innerText = subtitle;
    document.getElementById('go-score').innerText = this.score;
    document.getElementById('go-lines').innerText = this.lines;
    document.getElementById('go-level').innerText = this.level;
    document.getElementById('go-combo').innerText = 'x' + this.maxCombo;
    document.getElementById('go-time').innerText = this.formatTime(this.gameTimer);

    // High Score Check
    const topScores = StorageManager.getScores(this.mode);
    const isHighScore = topScores.length < 10 || (topScores.length >= 10 && this.score > topScores[topScores.length - 1].score);
    const hiPrompt = document.getElementById('hi-score-prompt');
    if (isHighScore && this.score > 0) {
      hiPrompt.classList.remove('hidden');
    } else {
      hiPrompt.classList.add('hidden');
    }

    document.getElementById('modal-gameover').classList.remove('hidden');
  }

  saveCurrentHighScore() {
    const hiPrompt = document.getElementById('hi-score-prompt');
    if (!hiPrompt.classList.contains('hidden') && this.score > 0) {
      const name = document.getElementById('player-name-input').value.trim() || 'COMMANDO';
      const d = new Date();
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      StorageManager.saveScore(this.mode, {
        name: name.toUpperCase(),
        score: this.score,
        lines: this.lines,
        level: this.level,
        date: dateStr
      });
      hiPrompt.classList.add('hidden');
    }
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = String(this.score).padStart(6, '0');
    document.getElementById('hud-level').innerText = String(this.level).padStart(2, '0');
    document.getElementById('hud-lines').innerText = String(this.lines).padStart(3, '0');
    document.getElementById('hud-mode-name').innerText = this.mode.toUpperCase();

    // High score display
    const topList = StorageManager.getScores(this.mode);
    const best = topList.length > 0 ? topList[0].score : 0;
    document.getElementById('hud-hiscore').innerText = String(Math.max(best, this.score)).padStart(6, '0');

    // Mode Specific Status
    const targetLabel = document.getElementById('hud-target-label');
    const targetVal = document.getElementById('hud-target-val');
    if (this.mode === 'timeattack') {
      targetLabel.innerText = 'REMAINING';
      targetVal.innerText = this.formatTime(Math.max(0, this.timeLimit - this.gameTimer));
    } else if (this.mode === 'sprint') {
      targetLabel.innerText = 'TARGET';
      targetVal.innerText = `${this.lines}/40`;
    } else if (this.mode === 'marathon') {
      targetLabel.innerText = 'SURVIVAL';
      targetVal.innerText = `${this.lines}/150`;
    } else if (this.mode === 'challenge' && this.activeChallenge) {
      targetLabel.innerText = 'GOAL';
      targetVal.innerText = this.activeChallenge.name;
    } else {
      targetLabel.innerText = 'STATUS';
      targetVal.innerText = 'ENDLESS';
    }

    document.getElementById('hud-time').innerText = this.formatTime(this.gameTimer);
  }

  // ==========================================
  // 6. RENDER PIPELINE
  // ==========================================
  render(dt) {
    // Render Background Dynamic Polygons
    this.renderAnimatedBackground(dt);

    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAMEOVER') {
      this.drawBoard();
      this.drawHoldPiece();
      this.drawNextPieces();
      this.particles.draw(this.bCtx);
    }
  }

  renderAnimatedBackground(dt) {
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);

    this.bgPolys.forEach(p => {
      p.y += p.speed * dt;
      p.rot += p.rotSpd * dt;
      if (p.y > this.bgCanvas.height + 60) {
        p.y = -60;
        p.x = Math.random() * this.bgCanvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.shape.color;

      const mat = p.shape.matrix;
      const s = p.size;
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < mat[r].length; c++) {
          if (mat[r][c]) {
            ctx.fillRect((c - mat[0].length / 2) * s, (r - mat.length / 2) * s, s - 2, s - 2);
          }
        }
      }
      ctx.restore();
    });
  }

  drawBoard() {
    const ctx = this.bCtx;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // Subtle Retro Grid Lines
    ctx.strokeStyle = '#0d1326';
    ctx.lineWidth = 1;
    for (let c = 0; c < this.cols; c++) {
      ctx.strokeRect(c * this.blockSize, 0, this.blockSize, this.boardCanvas.height);
    }
    for (let r = 0; r < this.rows; r++) {
      ctx.strokeRect(0, r * this.blockSize, this.boardCanvas.width, this.blockSize);
    }

    // Locked Grid Blocks
    for (let r = 0; r < this.rows; r++) {
      const isClearing = this.clearingLines.includes(r);
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) {
          if (isClearing && Math.floor(Date.now() / 50) % 2 === 0) {
            this.draw3DBlock(ctx, c * this.blockSize, r * this.blockSize, this.blockSize, '#ffffff', '#ffffff', '#ffffff');
          } else {
            this.draw3DBlock(ctx, c * this.blockSize, r * this.blockSize, this.blockSize, this.grid[r][c]);
          }
        }
      }
    }

    // Ghost Landing Preview
    if (this.ghostEnabled && this.currentPiece && this.clearingLines.length === 0) {
      const ghostY = this.getGhostPosition();
      this.drawMatrix(ctx, this.currentPiece.matrix, this.currentPiece.x, ghostY, this.blockSize, this.currentPiece.color, true);
    }

    // Current Active Piece
    if (this.currentPiece && this.clearingLines.length === 0) {
      this.drawMatrix(ctx, this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y, this.blockSize, this.currentPiece.color, false);
    }
  }

  drawMatrix(ctx, matrix, ox, oy, size, color, isGhost = false) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const x = (ox + c) * size;
          const y = (oy + r) * size;
          if (isGhost) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25;
            ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
            ctx.restore();
          } else {
            this.draw3DBlock(ctx, x, y, size, color);
          }
        }
      }
    }
  }

  draw3DBlock(ctx, x, y, size, baseColor) {
    const bevel = Math.max(3, Math.floor(size * 0.15));

    // Base body fill
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);

    // Light Top & Left bevel highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size - bevel, y + bevel);
    ctx.lineTo(x + bevel, y + bevel);
    ctx.lineTo(x + bevel, y + size - bevel);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.fill();

    // Dark Bottom & Right shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x + bevel, y + size - bevel);
    ctx.lineTo(x + size - bevel, y + size - bevel);
    ctx.lineTo(x + size - bevel, y + bevel);
    ctx.closePath();
    ctx.fill();

    // Inner Glossy Square
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + bevel, y + bevel, size - bevel * 2, size - bevel * 2);
  }

  drawHoldPiece() {
    const ctx = this.hCtx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    if (!this.holdPiece) return;

    const mat = this.holdPiece.matrix;
    const s = 18;
    const ox = (this.holdCanvas.width - mat[0].length * s) / 2;
    const oy = (this.holdCanvas.height - mat.length * s) / 2;

    ctx.save();
    if (!this.canHold) ctx.globalAlpha = 0.4;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (mat[r][c]) {
          this.draw3DBlock(ctx, ox + c * s, oy + r * s, s, this.holdPiece.color);
        }
      }
    }
    ctx.restore();
  }

  drawNextPieces() {
    const ctx = this.nCtx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    const s = 18;

    this.nextPieces.forEach((piece, idx) => {
      const mat = piece.matrix;
      const ox = (this.nextCanvas.width - mat[0].length * s) / 2;
      const oy = 18 + idx * 56;
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < mat[r].length; c++) {
          if (mat[r][c]) {
            this.draw3DBlock(ctx, ox + c * s, oy + r * s, s, piece.color);
          }
        }
      }
    });
  }

  // ==========================================
  // 7. MAIN ENGINE LOOP
  // ==========================================
  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.gameTimer += dt;

    // Time Attack Limit Check
    if (this.mode === 'timeattack') {
      if (this.gameTimer >= this.timeLimit) {
        this.triggerGameOver('TIME UP!', '120s COMPLETED');
        return;
      }
    } else if (this.mode === 'challenge' && this.activeChallenge) {
      const ch = this.activeChallenge;
      if (ch.timeLimit && this.gameTimer >= ch.timeLimit) {
        this.triggerGameOver('CHALLENGE FAILED', 'TIME EXPIRED');
        return;
      }
      if (ch.timeGoal && this.gameTimer >= ch.timeGoal) {
        this.triggerGameOver('CHALLENGE COMPLETE!');
        return;
      }
    }

    // Line Clear Animation Timer
    if (this.clearingLines.length > 0) {
      this.clearAnimTimer -= dt * 1000;
      if (this.clearAnimTimer <= 0) {
        this.finalizeLineRemoval();
      }
      return;
    }

    // Gravity Drop Tick
    this.dropCounter += dt * 1000;
    if (this.dropCounter >= this.dropInterval) {
      this.dropCounter = 0;
      if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
        this.currentPiece.y++;
      } else {
        // Piece reached resting surface: Lock Delay
        this.lockTimer += this.dropInterval;
        if (this.lockTimer >= this.lockLimit) {
          this.lockPiece();
          this.lockTimer = 0;
        }
      }
    }

    this.particles.update(dt);
    this.updateHUD();
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render(dt);

    requestAnimationFrame(t => this.loop(t));
  }
}

// Initialize and Boot Game
window.addEventListener('load', () => {
  const game = new GameEngine();
  requestAnimationFrame(t => game.loop(t));
});