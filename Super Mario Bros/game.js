"use strict";

// ============================================================
// RETRO PLATFORM ADVENTURE
// Original 8-bit inspired canvas platformer using vanilla JS.
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const W = 960;
const H = 540;

canvas.width = W;
canvas.height = H;

const PHYSICS = {
  gravity: 1750,
  maxFall: 900,
  accel: 2600,
  friction: 1900,
  maxSpeed: 290,
  jump: -650,
  coyote: 0.10,
  jumpBuffer: 0.12
};

const keys = new Set();

const touch = {
  left: false,
  right: false,
  jump: false
};

const audio = {
  enabled: true,
  ctx: null
};

let game;

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function randFromSeed(n) {
  const x = Math.sin(n * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

// ------------------------------------------------------------
// Web Audio retro sound effects
// ------------------------------------------------------------

function beep(type) {
  if (!audio.enabled) return;

  try {
    if (!audio.ctx) {
      audio.ctx = new (
        window.AudioContext ||
        window.webkitAudioContext
      )();
    }

    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }

    const now = audio.ctx.currentTime;

    const oscillator = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();

    oscillator.connect(gain);
    gain.connect(audio.ctx.destination);

    const sounds = {
      jump: [[420, 640], 0.11, "square"],
      coin: [[780, 1120, 1450], 0.13, "square"],
      stomp: [[180, 110], 0.10, "square"],
      power: [[300, 500, 800, 1100], 0.20, "triangle"],
      hurt: [[150, 90], 0.22, "sawtooth"],
      complete: [[520, 660, 820, 1040], 0.36, "square"],
      gameover: [[300, 220, 150, 100], 0.45, "sawtooth"]
    };

    const [frequencies, duration, wave] =
      sounds[type] || [[440], 0.1, "square"];

    oscillator.type = wave;

    oscillator.frequency.setValueAtTime(
      frequencies[0],
      now
    );

    frequencies.slice(1).forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(
        frequency,
        now + ((index + 1) * duration) / frequencies.length
      );
    });

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      0.07,
      now + 0.01
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  } catch (_) {
    // Audio may be unavailable; game continues normally.
  }
}

// ------------------------------------------------------------
// Platform
// ------------------------------------------------------------

class Platform {
  constructor(x, y, w, h = 28, opts = {}) {
    Object.assign(this, { x, y, w, h }, opts);

    this.baseX = x;
    this.baseY = y;
    this.t = randFromSeed(x + y + w);
  }

  update(dt) {
    if (!this.moving) return;

    this.t += dt * this.speed;

    const offset =
      Math.sin(this.t) * this.range;

    if (this.axis === "y") {
      this.y = this.baseY + offset;
    } else {
      this.x = this.baseX + offset;
    }
  }

  draw() {
    ctx.fillStyle =
      this.grass === false
        ? "#7a4b2a"
        : "#65b83f";

    ctx.fillRect(
      Math.round(this.x),
      Math.round(this.y),
      this.w,
      this.h
    );

    if (this.grass !== false) {
      ctx.fillStyle = "#4d8f2c";

      ctx.fillRect(
        Math.round(this.x),
        Math.round(this.y + 7),
        this.w,
        this.h - 7
      );

      ctx.fillStyle = "#d6a04c";

      ctx.fillRect(
        Math.round(this.x),
        Math.round(this.y + this.h - 4),
        this.w,
        4
      );
    } else {
      ctx.fillStyle = "#5b371f";

      for (
        let xx = this.x + 8;
        xx < this.x + this.w - 4;
        xx += 20
      ) {
        ctx.fillRect(
          Math.round(xx),
          Math.round(this.y + 8),
          8,
          6
        );
      }
    }
  }
}

// ------------------------------------------------------------
// Coin
// ------------------------------------------------------------

class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 26;
    this.collected = false;
    this.phase = randFromSeed(x * 3 + y);
  }

  update(dt) {
    this.phase += dt * 5;
  }

  draw() {
    if (this.collected) return;

    const squish =
      0.72 + Math.abs(Math.sin(this.phase)) * 0.28;

    ctx.fillStyle = "#f6cf35";

    ctx.fillRect(
      Math.round(this.x + (1 - squish) * 9),
      Math.round(this.y),
      Math.round(this.w * squish),
      this.h
    );

    ctx.fillStyle = "#fff09a";

    ctx.fillRect(
      Math.round(this.x + 6 + (1 - squish) * 5),
      Math.round(this.y + 4),
      3,
      8
    );

    ctx.fillStyle = "#b37d12";

    ctx.fillRect(
      Math.round(this.x + 4 + (1 - squish) * 5),
      Math.round(this.y + 19),
      8,
      3
    );
  }
}

// ------------------------------------------------------------
// PowerUp
// ------------------------------------------------------------

class PowerUp {
  constructor(x, y, type = "mushroom") {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 28;

    this.vx = 70;
    this.vy = 0;

    this.type = type;
    this.alive = true;
  }

  update(dt, level) {
    if (!this.alive) return;

    this.vy = Math.min(
      this.vy + PHYSICS.gravity * dt,
      PHYSICS.maxFall
    );

    const oldY = this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    for (const platform of level.platforms) {
      if (
        this.vy >= 0 &&
        this.x + this.w > platform.x &&
        this.x < platform.x + platform.w &&
        oldY + this.h <= platform.y &&
        this.y + this.h >= platform.y
      ) {
        this.y = platform.y - this.h;
        this.vy = 0;
      }
    }

    if (
      this.x < 0 ||
      this.x > level.width - this.w
    ) {
      this.vx *= -1;
    }
  }

  draw() {
    if (!this.alive) return;

    if (this.type === "mushroom") {
      ctx.fillStyle = "#e44d36";

      ctx.fillRect(
        this.x + 2,
        this.y + 5,
        24,
        15
      );

      ctx.fillStyle = "#fff0d3";

      ctx.fillRect(
        this.x + 7,
        this.y + 2,
        7,
        8
      );

      ctx.fillRect(
        this.x + 18,
        this.y + 7,
        5,
        6
      );

      ctx.fillStyle = "#f4d8aa";

      ctx.fillRect(
        this.x + 5,
        this.y + 19,
        18,
        8
      );
    } else {
      ctx.fillStyle = "#56e0c3";

      ctx.fillRect(
        this.x + 4,
        this.y + 4,
        20,
        20
      );

      ctx.fillStyle = "#e6ffff";

      ctx.fillRect(
        this.x + 8,
        this.y + 7,
        5,
        5
      );
    }
  }
}

// ------------------------------------------------------------
// Enemy
// ------------------------------------------------------------

class Enemy {
  constructor(x, y, type = "walker") {
    this.x = x;
    this.y = y;

    this.w = 30;
    this.h = type === "flyer" ? 22 : 28;

    this.type = type;

    this.vx = type === "flyer" ? 70 : 65;
    this.vy = 0;

    this.alive = true;
    this.onGround = false;

    this.baseY = y;
    this.t = randFromSeed(x + y);
  }

  update(dt, level) {
    if (!this.alive) return;

    this.t += dt;

    // Flying enemy
    if (this.type === "flyer") {
      this.x += this.vx * dt;

      this.y =
        this.baseY +
        Math.sin(this.t * 3) * 32;

      if (
        this.x < 0 ||
        this.x + this.w > level.width
      ) {
        this.vx *= -1;
      }

      return;
    }

    // Walking enemy
    this.vy = Math.min(
      this.vy + PHYSICS.gravity * dt,
      PHYSICS.maxFall
    );

    const oldY = this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.onGround = false;

    for (const platform of level.platforms) {
      if (
        this.vy >= 0 &&
        this.x + this.w > platform.x &&
        this.x < platform.x + platform.w &&
        oldY + this.h <= platform.y &&
        this.y + this.h >= platform.y
      ) {
        this.y = platform.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }

    if (this.onGround) {
      const aheadX =
        this.vx > 0
          ? this.x + this.w + 4
          : this.x - 4;

      const footY = this.y + this.h + 3;

      let groundAhead = false;

      for (const platform of level.platforms) {
        if (
          aheadX >= platform.x &&
          aheadX <= platform.x + platform.w &&
          footY >= platform.y - 6 &&
          footY <= platform.y + 10
        ) {
          groundAhead = true;
          break;
        }
      }

      if (!groundAhead) {
        this.vx *= -1;
      }
    }

    if (
      this.x < -50 ||
      this.x > level.width + 50
    ) {
      this.vx *= -1;
    }
  }

  draw() {
    if (!this.alive) return;

    // Flying enemy
    if (this.type === "flyer") {
      ctx.fillStyle = "#7542a5";

      ctx.fillRect(
        this.x + 4,
        this.y + 7,
        22,
        14
      );

      ctx.fillStyle = "#d6bcff";

      ctx.fillRect(
        this.x,
        this.y + 1,
        10,
        8
      );

      ctx.fillRect(
        this.x + 20,
        this.y + 1,
        10,
        8
      );

      ctx.fillStyle = "#f7eee0";

      ctx.fillRect(
        this.x + 8,
        this.y + 6,
        4,
        4
      );

      ctx.fillRect(
        this.x + 18,
        this.y + 6,
        4,
        4
      );

      return;
    }

    // Walking enemy
    ctx.fillStyle = "#6b3f2a";

    ctx.fillRect(
      this.x + 3,
      this.y + 7,
      24,
      17
    );

    ctx.fillStyle = "#e2ae73";

    ctx.fillRect(
      this.x + 5,
      this.y + 12,
      7,
      7
    );

    ctx.fillRect(
      this.x + 18,
      this.y + 12,
      7,
      7
    );

    ctx.fillStyle = "#241813";

    ctx.fillRect(
      this.x + 9,
      this.y + 24,
      5,
      4
    );

    ctx.fillRect(
      this.x + 18,
      this.y + 24,
      5,
      4
    );
  }
}

// ------------------------------------------------------------
// Player
// ------------------------------------------------------------

class Player {
  constructor(x, y) {
    this.w = 28;
    this.h = 38;

    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.onGround = false;

    this.coyote = 0;
    this.jumpBuffer = 0;

    this.facing = 1;

    this.anim = 0;

    this.invuln = 0;

    this.powered = false;

    this.dead = false;
  }

  update(dt, level) {
    if (this.dead) return;

    const left =
      keys.has("ArrowLeft") ||
      keys.has("a") ||
      touch.left;

    const right =
      keys.has("ArrowRight") ||
      keys.has("d") ||
      touch.right;

    const jumpPressed =
      keys.has("Space") ||
      keys.has("ArrowUp") ||
      keys.has("w") ||
      touch.jump;

    // Jump buffering
    if (jumpPressed) {
      this.jumpBuffer = PHYSICS.jumpBuffer;
    } else {
      this.jumpBuffer = Math.max(
        0,
        this.jumpBuffer - dt
      );
    }

    // Acceleration
    if (left) {
      this.vx -= PHYSICS.accel * dt;
      this.facing = -1;
    }

    if (right) {
      this.vx += PHYSICS.accel * dt;
      this.facing = 1;
    }

    // Friction
    if (!left && !right) {
      const friction =
        PHYSICS.friction * dt;

      this.vx =
        Math.abs(this.vx) <= friction
          ? 0
          : this.vx -
            Math.sign(this.vx) *
              friction;
    }

    this.vx = clamp(
      this.vx,
      -PHYSICS.maxSpeed,
      PHYSICS.maxSpeed
    );

    // Coyote time
    if (this.onGround) {
      this.coyote = PHYSICS.coyote;
    } else {
      this.coyote = Math.max(
        0,
        this.coyote - dt
      );
    }

    // Jump
    if (
      this.jumpBuffer > 0 &&
      (this.onGround || this.coyote > 0)
    ) {
      this.vy = PHYSICS.jump;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;

      beep("jump");
    }

    // Variable jump height
    if (
      !jumpPressed &&
      this.vy < -230
    ) {
      this.vy += 1000 * dt;
    }

    // Gravity
    this.vy = Math.min(
      this.vy +
        PHYSICS.gravity * dt,
      PHYSICS.maxFall
    );

    this.x += this.vx * dt;

    this.resolveHorizontal(level);

    const oldY = this.y;

    this.y += this.vy * dt;

    this.onGround = false;

    this.resolveVertical(
      level,
      oldY
    );

    if (this.invuln > 0) {
      this.invuln -= dt;
    }

    this.anim +=
      dt *
      (Math.abs(this.vx) > 15 ? 12 : 4);

    this.x = clamp(
      this.x,
      0,
      level.width - this.w
    );

    // Falling below world
    if (this.y > H + 160) {
      this.dead = true;
    }
  }

  resolveHorizontal(level) {
    for (const platform of level.platforms) {
      if (!rectsOverlap(this, platform)) {
        continue;
      }

      if (this.vx > 0) {
        this.x =
          platform.x - this.w;
      } else if (this.vx < 0) {
        this.x =
          platform.x +
          platform.w;
      }

      this.vx = 0;
    }
  }

  resolveVertical(level, oldY) {
    for (const platform of level.platforms) {
      if (!rectsOverlap(this, platform)) {
        continue;
      }

      // Landing
      if (
        this.vy >= 0 &&
        oldY + this.h <=
          platform.y + 12
      ) {
        this.y =
          platform.y - this.h;

        this.vy = 0;
        this.onGround = true;
      }

      // Hitting underside
      else if (
        this.vy < 0 &&
        oldY >=
          platform.y +
            platform.h -
            10
      ) {
        this.y =
          platform.y +
          platform.h;

        this.vy = 0;
      }
    }
  }

  draw() {
    if (this.dead) return;

    // Blink while invulnerable
    if (
      this.invuln > 0 &&
      Math.floor(
        this.invuln * 18
      ) %
        2 ===
        0
    ) {
      return;
    }

    const x = Math.round(this.x);
    const y = Math.round(this.y);

    const bob =
      this.onGround &&
      Math.abs(this.vx) > 20
        ? (Math.floor(this.anim) % 2) * 2
        : 0;

    ctx.save();

    ctx.translate(
      x + this.w / 2,
      y + bob
    );

    ctx.scale(
      this.facing,
      1
    );

    // Hat
    ctx.fillStyle =
      this.powered
        ? "#4e8ed7"
        : "#e3523e";

    ctx.fillRect(
      -12,
      -2,
      24,
      9
    );

    // Face
    ctx.fillStyle = "#f0b07a";

    ctx.fillRect(
      -9,
      6,
      18,
      15
    );

    // Hair
    ctx.fillStyle = "#5b3022";

    ctx.fillRect(
      -9,
      5,
      5,
      6
    );

    ctx.fillRect(
      -1,
      10,
      10,
      4
    );

    // Body
    ctx.fillStyle =
      this.powered
        ? "#56a5e7"
        : "#3d67b8";

    ctx.fillRect(
      -10,
      21,
      20,
      11
    );

    // Legs
    ctx.fillStyle =
      this.powered
        ? "#e6d7a1"
        : "#63b365";

    ctx.fillRect(
      -11,
      31,
      8,
      7
    );

    ctx.fillRect(
      3,
      31,
      8,
      7
    );

    // Eye
    ctx.fillStyle =
      "#251813";

    ctx.fillRect(
      0,
      17,
      4,
      4
    );

    ctx.restore();
  }
}

// ------------------------------------------------------------
// Level
// ------------------------------------------------------------

class Level {
  constructor(index) {
    this.index = index;

    this.width =
      index === 1
        ? 4300
        : index === 2
        ? 5000
        : 5800;

    this.height = H;

    this.platforms = [];
    this.coins = [];
    this.enemies = [];
    this.powerUps = [];
    this.obstacles = [];

    this.goal = {
      x: this.width - 150,
      y: 250,
      w: 28,
      h: 180
    };

    this.start = {
      x: 90,
      y: 390
    };

    this.build();
  }

  addPlatform(
    x,
    y,
    w,
    h = 28,
    opts = {}
  ) {
    this.platforms.push(
      new Platform(
        x,
        y,
        w,
        h,
        opts
      )
    );
  }

  addCoins(
    x,
    y,
    n,
    dx = 32
  ) {
    for (
      let i = 0;
      i < n;
      i++
    ) {
      this.coins.push(
        new Coin(
          x + i * dx,
          y
        )
      );
    }
  }

  build() {
    // Ground
    this.addPlatform(
      0,
      460,
      this.width,
      80
    );

    if (this.index === 1) {
      this.buildOne();
    } else if (this.index === 2) {
      this.buildTwo();
    } else {
      this.buildThree();
    }
  }

  // ----------------------------------------------------------
  // Level 1
  // ----------------------------------------------------------

  buildOne() {
    const platforms = [
      [300, 390, 200],
      [620, 340, 180],
      [940, 410, 190],
      [1260, 350, 220],
      [1600, 300, 190],
      [1940, 395, 220],
      [2300, 340, 180],
      [2600, 280, 210],
      [2940, 370, 220],
      [3300, 310, 230],
      [3660, 380, 180]
    ];

    platforms.forEach(
      ([x, y, w]) =>
        this.addPlatform(x, y, w)
    );

    this.addCoins(
      340,
      350,
      4
    );

    this.addCoins(
      650,
      300,
      4
    );

    this.addCoins(
      970,
      370,
      4
    );

    this.addCoins(
      1300,
      310,
      4
    );

    this.addCoins(
      1640,
      260,
      4
    );

    this.addCoins(
      1990,
      355,
      5
    );

    this.addCoins(
      2340,
      300,
      4
    );

    this.addCoins(
      2650,
      240,
      4
    );

    this.addCoins(
      2990,
      330,
      4
    );

    this.addCoins(
      3350,
      270,
      4
    );

    const enemies = [
      [720, 312, "walker"],
      [1100, 382, "walker"],
      [1750, 272, "walker"],
      [2050, 362, "walker"],
      [3000, 342, "walker"],
      [3400, 282, "walker"]
    ];

    enemies.forEach(
      e =>
        this.enemies.push(
          new Enemy(...e)
        )
    );

    this.powerUps.push(
      new PowerUp(
        1350,
        315
      )
    );

    this.obstacles.push(
      {
        x: 2420,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      },
      {
        x: 2850,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      },
      {
        x: 3550,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      }
    );
  }

  // ----------------------------------------------------------
  // Level 2
  // ----------------------------------------------------------

  buildTwo() {
    const platforms = [
      [280, 395, 150],
      [540, 310, 150],
      [830, 235, 150],
      [1110, 350, 180],
      [1430, 285, 150],
      [1690, 210, 160],
      [1980, 360, 180],
      [2290, 290, 160],
      [2560, 215, 180],
      [2870, 330, 160],
      [3140, 260, 180],
      [3440, 190, 170],
      [3730, 330, 190],
      [4060, 255, 190],
      [4380, 360, 180]
    ];

    platforms.forEach(
      ([x, y, w]) =>
        this.addPlatform(x, y, w)
    );

    // Moving platforms
    this.addPlatform(
      720,
      400,
      100,
      22,
      {
        moving: true,
        axis: "y",
        range: 120,
        speed: 1.4
      }
    );

    this.addPlatform(
      1810,
      420,
      120,
      22,
      {
        moving: true,
        axis: "x",
        range: 100,
        speed: 1.25
      }
    );

    this.addPlatform(
      2710,
      390,
      110,
      22,
      {
        moving: true,
        axis: "y",
        range: 100,
        speed: 1.2
      }
    );

    this.addCoins(
      300,
      355,
      3
    );

    this.addCoins(
      560,
      270,
      3
    );

    this.addCoins(
      850,
      195,
      3
    );

    this.addCoins(
      1140,
      310,
      4
    );

    this.addCoins(
      1460,
      245,
      3
    );

    this.addCoins(
      1720,
      170,
      3
    );

    this.addCoins(
      2010,
      320,
      4
    );

    this.addCoins(
      2320,
      250,
      3
    );

    this.addCoins(
      2590,
      175,
      4
    );

    this.addCoins(
      2900,
      290,
      3
    );

    this.addCoins(
      3170,
      220,
      3
    );

    this.addCoins(
      3470,
      150,
      3
    );

    this.addCoins(
      3760,
      290,
      3
    );

    this.addCoins(
      4090,
      215,
      3
    );

    this.addCoins(
      4410,
      320,
      3
    );

    const enemies = [
      [590, 282, "walker"],
      [865, 206, "flyer"],
      [1170, 322, "walker"],
      [1480, 257, "walker"],
      [1715, 182, "flyer"],
      [2020, 332, "walker"],
      [2610, 187, "flyer"],
      [2910, 302, "walker"],
      [3180, 232, "walker"],
      [3490, 162, "flyer"],
      [3790, 302, "walker"],
      [4120, 227, "walker"]
    ];

    enemies.forEach(
      e =>
        this.enemies.push(
          new Enemy(...e)
        )
    );

    this.powerUps.push(
      new PowerUp(
        1160,
        310,
        "star"
      ),
      new PowerUp(
        3185,
        220
      )
    );

    this.obstacles.push(
      {
        x: 1280,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      },
      {
        x: 2130,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      },
      {
        x: 3240,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      },
      {
        x: 4200,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      }
    );
  }

  // ----------------------------------------------------------
  // Level 3
  // ----------------------------------------------------------

  buildThree() {
    const platforms = [
      [250, 380, 130],
      [490, 300, 120],
      [700, 205, 120],
      [910, 325, 130],
      [1140, 245, 120],
      [1370, 170, 120],
      [1600, 290, 130],
      [1840, 215, 120],
      [2060, 145, 125],
      [2290, 310, 120],
      [2520, 220, 130],
      [2760, 150, 130],
      [3000, 290, 120],
      [3230, 205, 120],
      [3460, 125, 120],
      [3700, 315, 130],
      [3950, 230, 120],
      [4200, 155, 120],
      [4450, 305, 130],
      [4730, 220, 120],
      [4990, 145, 130],
      [5270, 320, 150]
    ];

    platforms.forEach(
      ([x, y, w]) =>
        this.addPlatform(x, y, w)
    );

    // Moving platforms
    this.addPlatform(
      760,
      395,
      90,
      22,
      {
        moving: true,
        axis: "x",
        range: 120,
        speed: 1.8
      }
    );

    this.addPlatform(
      1720,
      390,
      90,
      22,
      {
        moving: true,
        axis: "y",
        range: 145,
        speed: 1.6
      }
    );

    this.addPlatform(
      2850,
      380,
      95,
      22,
      {
        moving: true,
        axis: "x",
        range: 130,
        speed: 1.7
      }
    );

    this.addPlatform(
      4580,
      380,
      95,
      22,
      {
        moving: true,
        axis: "y",
        range: 130,
        speed: 1.5
      }
    );

    const coinGroups = [
      [270, 340, 3],
      [510, 260, 3],
      [720, 165, 3],
      [930, 285, 3],
      [1160, 205, 3],
      [1390, 130, 3],
      [1620, 250, 3],
      [1860, 175, 3],
      [2080, 105, 3],
      [2310, 270, 3],
      [2540, 180, 3],
      [2780, 110, 3],
      [3020, 250, 3],
      [3250, 165, 3],
      [3480, 85, 3],
      [3720, 275, 3],
      [3970, 190, 3],
      [4220, 115, 3],
      [4470, 265, 3],
      [4750, 180, 3],
      [5010, 105, 3],
      [5290, 280, 3]
    ];

    coinGroups.forEach(
      ([x, y, count]) =>
        this.addCoins(
          x,
          y,
          count
        )
    );

    const enemies = [
      [520, 272, "walker"],
      [725, 168, "flyer"],
      [950, 297, "walker"],
      [1180, 217, "walker"],
      [1410, 142, "flyer"],
      [1630, 262, "walker"],
      [1875, 188, "walker"],
      [2100, 118, "flyer"],
      [2320, 282, "walker"],
      [2570, 192, "walker"],
      [2810, 122, "flyer"],
      [3030, 262, "walker"],
      [3260, 177, "walker"],
      [3510, 97, "flyer"],
      [3740, 287, "walker"],
      [3990, 202, "walker"],
      [4240, 127, "flyer"],
      [4490, 277, "walker"],
      [4770, 192, "walker"],
      [5030, 117, "flyer"],
      [5310, 292, "walker"]
    ];

    enemies.forEach(
      e =>
        this.enemies.push(
          new Enemy(...e)
        )
    );

    this.powerUps.push(
      new PowerUp(
        2550,
        180
      ),
      new PowerUp(
        4235,
        115,
        "star"
      ),
      new PowerUp(
        4980,
        110
      )
    );

    const spikes = [
      1220,
      1740,
      2200,
      2960,
      3580,
      4300,
      4860
    ];

    spikes.forEach(x => {
      this.obstacles.push({
        x,
        y: 430,
        w: 34,
        h: 30,
        type: "spike"
      });
    });

    this.obstacles.push({
      x: 5300,
      y: 290,
      w: 38,
      h: 170,
      type: "wall"
    });
  }

  // ----------------------------------------------------------
  // Level update
  // ----------------------------------------------------------

  update(dt) {
    this.platforms.forEach(
      p => p.update(dt)
    );

    this.coins.forEach(
      c => c.update(dt)
    );

    this.powerUps.forEach(
      p =>
        p.update(
          dt,
          this
        )
    );

    this.enemies.forEach(
      e =>
        e.update(
          dt,
          this
        )
    );
  }

  // ----------------------------------------------------------
  // Background
  // ----------------------------------------------------------

  drawBackground(cameraX) {
    // Sky
    ctx.fillStyle = "#58b8ff";

    ctx.fillRect(
      0,
      0,
      W,
      H
    );

    // Distant hills
    ctx.fillStyle =
      "#7ed176";

    for (
      let i = -2;
      i < 8;
      i++
    ) {
      const bx =
        i * 180 -
        (cameraX * 0.15) % 180;

      ctx.beginPath();

      ctx.moveTo(
        bx,
        460
      );

      ctx.lineTo(
        bx + 90,
        340
      );

      ctx.lineTo(
        bx + 180,
        460
      );

      ctx.closePath();

      ctx.fill();
    }

    // Clouds
    const clouds = [
      120,
      450,
      800,
      1150,
      1500,
      1900,
      2300,
      2700,
      3100,
      3500,
      3900,
      4300,
      4700,
      5100,
      5500
    ];

    for (const cx of clouds) {
      const x =
        cx -
        cameraX * 0.32;

      if (
        x < -140 ||
        x > W + 140
      ) {
        continue;
      }

      ctx.fillStyle =
        "#fffaf0";

      ctx.fillRect(
        x,
        82 + (cx % 80),
        72,
        22
      );

      ctx.fillRect(
        x + 16,
        66 + (cx % 80),
        40,
        38
      );

      ctx.fillRect(
        x + 45,
        74 + (cx % 80),
        42,
        30
      );
    }
  }

  // ----------------------------------------------------------
  // Decorative trees & pipes
  // ----------------------------------------------------------

  drawDecor(cameraX) {
    for (
      let x = 120;
      x < this.width;
      x += 260
    ) {
      const sx =
        x - cameraX;

      if (
        sx < -80 ||
        sx > W + 80
      ) {
        continue;
      }

      ctx.fillStyle =
        "#2e7d32";

      ctx.fillRect(
        sx + 12,
        397,
        14,
        63
      );

      ctx.fillStyle =
        "#4d9f36";

      ctx.fillRect(
        sx - 7,
        370,
        32,
        35
      );

      ctx.fillRect(
        sx + 18,
        384,
        28,
        22
      );
    }

    const pipeXs =
      this.index === 1
        ? [520, 2190, 3200]
        : this.index === 2
        ? [420, 1880, 3650]
        : [440, 1540, 3360, 4550];

    for (const x of pipeXs) {
      const sx =
        x - cameraX;

      if (
        sx < -90 ||
        sx > W + 90
      ) {
        continue;
      }

      ctx.fillStyle =
        "#2f993e";

      ctx.fillRect(
        sx,
        410,
        56,
        50
      );

      ctx.fillRect(
        sx - 6,
        402,
        68,
        12
      );

      ctx.fillStyle =
        "#8bdc6b";

      ctx.fillRect(
        sx + 7,
        410,
        9,
        42
      );
    }
  }
}

// ------------------------------------------------------------
// Game
// ------------------------------------------------------------

class Game {
  constructor() {
    this.state = "menu";

    this.levelIndex = 1;

    this.score = 0;
    this.coins = 0;
    this.lives = 3;

    this.timeLeft = 300;

    this.cameraX = 0;

    this.last = 0;

    this.level = null;
    this.player = null;

    this.respawnTimer = 0;

    this.totalElapsed = 0;

    this.bindUI();
  }

  // ----------------------------------------------------------
  // UI binding
  // ----------------------------------------------------------

  bindUI() {
    const show = id =>
      document
        .getElementById(id)
        .classList.add(
          "active"
        );

    const hideAll = () =>
      document
        .querySelectorAll(
          ".overlay"
        )
        .forEach(el =>
          el.classList.remove(
            "active"
          )
        );

    document.getElementById(
      "startBtn"
    ).onclick = () => {
      this.startNewGame();
    };

    document.getElementById(
      "howBtn"
    ).onclick = () => {
      hideAll();
      show("howScreen");
    };

    document.getElementById(
      "backBtn"
    ).onclick = () => {
      hideAll();
      show("menuScreen");
    };

    document.getElementById(
      "soundBtn"
    ).onclick = e => {
      audio.enabled =
        !audio.enabled;

      e.currentTarget.textContent =
        `SOUND: ${
          audio.enabled
            ? "ON"
            : "OFF"
        }`;

      if (audio.enabled) {
        beep("coin");
      }
    };

    document.getElementById(
      "resumeBtn"
    ).onclick = () =>
      this.togglePause(false);

    document.getElementById(
      "pauseRestartBtn"
    ).onclick = () =>
      this.restartCurrentLevel(
        true
      );

    document.getElementById(
      "nextBtn"
    ).onclick = () =>
      this.nextLevel();

    document.getElementById(
      "gameOverRestartBtn"
    ).onclick = () =>
      this.startNewGame();

    document.getElementById(
      "gameOverMenuBtn"
    ).onclick = () =>
      this.toMenu();

    document.getElementById(
      "victoryRestartBtn"
    ).onclick = () =>
      this.startNewGame();

    document.getElementById(
      "victoryMenuBtn"
    ).onclick = () =>
      this.toMenu();

    // Touch controls
    document
      .querySelectorAll(
        ".touch-btn"
      )
      .forEach(button => {
        const name =
          button.dataset.control;

        const press = event => {
          event.preventDefault();
          touch[name] = true;
        };

        const release = event => {
          event.preventDefault();
          touch[name] = false;
        };

        button.addEventListener(
          "pointerdown",
          press
        );

        button.addEventListener(
          "pointerup",
          release
        );

        button.addEventListener(
          "pointercancel",
          release
        );

        button.addEventListener(
          "pointerleave",
          release
        );
      });

    // Keyboard
    window.addEventListener(
      "keydown",
      event => {
        const key =
          event.code === "Space"
            ? "Space"
            : event.key;

        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "Space",
            "a",
            "d",
            "w",
            "p",
            "P",
            "r",
            "R"
          ].includes(key)
        ) {
          event.preventDefault();
        }

        if (
          key === "p" ||
          key === "P"
        ) {
          this.togglePause();
        }

        if (
          key === "r" ||
          key === "R"
        ) {
          this.restartCurrentLevel(
            false
          );
        }

        keys.add(key);

        if (
          audio.ctx &&
          audio.ctx.state ===
            "suspended"
        ) {
          audio.ctx.resume();
        }
      }
    );

    window.addEventListener(
      "keyup",
      event => {
        const key =
          event.code === "Space"
            ? "Space"
            : event.key;

        keys.delete(key);
      }
    );

    window.addEventListener(
      "blur",
      () => {
        keys.clear();

        Object.keys(touch).forEach(
          key =>
            (touch[key] = false)
        );
      }
    );
  }

  // ----------------------------------------------------------
  // Start game
  // ----------------------------------------------------------

  startNewGame() {
    document
      .querySelectorAll(
        ".overlay"
      )
      .forEach(el =>
        el.classList.remove(
          "active"
        )
      );

    this.levelIndex = 1;

    this.score = 0;
    this.coins = 0;

    this.lives = 3;

    this.timeLeft = 300;

    this.totalElapsed = 0;

    this.loadLevel(1);

    this.state = "playing";

    beep("power");
  }

  // ----------------------------------------------------------
  // Load level
  // ----------------------------------------------------------

  loadLevel(index) {
    this.level =
      new Level(index);

    this.player =
      new Player(
        this.level.start.x,
        this.level.start.y - 38
      );

    this.cameraX = 0;

    this.timeLeft = 300;

    this.respawnTimer = 0;
  }

  // ----------------------------------------------------------
  // Next level
  // ----------------------------------------------------------

  nextLevel() {
    if (this.levelIndex >= 3) {
      this.victory();
      return;
    }

    this.levelIndex++;

    this.loadLevel(
      this.levelIndex
    );

    this.state = "playing";

    document
      .querySelectorAll(
        ".overlay"
      )
      .forEach(el =>
        el.classList.remove(
          "active"
        )
      );

    beep("complete");
  }

  // ----------------------------------------------------------
  // Restart
  // ----------------------------------------------------------

  restartCurrentLevel(
    resetScore = false
  ) {
    if (
      this.state === "menu"
    ) {
      return;
    }

    if (resetScore) {
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
    }

    this.loadLevel(
      this.levelIndex
    );

    this.state = "playing";

    document
      .querySelectorAll(
        ".overlay"
      )
      .forEach(el =>
        el.classList.remove(
          "active"
        )
      );
  }

  // ----------------------------------------------------------
  // Main menu
  // ----------------------------------------------------------

  toMenu() {
    this.state = "menu";

    document
      .querySelectorAll(
        ".overlay"
      )
      .forEach(el =>
        el.classList.remove(
          "active"
        )
      );

    document
      .getElementById(
        "menuScreen"
      )
      .classList.add(
        "active"
      );
  }

  // ----------------------------------------------------------
  // Pause
  // ----------------------------------------------------------

  togglePause(force) {
    if (!this.level) {
      return;
    }

    if (
      this.state ===
        "playing" &&
      force !== false
    ) {
      this.state = "paused";

      document
        .getElementById(
          "pauseScreen"
        )
        .classList.add(
          "active"
        );
    } else if (
      this.state ===
        "paused" &&
      force !== true
    ) {
      this.state = "playing";

      document
        .getElementById(
          "pauseScreen"
        )
        .classList.remove(
          "active"
        );
    }
  }

  // ----------------------------------------------------------
  // Player damage
  // ----------------------------------------------------------

  damagePlayer() {
    if (
      this.player.invuln > 0 ||
      this.player.dead ||
      this.respawnTimer > 0
    ) {
      return;
    }

    this.lives--;

    beep("hurt");

    if (this.lives <= 0) {
      this.player.dead = true;

      this.state = "gameover";

      document.getElementById(
        "gameOverStats"
      ).textContent =
        `Score ${String(
          this.score
        ).padStart(
          6,
          "0"
        )} · Coins ${String(
          this.coins
        ).padStart(
          2,
          "0"
        )}`;

      document
        .getElementById(
          "gameOverScreen"
        )
        .classList.add(
          "active"
        );

      beep("gameover");
    } else {
      this.player.dead = true;

      this.respawnTimer = 1.0;
    }
  }

  // ----------------------------------------------------------
  // Respawn
  // ----------------------------------------------------------

  respawn() {
    this.player.reset(
      this.level.start.x,
      this.level.start.y - 38
    );

    this.player.invuln = 2;

    this.cameraX = 0;
  }

  // ----------------------------------------------------------
  // Game update
  // ----------------------------------------------------------

  update(dt) {
    if (
      this.state !==
      "playing"
    ) {
      return;
    }

    this.totalElapsed += dt;

    this.timeLeft -= dt;

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;

      this.damagePlayer();

      if (
        this.state ===
        "gameover"
      ) {
        return;
      }
    }

    // Respawn countdown
    if (
      this.respawnTimer > 0
    ) {
      this.respawnTimer -= dt;

      if (
        this.respawnTimer <=
        0
      ) {
        this.respawn();
      }

      return;
    }

    this.level.update(dt);

    this.player.update(
      dt,
      this.level
    );

    this.handleCoins();
    this.handlePowerUps();
    this.handleEnemies();
    this.handleObstacles();
    this.handleGoal();

    if (this.player.dead) {
      this.damagePlayer();
    }

    // Camera follows player
    const target =
      clamp(
        this.player.x -
          W * 0.42,
        0,
        this.level.width -
          W
      );

    this.cameraX = lerp(
      this.cameraX,
      target,
      1 -
        Math.pow(
          0.0005,
          dt
        )
    );
  }

  // ----------------------------------------------------------
  // Coins
  // ----------------------------------------------------------

  handleCoins() {
    for (const coin of this.level.coins) {
      if (
        !coin.collected &&
        rectsOverlap(
          this.player,
          {
            x: coin.x,
            y: coin.y,
            w: coin.w,
            h: coin.h
          }
        )
      ) {
        coin.collected = true;

        this.coins++;
        this.score += 100;

        beep("coin");
      }
    }
  }

  // ----------------------------------------------------------
  // Power-ups
  // ----------------------------------------------------------

  handlePowerUps() {
    for (
      const powerUp of
        this.level.powerUps
    ) {
      if (
        powerUp.alive &&
        rectsOverlap(
          this.player,
          powerUp
        )
      ) {
        powerUp.alive = false;

        this.score += 500;

        this.player.powered =
          true;

        this.player.invuln =
          Math.max(
            this.player.invuln,
            1.5
          );

        beep("power");
      }
    }
  }

  // ----------------------------------------------------------
  // Enemies
  // ----------------------------------------------------------

  handleEnemies() {
    for (
      const enemy of
        this.level.enemies
    ) {
      if (
        !enemy.alive ||
        !rectsOverlap(
          this.player,
          enemy
        )
      ) {
        continue;
      }

      const playerBottom =
        this.player.y +
        this.player.h;

      const enemyTop =
        enemy.y;

      // Stomp enemy
      if (
        this.player.vy > 0 &&
        playerBottom -
          enemyTop <
          20
      ) {
        enemy.alive = false;

        this.player.vy =
          PHYSICS.jump *
          0.55;

        this.score += 250;

        beep("stomp");
      } else {
        this.damagePlayer();
      }
    }
  }

  // ----------------------------------------------------------
  // Obstacles
  // ----------------------------------------------------------

  handleObstacles() {
    for (
      const obstacle of
        this.level.obstacles
    ) {
      const hitbox = {
        x: obstacle.x,
        y: obstacle.y,
        w: obstacle.w,
        h: obstacle.h
      };

      if (
        obstacle.type ===
          "spike" &&
        rectsOverlap(
          this.player,
          hitbox
        )
      ) {
        this.damagePlayer();
      }

      if (
        obstacle.type ===
          "wall" &&
        rectsOverlap(
          this.player,
          hitbox
        )
      ) {
        if (
          this.player.x <
          obstacle.x
        ) {
          this.player.x =
            obstacle.x -
            this.player.w;
        } else {
          this.player.x =
            obstacle.x +
            obstacle.w;
        }

        this.player.vx = 0;
      }
    }
  }

  // ----------------------------------------------------------
  // Goal
  // ----------------------------------------------------------

  handleGoal() {
    const goal =
      this.level.goal;

    const goalHitbox = {
      x: goal.x - 14,
      y: goal.y,
      w: 48,
      h: goal.h
    };

    if (
      rectsOverlap(
        this.player,
        goalHitbox
      )
    ) {
      const timeBonus =
        Math.floor(
          this.timeLeft
        ) * 10;

      this.score +=
        timeBonus;

      this.state =
        "complete";

      document.getElementById(
        "completeTitle"
      ).textContent =
        this.levelIndex === 3
          ? "FINAL LEVEL COMPLETE!"
          : `LEVEL ${this.levelIndex} COMPLETE!`;

      document.getElementById(
        "completeStats"
      ).textContent =
        `Score ${String(
          this.score
        ).padStart(
          6,
          "0"
        )} · Coins ${String(
          this.coins
        ).padStart(
          2,
          "0"
        )} · Time Bonus ${timeBonus}`;

      document.getElementById(
        "nextBtn"
      ).textContent =
        this.levelIndex === 3
          ? "VICTORY"
          : "NEXT LEVEL";

      document
        .getElementById(
          "completeScreen"
        )
        .classList.add(
          "active"
        );

      beep("complete");
    }
  }

  // ----------------------------------------------------------
  // Victory
  // ----------------------------------------------------------

  victory() {
    this.state =
      "victory";

    document.getElementById(
      "victoryStats"
    ).textContent =
      `Final Score: ${String(
        this.score
      ).padStart(
        6,
        "0"
      )} · Coins: ${String(
        this.coins
      ).padStart(
        2,
        "0"
      )}`;

    document
      .getElementById(
        "victoryScreen"
      )
      .classList.add(
        "active"
      );

    beep("complete");
  }

  // ----------------------------------------------------------
  // HUD
  // ----------------------------------------------------------

  drawHUD() {
    const time =
      Math.max(
        0,
        Math.floor(
          this.timeLeft
        )
      );

    ctx.fillStyle =
      "rgba(20, 24, 28, .70)";

    ctx.fillRect(
      0,
      0,
      W,
      46
    );

    ctx.fillStyle =
      "#fff6d5";

    ctx.font =
      "900 22px Courier New";

    ctx.textBaseline =
      "middle";

    const line =
      `SCORE: ${String(
        this.score
      ).padStart(
        6,
        "0"
      )}   |   COINS: ${String(
        this.coins
      ).padStart(
        2,
        "0"
      )}   |   LIVES: ${
        this.lives
      }   |   TIME: ${String(
        time
      ).padStart(
        3,
        "0"
      )}`;

    ctx.fillText(
      line,
      24,
      23
    );

    ctx.font =
      "900 15px Courier New";

    ctx.fillText(
      `LEVEL ${this.levelIndex}`,
      W - 110,
      23
    );
  }

  // ----------------------------------------------------------
  // Goal drawing
  // ----------------------------------------------------------

  drawGoal(cameraX) {
    const goal =
      this.level.goal;

    const x =
      goal.x -
      cameraX;

    // Pole
    ctx.fillStyle =
      "#e8e0c9";

    ctx.fillRect(
      x,
      goal.y,
      6,
      goal.h
    );

    // Flag
    ctx.fillStyle =
      "#df4d3c";

    ctx.fillRect(
      x + 6,
      goal.y + 2,
      46,
      28
    );

    // Base
    ctx.fillStyle =
      "#2c873a";

    ctx.fillRect(
      x - 12,
      goal.y +
        goal.h -
        12,
      30,
      12
    );
  }

  // ----------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------

  draw() {
    const cameraX =
      this.cameraX;

    if (!this.level) {
      ctx.fillStyle =
        "#58b8ff";

      ctx.fillRect(
        0,
        0,
        W,
        H
      );

      return;
    }

    this.level.drawBackground(
      cameraX
    );

    this.level.drawDecor(
      cameraX
    );

    ctx.save();

    ctx.translate(
      -cameraX,
      0
    );

    // Platforms
    this.level.platforms.forEach(
      platform =>
        platform.draw()
    );

    // Coins
    this.level.coins.forEach(
      coin =>
        coin.draw()
    );

    // Power-ups
    this.level.powerUps.forEach(
      powerUp =>
        powerUp.draw()
    );

    // Enemies
    this.level.enemies.forEach(
      enemy =>
        enemy.draw()
    );

    // Obstacles
    for (
      const obstacle of
        this.level.obstacles
    ) {
      if (
        obstacle.type ===
        "spike"
      ) {
        ctx.fillStyle =
          "#ddd5c3";

        ctx.beginPath();

        ctx.moveTo(
          obstacle.x,
          obstacle.y +
            obstacle.h
        );

        ctx.lineTo(
          obstacle.x +
            obstacle.w / 2,
          obstacle.y
        );

        ctx.lineTo(
          obstacle.x +
            obstacle.w,
          obstacle.y +
            obstacle.h
        );

        ctx.closePath();

        ctx.fill();

        ctx.fillStyle =
          "#8a8478";

        ctx.fillRect(
          obstacle.x +
            obstacle.w / 2 -
            3,
          obstacle.y + 8,
          6,
          16
        );
      } else {
        ctx.fillStyle =
          "#7556a1";

        ctx.fillRect(
          obstacle.x,
          obstacle.y,
          obstacle.w,
          obstacle.h
        );
      }
    }

    // Goal
    this.drawGoal(
      cameraX
    );

    // Player
    this.player.draw();

    ctx.restore();

    // HUD always stays fixed
    this.drawHUD();
  }

  // ----------------------------------------------------------
  // Main loop
  // ----------------------------------------------------------

  loop(timestamp) {
    if (!this.last) {
      this.last = timestamp;
    }

    const dt =
      Math.min(
        0.033,
        (timestamp -
          this.last) /
          1000
      );

    this.last = timestamp;

    this.update(dt);

    this.draw();

    requestAnimationFrame(
      t => this.loop(t)
    );
  }
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

game = new Game();

requestAnimationFrame(
  t => game.loop(t)
);