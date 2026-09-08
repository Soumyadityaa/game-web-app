/**
 * Pixel Commando: Jungle Assault
 * Complete Vanilla JS 2D Retro Run-and-Gun Simulation
 */

// ==========================================
// 1. SOUND ENGINE (Synthesized via Web Audio)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freqStart, freqEnd, type, duration, vol = 0.2) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playNoise(duration, vol = 0.2) {
    if (this.muted || !this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {}
  }

  shootBlaster() { this.playTone(600, 150, 'square', 0.1, 0.15); }
  shootRapid() { this.playTone(850, 300, 'sawtooth', 0.07, 0.12); }
  shootSpread() {
    this.playTone(400, 120, 'triangle', 0.18, 0.2);
    this.playNoise(0.12, 0.15);
  }
  shootPulse() { this.playTone(200, 900, 'sine', 0.22, 0.25); }
  shootRocket() {
    this.playTone(180, 50, 'sawtooth', 0.35, 0.25);
    this.playNoise(0.2, 0.2);
  }
  throwGrenade() { this.playTone(300, 600, 'sine', 0.15, 0.15); }
  explosion() {
    this.playNoise(0.45, 0.4);
    this.playTone(120, 30, 'sawtooth', 0.45, 0.3);
  }
  enemyHit() { this.playTone(240, 80, 'square', 0.06, 0.15); }
  enemyKill() { this.playTone(180, 40, 'triangle', 0.18, 0.2); }
  playerHurt() { this.playTone(150, 50, 'sawtooth', 0.25, 0.3); }
  jump() { this.playTone(160, 380, 'square', 0.12, 0.12); }
  pickup() {
    this.playTone(440, 880, 'sine', 0.15, 0.2);
    setTimeout(() => this.playTone(880, 1320, 'sine', 0.15, 0.2), 60);
  }
  checkpoint() {
    [300, 450, 600, 750].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, f + 50, 'square', 0.1, 0.2), idx * 80);
    });
  }
  bossAlert() {
    [150, 130, 110].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, f - 20, 'sawtooth', 0.25, 0.3), idx * 180);
    });
  }
}

const audio = new SoundEngine();

// ==========================================
// 2. WEAPONS CONFIGURATION
// ==========================================
const WEAPONS = {
  BLASTER: {
    name: 'BLASTER',
    damage: 15,
    speed: 10,
    cooldown: 0.18,
    ammoMax: Infinity,
    color: '#39ff14',
    size: 4,
    spreadCount: 1,
    explosive: false,
    sound: () => audio.shootBlaster()
  },
  RAPID: {
    name: 'RAPID BLASTER',
    damage: 8,
    speed: 13,
    cooldown: 0.08,
    ammoMax: 120,
    color: '#00ffff',
    size: 3,
    spreadCount: 1,
    explosive: false,
    sound: () => audio.shootRapid()
  },
  SPREAD: {
    name: 'SPREAD CANNON',
    damage: 12,
    speed: 9,
    cooldown: 0.28,
    ammoMax: 45,
    color: '#ffaa00',
    size: 4,
    spreadCount: 3,
    explosive: false,
    sound: () => audio.shootSpread()
  },
  PULSE: {
    name: 'PULSE RIFLE',
    damage: 28,
    speed: 12,
    cooldown: 0.32,
    ammoMax: 30,
    color: '#ff00ff',
    size: 6,
    spreadCount: 1,
    explosive: false,
    sound: () => audio.shootPulse()
  },
  ROCKET: {
    name: 'ROCKET LAUNCHER',
    damage: 75,
    speed: 7,
    cooldown: 0.55,
    ammoMax: 15,
    color: '#ff3333',
    size: 8,
    spreadCount: 1,
    explosive: true,
    blastRadius: 55,
    sound: () => audio.shootRocket()
  }
};

// ==========================================
// 3. PARTICLES & VISUAL FX
// ==========================================
class Particle {
  constructor(x, y, vx, vy, color, size, life, shape = 'rect') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.shape = shape;
  }

  update(dt) {
    this.x += this.vx * 60 * dt;
    this.y += this.vy * 60 * dt;
    this.life -= dt;
  }

  draw(ctx, camX, camY) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(px, py, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(px, py, this.size, this.size);
    }
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, count, color, speed = 2, shape = 'rect', size = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.8 + 0.2) * speed;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        Math.random() * size + 2,
        Math.random() * 0.4 + 0.2,
        shape
      ));
    }
  }

  spawnExplosion(x, y, radius = 30) {
    audio.explosion();
    for (let i = 0; i < 35; i++) {
      const color = ['#ff2200', '#ff8800', '#ffff00', '#555555', '#ffffff'][Math.floor(Math.random() * 5)];
      const spd = Math.random() * 4 + 1;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        Math.random() * 6 + 2,
        Math.random() * 0.5 + 0.3
      ));
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, camX, camY) {
    this.particles.forEach(p => p.draw(ctx, camX, camY));
  }
}

// ==========================================
// 4. PROJECTILES & GRENADES
// ==========================================
class Bullet {
  constructor(x, y, vx, vy, weapon, isPlayer = true) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.weapon = weapon;
    this.isPlayer = isPlayer;
    this.damage = weapon.damage;
    this.size = weapon.size || 4;
    this.color = weapon.color || '#fff';
    this.explosive = weapon.explosive || false;
    this.blastRadius = weapon.blastRadius || 40;
    this.life = 2.5;
  }

  update(dt) {
    this.x += this.vx * 60 * dt;
    this.y += this.vy * 60 * dt;
    this.life -= dt;
  }

  draw(ctx, camX, camY) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(Math.round(this.x - camX - this.size / 2), Math.round(this.y - camY - this.size / 2), this.size, this.size);
    ctx.restore();
  }
}

class Grenade {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 5;
    this.timer = 1.3;
    this.damage = 120;
    this.blastRadius = 65;
  }

  update(dt, level) {
    this.vy += 22 * dt; // Gravity
    this.x += this.vx * 60 * dt;
    this.y += this.vy * 60 * dt;

    // Platform collision
    level.platforms.forEach(p => {
      if (this.x > p.x && this.x < p.x + p.w && this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {
        if (this.vy > 0) {
          this.y = p.y - this.radius;
          this.vy = -this.vy * 0.45; // Bounce
          this.vx *= 0.7;
        }
      }
    });

    this.timer -= dt;
  }

  draw(ctx, camX, camY) {
    ctx.save();
    ctx.fillStyle = '#225522';
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.round(this.x - camX), Math.round(this.y - camY), this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ==========================================
// 5. PLAYER CHARACTER
// ==========================================
class Player {
  constructor(x, y, charType = 0) {
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 32;
    this.vx = 0;
    this.vy = 0;
    this.charType = charType;

    // Stats based on character
    this.maxHp = charType === 2 ? 140 : (charType === 1 ? 80 : 100);
    this.hp = this.maxHp;
    this.speed = charType === 1 ? 4.4 : (charType === 2 ? 3.0 : 3.6);
    this.jumpForce = charType === 1 ? -9.5 : -8.5;

    this.isGrounded = false;
    this.isCrouching = false;
    this.isClimbing = false;
    this.isSwimming = false;
    this.facing = 1; // 1 = Right, -1 = Left
    this.aimY = 0;   // -1 = Up, 1 = Down, 0 = Forward

    this.currentWeapon = WEAPONS.BLASTER;
    this.ammo = {
      BLASTER: Infinity,
      RAPID: 0,
      SPREAD: 0,
      PULSE: 0,
      ROCKET: 0
    };
    this.grenades = 3;
    this.shootTimer = 0;

    this.invulnTimer = 0;
    this.isDead = false;
  }

  update(dt, input, game) {
    if (this.isDead) return;

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.shootTimer > 0) this.shootTimer -= dt;

    // Movement & Aiming
    const moveLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
    const moveRight = input.isDown('ArrowRight') || input.isDown('KeyD');
    const up = input.isDown('ArrowUp') || input.isDown('KeyW');
    const down = input.isDown('ArrowDown') || input.isDown('KeyS');
    const jump = input.isPressed('Space');
    const shoot = input.isDown('KeyJ') || input.isDown('KeyZ');
    const grenade = input.isPressed('KeyK') || input.isPressed('KeyX');

    // Aim calculations
    this.aimY = up ? -1 : (down ? 1 : 0);
    if (moveLeft) this.facing = -1;
    if (moveRight) this.facing = 1;

    // Swimming check
    this.isSwimming = game.level.isInWater(this.x, this.y, this.w, this.h);

    // Ladder climbing
    const ladder = game.level.getLadderAt(this.x + this.w / 2, this.y + this.h / 2);
    if (ladder && (up || (down && !this.isGrounded))) {
      this.isClimbing = true;
      this.x = ladder.x + ladder.w / 2 - this.w / 2;
    }
    if (!ladder) this.isClimbing = false;

    if (this.isClimbing) {
      this.vy = up ? -3 : (down ? 3 : 0);
      this.vx = moveLeft ? -2 : (moveRight ? 2 : 0);
      if (jump) {
        this.isClimbing = false;
        this.vy = this.jumpForce * 0.8;
      }
    } else if (this.isSwimming) {
      this.vy = Math.min(this.vy + 8 * dt, 3); // Light buoyancy
      if (jump || up) {
        this.vy = -4.5;
        audio.jump();
      }
      this.vx = moveLeft ? -this.speed * 0.7 : (moveRight ? this.speed * 0.7 : 0);
    } else {
      // Normal Platformer Physics
      this.isCrouching = down && this.isGrounded;
      const curSpeed = this.isCrouching ? 0 : this.speed;

      if (moveLeft) this.vx = -curSpeed;
      else if (moveRight) this.vx = curSpeed;
      else this.vx = 0;

      // Gravity
      this.vy += 24 * dt;
      if (this.vy > 14) this.vy = 14;

      if (jump && this.isGrounded && !this.isCrouching) {
        this.vy = this.jumpForce;
        this.isGrounded = false;
        audio.jump();
      }
    }

    // Horizontal Movement & Collisions
    this.x += this.vx * 60 * dt;
    game.level.resolveHorizontalCollisions(this);

    // Vertical Movement & Collisions
    this.y += this.vy * 60 * dt;
    this.isGrounded = false;
    game.level.resolveVerticalCollisions(this);

    // Shoot Action
    if (shoot && this.shootTimer <= 0) {
      this.fireWeapon(game);
    }

    // Grenade Throw
    if (grenade && this.grenades > 0) {
      this.throwGrenade(game);
    }

    // Hazard checks (Lava/Spikes/Pit)
    if (game.level.checkHazards(this) || this.y > game.level.height + 100) {
      this.takeDamage(999, game);
    }
  }

  fireWeapon(game) {
    const w = this.currentWeapon;
    if (w !== WEAPONS.BLASTER && this.ammo[w.name] <= 0) {
      this.currentWeapon = WEAPONS.BLASTER;
    }

    this.shootTimer = w.cooldown;
    if (w !== WEAPONS.BLASTER) {
      this.ammo[w.name]--;
    }

    w.sound();
    game.camera.addShake(w.explosive ? 5 : 2);

    // Calculate trajectory angle
    let angle = 0;
    if (this.aimY === -1) {
      angle = (this.vx !== 0) ? (this.facing === 1 ? -Math.PI / 4 : -3 * Math.PI / 4) : -Math.PI / 2;
    } else if (this.aimY === 1 && !this.isGrounded) {
      angle = (this.vx !== 0) ? (this.facing === 1 ? Math.PI / 4 : 3 * Math.PI / 4) : Math.PI / 2;
    } else {
      angle = this.facing === 1 ? 0 : Math.PI;
    }

    const spawnX = this.x + this.w / 2 + Math.cos(angle) * 16;
    const spawnY = this.y + (this.isCrouching ? 20 : 12) + Math.sin(angle) * 16;

    if (w.spreadCount > 1) {
      const spreadAngles = [-0.18, 0, 0.18];
      spreadAngles.forEach(offset => {
        const finalA = angle + offset;
        game.bullets.push(new Bullet(spawnX, spawnY, Math.cos(finalA) * w.speed, Math.sin(finalA) * w.speed, w, true));
      });
    } else {
      game.bullets.push(new Bullet(spawnX, spawnY, Math.cos(angle) * w.speed, Math.sin(angle) * w.speed, w, true));
    }
  }

  throwGrenade(game) {
    this.grenades--;
    audio.throwGrenade();
    const vx = this.facing * 5 + (this.vx * 0.4);
    const vy = this.aimY === -1 ? -9 : -5;
    game.grenades.push(new Grenade(this.x + this.w / 2, this.y + 10, vx, vy));
  }

  takeDamage(amount, game) {
    if (this.invulnTimer > 0 || this.isDead) return;
    this.hp -= amount;
    this.invulnTimer = 1.0;
    game.camera.addShake(7);
    audio.playerHurt();
    game.particles.spawn(this.x + this.w / 2, this.y + this.h / 2, 10, '#ff2222', 3);

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      game.handlePlayerDeath();
    }
  }

  draw(ctx, camX, camY) {
    if (this.invulnTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) return;

    ctx.save();
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    // Pixel Commando Rendering
    ctx.fillStyle = this.charType === 1 ? '#00ccaa' : (this.charType === 2 ? '#667788' : '#2b5a32'); // Suit
    ctx.fillRect(px + 3, py + 10, 14, this.isCrouching ? 14 : 22);

    // Head / Helmet
    ctx.fillStyle = '#d2a679'; // Face
    ctx.fillRect(px + 4, py + 2, 12, 10);
    ctx.fillStyle = '#ff2222'; // Bandana / Visor
    ctx.fillRect(px + 3, py + 4, 14, 4);

    // Weapon
    ctx.fillStyle = '#111';
    let gunX = this.facing === 1 ? px + 12 : px - 6;
    let gunY = py + (this.isCrouching ? 16 : 10);
    if (this.aimY === -1) gunY -= 6;
    ctx.fillRect(gunX, gunY, 14, 5);

    ctx.restore();
  }
}

// ==========================================
// 6. ENEMY AI & FACTORY
// ==========================================
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.isGrounded = false;
    this.shootTimer = Math.random() * 1.5 + 0.5;

    switch (type) {
      case 'scout':
        this.w = 18; this.h = 28; this.hp = 25; this.score = 100; this.speed = 1.6;
        break;
      case 'drone':
        this.w = 20; this.h = 16; this.hp = 18; this.score = 150; this.speed = 2.2;
        break;
      case 'armored':
        this.w = 24; this.h = 32; this.hp = 80; this.score = 250; this.speed = 0.9;
        break;
      case 'hunter':
        this.w = 18; this.h = 26; this.hp = 35; this.score = 200; this.speed = 3.2;
        break;
      case 'turret':
        this.w = 24; this.h = 24; this.hp = 60; this.score = 300; this.speed = 0;
        break;
    }
    this.maxHp = this.hp;
  }

  update(dt, player, level, bullets, particles) {
    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    this.facing = player.x > this.x ? 1 : -1;

    // AI Behaviors
    if (this.type === 'drone') {
      // Floating Sine Wave & Follow
      this.x += (player.x > this.x ? 1 : -1) * this.speed * 40 * dt;
      this.y += Math.sin(Date.now() / 250) * 1.5;
    } else if (this.type === 'turret') {
      // Stationary
    } else {
      // Ground AI
      this.vy += 24 * dt;
      if (distToPlayer < 400) {
        this.vx = this.facing * this.speed;
      } else {
        this.vx = 0;
      }

      this.x += this.vx * 60 * dt;
      level.resolveHorizontalCollisions(this);
      this.y += this.vy * 60 * dt;
      level.resolveVerticalCollisions(this);
    }

    // Shooting AI
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && distToPlayer < 380) {
      this.shootTimer = this.type === 'armored' ? 2.2 : (this.type === 'turret' ? 1.4 : 1.8);
      const angle = Math.atan2(player.y + 10 - this.y, player.x + 10 - this.x);
      const bulletSpeed = 5.5;
      bullets.push(new Bullet(
        this.x + this.w / 2,
        this.y + this.h / 2,
        Math.cos(angle) * bulletSpeed,
        Math.sin(angle) * bulletSpeed,
        { damage: 15, size: 4, color: '#ff3333' },
        false
      ));
      audio.shootBlaster();
    }
  }

  takeDamage(amount, particles) {
    this.hp -= amount;
    audio.enemyHit();
    particles.spawn(this.x + this.w / 2, this.y + this.h / 2, 5, '#ffaa00', 2);
    return this.hp <= 0;
  }

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    ctx.save();
    if (this.type === 'scout') {
      ctx.fillStyle = '#8b2500';
      ctx.fillRect(px, py + 8, this.w, this.h - 8);
      ctx.fillStyle = '#ffaa77';
      ctx.fillRect(px + 3, py, 12, 8);
    } else if (this.type === 'drone') {
      ctx.fillStyle = '#556677';
      ctx.fillRect(px, py + 4, this.w, 8);
      ctx.fillStyle = '#ff0000'; // Eye
      ctx.fillRect(px + (this.facing === 1 ? 12 : 4), py + 6, 4, 4);
    } else if (this.type === 'armored') {
      ctx.fillStyle = '#223344';
      ctx.fillRect(px, py, this.w, this.h);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(px + (this.facing === 1 ? 16 : 0), py + 6, 8, 12);
    } else if (this.type === 'hunter') {
      ctx.fillStyle = '#aa0033';
      ctx.fillRect(px, py + 4, this.w, this.h - 4);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(px + 4, py, 10, 6);
    } else if (this.type === 'turret') {
      ctx.fillStyle = '#333';
      ctx.fillRect(px + 4, py + 12, 16, 12);
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(px + 12, py + 12, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ==========================================
// 7. BOSS BATTLES (Iron Beetle, Sky Reaper, Titan Core)
// ==========================================
class Boss {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.phase = 1;
    this.timer = 0;

    if (type === 'iron_beetle') {
      this.name = 'IRON BEETLE';
      this.w = 90; this.h = 60; this.maxHp = 650;
    } else if (type === 'sky_reaper') {
      this.name = 'SKY REAPER';
      this.w = 110; this.h = 45; this.maxHp = 900;
    } else {
      this.name = 'TITAN CORE';
      this.w = 120; this.h = 120; this.maxHp = 1400;
    }
    this.hp = this.maxHp;
    this.score = 5000;
  }

  update(dt, player, bullets, particles, game) {
    this.timer += dt;

    if (this.type === 'iron_beetle') {
      // Charges horizontally & fires cannon volleys
      if (Math.sin(this.timer) > 0.6) {
        this.x += (player.x > this.x ? 1 : -1) * 2.8;
      }
      if (Math.floor(this.timer * 3) % 4 === 0 && Math.random() < 0.08) {
        bullets.push(new Bullet(this.x + 20, this.y + 15, -6, 0, { damage: 20, size: 6, color: '#ff5500' }, false));
        bullets.push(new Bullet(this.x + 70, this.y + 15, 6, 0, { damage: 20, size: 6, color: '#ff5500' }, false));
        audio.shootBlaster();
      }
    } else if (this.type === 'sky_reaper') {
      // Hovers overhead, carpet bombs
      this.x += Math.cos(this.timer * 1.5) * 4;
      this.y += Math.sin(this.timer * 3) * 1.2;

      if (Math.random() < 0.06) {
        bullets.push(new Bullet(this.x + 20 + Math.random() * 70, this.y + this.h, 0, 5, { damage: 25, size: 5, color: '#ff00ff' }, false));
        audio.shootBlaster();
      }
    } else if (this.type === 'titan_core') {
      // Giant mechanical core emitting rotating bullet rings
      if (Math.random() < 0.12) {
        const ringAngles = 8;
        for (let i = 0; i < ringAngles; i++) {
          const a = (this.timer * 2) + (i * (Math.PI * 2 / ringAngles));
          bullets.push(new Bullet(this.x + this.w / 2, this.y + this.h / 2, Math.cos(a) * 4.5, Math.sin(a) * 4.5, { damage: 20, size: 6, color: '#ff0033' }, false));
        }
        audio.shootPulse();
      }
    }
  }

  takeDamage(amount, particles) {
    this.hp -= amount;
    audio.enemyHit();
    particles.spawn(this.x + Math.random() * this.w, this.y + Math.random() * this.h, 4, '#ffcc00', 3);
    return this.hp <= 0;
  }

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    ctx.save();
    if (this.type === 'iron_beetle') {
      ctx.fillStyle = '#3a443a';
      ctx.fillRect(px, py + 15, this.w, this.h - 15);
      ctx.fillStyle = '#ff3300';
      ctx.fillRect(px + 10, py + 5, 20, 10);
      ctx.fillRect(px + 60, py + 5, 20, 10);
    } else if (this.type === 'sky_reaper') {
      ctx.fillStyle = '#222';
      ctx.fillRect(px + 20, py, this.w - 40, this.h);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(px, py + 15, this.w, 10);
    } else {
      ctx.fillStyle = '#111822';
      ctx.fillRect(px, py, this.w, this.h);
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 4;
      ctx.strokeRect(px + 8, py + 8, this.w - 16, this.h - 16);
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(px + this.w / 2, py + this.h / 2, 25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ==========================================
// 8. INTERACTIVE OBJECTS & LEVEL SYSTEM
// ==========================================
class Destructible {
  constructor(x, y, type = 'crate') {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 24;
    this.type = type; // 'crate', 'barrel'
    this.hp = type === 'barrel' ? 15 : 25;
  }

  takeDamage(amount, game) {
    this.hp -= amount;
    if (this.hp <= 0) {
      if (this.type === 'barrel') {
        game.particles.spawnExplosion(this.x + this.w / 2, this.y + this.h / 2, 45);
        game.dealAoEDamage(this.x + this.w / 2, this.y + this.h / 2, 70, 100);
      } else {
        game.particles.spawn(this.x + 12, this.y + 12, 12, '#aa7744', 3);
        audio.explosion();
        // Drop collectible
        const drops = ['HEALTH', 'AMMO', 'SPREAD', 'PULSE', 'ROCKET'];
        const chosen = drops[Math.floor(Math.random() * drops.length)];
        game.pickups.push(new Pickup(this.x + 4, this.y + 4, chosen));
      }
      return true;
    }
    return false;
  }

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    ctx.save();
    if (this.type === 'barrel') {
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(px, py, this.w, this.h);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(px + 4, py + 10, 16, 4);
    } else {
      ctx.fillStyle = '#885522';
      ctx.fillRect(px, py, this.w, this.h);
      ctx.strokeStyle = '#553311';
      ctx.strokeRect(px, py, this.w, this.h);
    }
    ctx.restore();
  }
}

class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 16;
    this.type = type;
  }

  apply(player) {
    audio.pickup();
    if (this.type === 'HEALTH') {
      player.hp = Math.min(player.maxHp, player.hp + 40);
    } else if (this.type === 'AMMO') {
      Object.keys(player.ammo).forEach(k => {
        if (k !== 'BLASTER') player.ammo[k] += 20;
      });
      player.grenades = Math.min(6, player.grenades + 2);
    } else if (WEAPONS[this.type]) {
      player.currentWeapon = WEAPONS[this.type];
      player.ammo[this.type] = (player.ammo[this.type] || 0) + WEAPONS[this.type].ammoMax;
    }
  }

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);
    ctx.save();
    ctx.fillStyle = '#00ffff';
    if (this.type === 'HEALTH') ctx.fillStyle = '#39ff14';
    if (this.type === 'ROCKET') ctx.fillStyle = '#ff2222';
    ctx.fillRect(px, py, this.w, this.h);
    ctx.restore();
  }
}

class Level {
  constructor(levelIdx) {
    this.levelIdx = levelIdx;
    this.width = 3600;
    this.height = 600;
    this.platforms = [];
    this.ladders = [];
    this.waters = [];
    this.hazards = [];
    this.checkpoints = [900, 1900, 2900];
    this.boss = null;
    this.buildLevel();
  }

  buildLevel() {
    // Ground base
    this.platforms.push({ x: 0, y: 400, w: this.width, h: 200, solid: true });

    if (this.levelIdx === 0) {
      // Level 1: Jungle Outpost
      this.platforms.push({ x: 250, y: 320, w: 180, h: 16 });
      this.platforms.push({ x: 550, y: 260, w: 220, h: 16 });
      this.waters.push({ x: 1200, y: 380, w: 350, h: 200 });
      this.platforms.push({ x: 1650, y: 300, w: 300, h: 16 });
      this.boss = new Boss('iron_beetle', 3200, 340);
    } else if (this.levelIdx === 1) {
      // Level 2: Enemy Factory
      this.platforms.push({ x: 300, y: 320, w: 200, h: 16 });
      this.hazards.push({ x: 600, y: 380, w: 120, h: 20 });
      this.platforms.push({ x: 800, y: 240, w: 250, h: 16 });
      this.ladders.push({ x: 1200, y: 180, w: 24, h: 220 });
      this.boss = new Boss('sky_reaper', 3200, 200);
    } else if (this.levelIdx === 2) {
      // Level 3: Mountain Base
      this.platforms.push({ x: 200, y: 300, w: 150, h: 16 });
      this.platforms.push({ x: 450, y: 220, w: 180, h: 16 });
      this.ladders.push({ x: 800, y: 140, w: 24, h: 260 });
      this.platforms.push({ x: 950, y: 160, w: 280, h: 16 });
      this.boss = new Boss('sky_reaper', 3200, 180);
    } else {
      // Level 4: Fortress Core
      this.hazards.push({ x: 500, y: 385, w: 200, h: 20 });
      this.platforms.push({ x: 800, y: 280, w: 300, h: 16 });
      this.hazards.push({ x: 1400, y: 385, w: 300, h: 20 });
      this.boss = new Boss('titan_core', 3150, 250);
    }
  }

  resolveHorizontalCollisions(entity) {
    this.platforms.forEach(p => {
      if (p.solid && entity.x < p.x + p.w && entity.x + entity.w > p.x && entity.y < p.y + p.h && entity.y + entity.h > p.y) {
        if (entity.vx > 0) entity.x = p.x - entity.w;
        else if (entity.vx < 0) entity.x = p.x + p.w;
      }
    });
  }

  resolveVerticalCollisions(entity) {
    this.platforms.forEach(p => {
      if (entity.x + entity.w > p.x && entity.x < p.x + p.w) {
        if (entity.y + entity.h >= p.y && entity.y + entity.h <= p.y + 18 && entity.vy >= 0) {
          entity.y = p.y - entity.h;
          entity.vy = 0;
          entity.isGrounded = true;
        }
      }
    });
  }

  isInWater(x, y, w, h) {
    return this.waters.some(wt => x + w > wt.x && x < wt.x + wt.w && y + h > wt.y && y < wt.y + wt.h);
  }

  getLadderAt(x, y) {
    return this.ladders.find(l => x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
  }

  checkHazards(entity) {
    return this.hazards.some(hz => entity.x + entity.w > hz.x && entity.x < hz.x + hz.w && entity.y + entity.h > hz.y && entity.y < hz.y + hz.h);
  }

  draw(ctx, camX, camY) {
    // Parallax background scenery
    ctx.save();
    ctx.fillStyle = this.levelIdx === 0 ? '#102518' : (this.levelIdx === 1 ? '#181b22' : (this.levelIdx === 2 ? '#1a2030' : '#220815'));
    ctx.fillRect(0, 0, 800, 450);

    // Distant parallax mountains/structures
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < 8; i++) {
      const px = (i * 280) - (camX * 0.25) % 280;
      ctx.beginPath();
      ctx.moveTo(px, 450);
      ctx.lineTo(px + 140, 180);
      ctx.lineTo(px + 280, 450);
      ctx.fill();
    }

    // Platforms
    this.platforms.forEach(p => {
      ctx.fillStyle = '#224422';
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.w, p.h);
      ctx.fillStyle = '#39ff14'; // Top Grass / Edge
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.w, 4);
    });

    // Ladders
    this.ladders.forEach(l => {
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(Math.round(l.x - camX), Math.round(l.y - camY), l.w, l.h);
    });

    // Water
    this.waters.forEach(w => {
      ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
      ctx.fillRect(Math.round(w.x - camX), Math.round(w.y - camY), w.w, w.h);
    });

    // Hazards (Spikes/Lava)
    this.hazards.forEach(h => {
      ctx.fillStyle = '#ff2200';
      ctx.fillRect(Math.round(h.x - camX), Math.round(h.y - camY), h.w, h.h);
    });

    ctx.restore();
  }
}

// ==========================================
// 9. CAMERA & VIEWPORT
// ==========================================
class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.shake = 0;
  }

  follow(target, levelWidth, levelHeight) {
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;

    // Bounds clamp
    this.x = Math.max(0, Math.min(this.x, levelWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, levelHeight - this.height));

    // Screen Shake decay
    if (this.shake > 0) {
      this.x += (Math.random() * 2 - 1) * this.shake;
      this.y += (Math.random() * 2 - 1) * this.shake;
      this.shake = Math.max(0, this.shake - 0.5);
    }
  }

  addShake(amt) {
    this.shake = amt;
  }
}

// ==========================================
// 10. INPUT CONTROLLER
// ==========================================
class InputController {
  constructor() {
    this.keys = {};
    this.pressed = {};

    window.addEventListener('keydown', e => {
      audio.init();
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // Mobile Virtual Touch Controller Bindings
    document.querySelectorAll('.dpad-btn, .act-btn').forEach(btn => {
      const code = btn.getAttribute('data-key');
      const start = (e) => {
        e.preventDefault();
        audio.init();
        if (!this.keys[code]) this.pressed[code] = true;
        this.keys[code] = true;
      };
      const end = (e) => {
        e.preventDefault();
        this.keys[code] = false;
      };
      btn.addEventListener('touchstart', start);
      btn.addEventListener('touchend', end);
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
    });
  }

  isDown(code) { return !!this.keys[code]; }
  isPressed(code) {
    const val = !!this.pressed[code];
    this.pressed[code] = false;
    return val;
  }
  clear() { this.pressed = {}; }
}

// ==========================================
// 11. MAIN ENGINE & GAME FLOW
// ==========================================
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.camera = new Camera(800, 450);
    this.input = new InputController();
    this.particles = new ParticleSystem();

    this.state = 'MENU'; // MENU, CHAR_SELECT, LEVEL_SELECT, PLAYING, PAUSED, GAME_OVER, CLEAR, VICTORY
    this.selectedChar = 0;
    this.currentLevelIdx = 0;
    this.difficulty = 'normal';

    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.kills = 0;

    this.checkpointX = 100;
    this.checkpointY = 320;

    this.bullets = [];
    this.grenades = [];
    this.enemies = [];
    this.destructibles = [];
    this.pickups = [];

    this.lastTime = 0;
    this.initUI();
  }

  initUI() {
    const showScreen = (id) => {
      document.querySelectorAll('.screen-layer').forEach(s => s.classList.add('hidden'));
      if (id) document.getElementById(id).classList.remove('hidden');
    };

    // Menu Screen Transitions
    document.getElementById('btn-start-game').onclick = () => this.startMission(0);
    document.getElementById('btn-char-select').onclick = () => showScreen('screen-char-select');
    document.getElementById('btn-level-select').onclick = () => showScreen('screen-level-select');
    document.getElementById('btn-how-to-play').onclick = () => showScreen('screen-how-to');

    // Back Buttons
    document.getElementById('btn-char-back').onclick = () => showScreen('screen-main-menu');
    document.getElementById('btn-level-back').onclick = () => showScreen('screen-main-menu');
    document.getElementById('btn-how-back').onclick = () => showScreen('screen-main-menu');

    // Character Select
    document.querySelectorAll('.char-card').forEach(card => {
      card.onclick = () => {
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedChar = parseInt(card.getAttribute('data-char'));
      };
    });
    document.getElementById('btn-char-confirm').onclick = () => showScreen('screen-main-menu');

    // Level Select
    document.querySelectorAll('.level-card').forEach(card => {
      card.onclick = () => {
        document.querySelectorAll('.level-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.currentLevelIdx = parseInt(card.getAttribute('data-lvl'));
      };
    });
    document.getElementById('select-difficulty').onchange = (e) => {
      this.difficulty = e.target.value;
    };
    document.getElementById('btn-level-launch').onclick = () => this.startMission(this.currentLevelIdx);

    // Pause / Resume
    document.getElementById('btn-pause-resume').onclick = () => this.togglePause();
    document.getElementById('btn-pause-restart').onclick = () => this.startMission(this.currentLevelIdx);
    document.getElementById('btn-pause-quit').onclick = () => {
      this.state = 'MENU';
      document.getElementById('hud').classList.add('hidden');
      showScreen('screen-main-menu');
    };

    // Game Over & Victory
    document.getElementById('btn-go-retry').onclick = () => this.startMission(this.currentLevelIdx);
    document.getElementById('btn-go-menu').onclick = () => {
      this.state = 'MENU';
      showScreen('screen-main-menu');
    };
    document.getElementById('btn-clear-next').onclick = () => {
      if (this.currentLevelIdx < 3) {
        this.startMission(this.currentLevelIdx + 1);
      } else {
        this.showVictoryScreen();
      }
    };
    document.getElementById('btn-vic-menu').onclick = () => {
      this.state = 'MENU';
      showScreen('screen-main-menu');
    };
  }

  startMission(levelIdx) {
    this.currentLevelIdx = levelIdx;
    this.level = new Level(levelIdx);
    this.checkpointX = 100;
    this.checkpointY = 320;
    this.player = new Player(this.checkpointX, this.checkpointY, this.selectedChar);

    this.bullets = [];
    this.grenades = [];
    this.enemies = [];
    this.destructibles = [];
    this.pickups = [];

    // Spawn initial enemies & destructibles along the track
    for (let x = 400; x < this.level.width - 600; x += 320) {
      const types = ['scout', 'drone', 'armored', 'hunter', 'turret'];
      const t = types[Math.floor(Math.random() * types.length)];
      this.enemies.push(new Enemy(x, 320, t));

      if (Math.random() < 0.6) {
        this.destructibles.push(new Destructible(x + 120, 376, Math.random() < 0.3 ? 'barrel' : 'crate'));
      }
    }

    this.state = 'PLAYING';
    document.querySelectorAll('.screen-layer').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');
    audio.checkpoint();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('screen-pause').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('screen-pause').classList.add('hidden');
    }
  }

  handlePlayerDeath() {
    this.lives--;
    this.particles.spawnExplosion(this.player.x + 10, this.player.y + 16, 40);
    setTimeout(() => {
      if (this.lives > 0) {
        this.player = new Player(this.checkpointX, this.checkpointY, this.selectedChar);
      } else {
        this.state = 'GAME_OVER';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('go-score').innerText = String(this.score).padStart(6, '0');
        document.getElementById('go-kills').innerText = this.kills;
        document.getElementById('go-combo').innerText = 'x' + this.maxCombo;
        document.getElementById('screen-game-over').classList.remove('hidden');
      }
    }, 1000);
  }

  dealAoEDamage(x, y, radius, damage) {
    this.enemies.forEach((e, idx) => {
      if (Math.hypot(e.x - x, e.y - y) < radius) {
        if (e.takeDamage(damage, this.particles)) {
          this.score += e.score;
          this.kills++;
          this.enemies.splice(idx, 1);
        }
      }
    });
    if (this.level.boss && Math.hypot(this.level.boss.x - x, this.level.boss.y - y) < radius) {
      if (this.level.boss.takeDamage(damage, this.particles)) {
        this.finishStage();
      }
    }
  }

  registerKill(points) {
    this.combo++;
    this.comboTimer = 2.5;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const bonus = points * Math.max(1, this.combo);
    this.score += bonus;
    this.kills++;
    audio.enemyKill();

    if (this.combo > 1) {
      const banner = document.getElementById('hud-combo');
      banner.innerText = `COMBO x${this.combo}! +${bonus}`;
      banner.classList.remove('hidden');
    }
  }

  finishStage() {
    this.state = 'CLEAR';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('clear-score').innerText = '+2500';
    document.getElementById('clear-time').innerText = '+1000';
    this.score += 3500;
    document.getElementById('clear-total').innerText = String(this.score).padStart(6, '0');
    document.getElementById('screen-stage-clear').classList.remove('hidden');
  }

  showVictoryScreen() {
    this.state = 'VICTORY';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('vic-score').innerText = String(this.score).padStart(6, '0');
    document.getElementById('vic-diff').innerText = this.difficulty.toUpperCase();
    document.getElementById('screen-victory').classList.remove('hidden');
  }

  update(dt) {
    if (this.input.isPressed('KeyP')) this.togglePause();
    if (this.state !== 'PLAYING') return;

    // Combo countdown
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        document.getElementById('hud-combo').classList.add('hidden');
      }
    }

    // Checkpoint Trigger
    this.level.checkpoints.forEach(cpX => {
      if (Math.abs(this.player.x - cpX) < 30 && this.checkpointX < cpX) {
        this.checkpointX = cpX;
        this.checkpointY = this.player.y;
        audio.checkpoint();
        const banner = document.getElementById('hud-checkpoint');
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 2000);
      }
    });

    this.player.update(dt, this.input, this);
    this.camera.follow(this.player, this.level.width, this.level.height);

    // Update Projectiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Collisions with Level Platforms
      let hitPlatform = false;
      this.level.platforms.forEach(p => {
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          hitPlatform = true;
        }
      });
      if (hitPlatform) {
        if (b.explosive) {
          this.particles.spawnExplosion(b.x, b.y, b.blastRadius);
          this.dealAoEDamage(b.x, b.y, b.blastRadius, b.damage);
        }
        this.bullets.splice(i, 1);
        continue;
      }

      // Bullet hit Player
      if (!b.isPlayer && Math.hypot(b.x - (this.player.x + 10), b.y - (this.player.y + 16)) < 14) {
        this.player.takeDamage(b.damage, this);
        this.bullets.splice(i, 1);
        continue;
      }

      // Bullet hit Enemy
      if (b.isPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
            if (b.explosive) {
              this.particles.spawnExplosion(b.x, b.y, b.blastRadius);
              this.dealAoEDamage(b.x, b.y, b.blastRadius, b.damage);
            } else if (e.takeDamage(b.damage, this.particles)) {
              this.registerKill(e.score);
              this.enemies.splice(j, 1);
            }
            this.bullets.splice(i, 1);
            break;
          }
        }

        // Bullet hit Boss
        if (this.level.boss && b.x > this.level.boss.x && b.x < this.level.boss.x + this.level.boss.w &&
            b.y > this.level.boss.y && b.y < this.level.boss.y + this.level.boss.h) {
          if (this.level.boss.takeDamage(b.damage, this.particles)) {
            this.finishStage();
          }
          this.bullets.splice(i, 1);
        }
      }
    }

    // Update Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(dt, this.level);
      if (g.timer <= 0) {
        this.particles.spawnExplosion(g.x, g.y, g.blastRadius);
        this.dealAoEDamage(g.x, g.y, g.blastRadius, g.damage);
        this.grenades.splice(i, 1);
      }
    }

    // Update Enemies
    this.enemies.forEach(e => e.update(dt, this.player, this.level, this.bullets, this.particles));

    // Update Boss
    if (this.level.boss) {
      this.level.boss.update(dt, this.player, this.bullets, this.particles, this);
    }

    // Pickups collision
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 24) {
        p.apply(this.player);
        this.pickups.splice(i, 1);
      }
    }

    this.particles.update(dt);
    this.updateHUD();
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = String(this.score).padStart(6, '0');
    document.getElementById('hud-lives').innerText = this.lives;
    document.getElementById('hud-hp-bar').style.width = Math.max(0, (this.player.hp / this.player.maxHp) * 100) + '%';
    document.getElementById('hud-weapon-name').innerText = this.player.currentWeapon.name;
    const curAmmo = this.player.ammo[this.player.currentWeapon.name];
    document.getElementById('hud-ammo').innerText = curAmmo === Infinity ? '∞' : curAmmo;
    document.getElementById('hud-grenades').innerText = 'x' + this.player.grenades;
    document.getElementById('hud-stage').innerText = `1-${this.currentLevelIdx + 1}`;

    // Boss HUD bar
    const bossHud = document.getElementById('hud-boss');
    if (this.level.boss && this.player.x > this.level.boss.x - 500) {
      bossHud.classList.remove('hidden');
      document.getElementById('hud-boss-name').innerText = this.level.boss.name;
      document.getElementById('hud-boss-hp-bar').style.width = Math.max(0, (this.level.boss.hp / this.level.boss.maxHp) * 100) + '%';
    } else {
      bossHud.classList.add('hidden');
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      const camX = this.camera.x;
      const camY = this.camera.y;

      this.level.draw(this.ctx, camX, camY);
      this.destructibles.forEach(d => d.draw(this.ctx, camX, camY));
      this.pickups.forEach(p => p.draw(this.ctx, camX, camY));
      this.enemies.forEach(e => e.draw(this.ctx, camX, camY));
      if (this.level.boss) this.level.boss.draw(this.ctx, camX, camY);

      this.bullets.forEach(b => b.draw(this.ctx, camX, camY));
      this.grenades.forEach(g => g.draw(this.ctx, camX, camY));
      this.player.draw(this.ctx, camX, camY);
      this.particles.draw(this.ctx, camX, camY);
    }
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Cap delta time
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }
}

// Launch Game Engine
window.addEventListener('load', () => {
  const game = new GameEngine();
  requestAnimationFrame(t => game.loop(t));
});