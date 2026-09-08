"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;

const DIFFICULTIES = {
  EASY:   { enemyHP:0.82, enemyDamage:0.75, enemyRate:0.78, ammo:1.25, hp:1.2, bossHP:0.85 },
  NORMAL: { enemyHP:1, enemyDamage:1, enemyRate:1, ammo:1, hp:1, bossHP:1 },
  HARD:   { enemyHP:1.22, enemyDamage:1.25, enemyRate:1.22, ammo:0.8, hp:0.9, bossHP:1.18 }
};

const CHARACTERS = [
  {name:"Rex", desc:"Balanced assault specialist.", speed:250, jump:620, hp:100, grenades:5, color:"#d95d39", accent:"#3f75b5"},
  {name:"Vera", desc:"Agile scout with sharper handling.", speed:280, jump:650, hp:90, grenades:6, color:"#b65cc6", accent:"#55b7a2"},
  {name:"Briggs", desc:"Heavy gunner with extra armor.", speed:225, jump:585, hp:125, grenades:4, color:"#d2a33b", accent:"#4c6b7d"}
];

const WEAPONS = {
  blaster: {name:"BLASTER", max:60, clip:30, rate:.18, damage:14, speed:720, spread:0, pellets:1, color:"#ffe274"},
  rapid:   {name:"RAPID BLASTER", max:90, clip:45, rate:.075, damage:8, speed:820, spread:0.035, pellets:1, color:"#74e9ff"},
  spread:  {name:"SPREAD CANNON", max:36, clip:18, rate:.32, damage:10, speed:690, spread:.18, pellets:5, color:"#f8a548"},
  pulse:   {name:"PULSE RIFLE", max:40, clip:20, rate:.42, damage:34, speed:940, spread:0, pellets:1, color:"#dc7dff"},
  rocket:  {name:"ROCKET LAUNCHER", max:10, clip:5, rate:.72, damage:80, speed:460, spread:0, pellets:1, color:"#ff6c47", explosive:true}
};

const LEVELS = [
  {id:"1-1", name:"JUNGLE OUTPOST", theme:"jungle", width:5200, boss:"IRON BEETLE", bossAt:4550, pit:false},
  {id:"1-2", name:"ENEMY FACTORY", theme:"factory", width:5600, boss:"GEAR WARDEN", bossAt:4850, pit:true},
  {id:"1-3", name:"MOUNTAIN BASE", theme:"mountain", width:5900, boss:"SKY REAPER", bossAt:5150, pit:true},
  {id:"1-4", name:"FORTRESS CORE", theme:"fortress", width:6200, boss:"TITAN CORE", bossAt:5250, pit:true}
];

const keys = new Set();
const touch = {left:false,right:false,up:false,down:false,jump:false,shoot:false,grenade:false};

class AudioManager {
  constructor(){ this.enabled=true; this.ctx=null; this.engineOsc=null; this.engineGain=null; }
  ensure(){ if(!this.enabled) return; try { if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); if(this.ctx.state==='suspended') this.ctx.resume(); } catch(e){} }
  tone(freq,dur,type="square",vol=.045){
    if(!this.enabled) return; this.ensure(); if(!this.ctx) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain(), t=this.ctx.currentTime;
    o.type=type; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur+.02);
  }
  event(name){
    const map={shoot:[320,.035], hit:[140,.05], death:[90,.18], jump:[520,.08], land:[180,.045], pickup:[720,.11], explode:[80,.26], boss:[120,.5], checkpoint:[900,.16], complete:[520,.45], gameover:[110,.5], grenade:[220,.12], warning:[260,.35]};
    const s=map[name]; if(!s) return; this.tone(s[0],s[1], name==='explode'?'sawtooth':'square', name==='shoot'?.025:.05);
  }
  engine(speed){
    if(!this.enabled) return; this.ensure(); if(!this.ctx) return;
    if(!this.engineOsc){
      this.engineOsc=this.ctx.createOscillator(); this.engineGain=this.ctx.createGain();
      this.engineOsc.type='sawtooth'; this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.ctx.destination); this.engineGain.gain.value=0; this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speed*.22, this.ctx.currentTime, .04);
    this.engineGain.gain.setTargetAtTime(.012 + Math.min(1, speed/400)*.018, this.ctx.currentTime, .06);
  }
  stopEngine(){ if(this.engineGain) this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.05); }
}

class InputManager {
  constructor(){
    window.addEventListener("keydown",e=>{const k=e.key.toLowerCase(); if(["arrowleft","arrowright","arrowup","arrowdown"," "].includes(k) || ["a","d","w","s","j","z","k","x","p","r"].includes(k)) e.preventDefault(); keys.add(k);});
    window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur",()=>{keys.clear(); Object.keys(touch).forEach(k=>touch[k]=false);});
    document.querySelectorAll(".touch-btn").forEach(b=>{
      const k=b.dataset.key; const set=v=>e=>{e.preventDefault(); touch[k]=v;};
      b.addEventListener("pointerdown",set(true)); b.addEventListener("pointerup",set(false)); b.addEventListener("pointercancel",set(false)); b.addEventListener("pointerleave",set(false));
    });
  }
  pressed(name){
    if(name==='left') return keys.has('a')||keys.has('arrowleft')||touch.left;
    if(name==='right') return keys.has('d')||keys.has('arrowright')||touch.right;
    if(name==='up') return keys.has('w')||keys.has('arrowup')||touch.up;
    if(name==='down') return keys.has('s')||keys.has('arrowdown')||touch.down;
    if(name==='jump') return keys.has(' ')||touch.jump;
    if(name==='shoot') return keys.has('j')||keys.has('z')||touch.shoot;
    if(name==='grenade') return keys.has('k')||keys.has('x')||touch.grenade;
    return false;
  }
}

class Particle {
  constructor(x,y,opt={}){ Object.assign(this,{x,y,vx:opt.vx||0,vy:opt.vy||0,life:opt.life||.5,max:opt.life||.5,size:opt.size||3,color:opt.color||"#fff",g:opt.g||0,alpha:1}); }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=this.g*dt; this.life-=dt; this.alpha=Math.max(0,this.life/this.max); }
  draw(cam){ if(this.life<=0)return; ctx.globalAlpha=this.alpha; ctx.fillStyle=this.color; ctx.fillRect(Math.round(this.x-cam.x),Math.round(this.y-cam.y),this.size,this.size); ctx.globalAlpha=1; }
}
class ParticleSystem {
  constructor(){this.items=[];}
  burst(x,y,count,color,spread=220,speed=220,size=4,g=420){ for(let i=0;i<count;i++){ const a=Math.random()*Math.PI*2, s=Math.random()*speed; this.items.push(new Particle(x,y,{vx:Math.cos(a)*s+(Math.random()-.5)*spread,vy:Math.sin(a)*s-(Math.random()*speed*.6),life:.25+Math.random()*.55,size:Math.max(2,size*(.7+Math.random()*.6)),color,g})); } }
  smoke(x,y){ for(let i=0;i<4;i++) this.items.push(new Particle(x,y,{vx:(Math.random()-.5)*30,vy:-20-Math.random()*30,life:.45+Math.random()*.3,size:5+Math.random()*4,color:"#d3d2c7",g:-15})); }
  update(dt){ for(let i=this.items.length-1;i>=0;i--){this.items[i].update(dt); if(this.items[i].life<=0)this.items.splice(i,1);} }
  draw(cam){ this.items.forEach(p=>p.draw(cam)); }
}

class Weapon {
  constructor(id="blaster"){this.id=id; this.ammo={}; Object.keys(WEAPONS).forEach(k=>this.ammo[k]=WEAPONS[k].max); this.timer=0;}
  get data(){return WEAPONS[this.id];}
  canFire(){return this.timer<=0 && this.ammo[this.id]>0;}
  fire(){ if(!this.canFire()) return false; this.ammo[this.id]--; this.timer=this.data.rate; return true; }
  update(dt){this.timer=Math.max(0,this.timer-dt);}
  refill(id=null,amount=10){if(id)this.ammo[id]=Math.min(WEAPONS[id].max,this.ammo[id]+amount); else Object.keys(this.ammo).forEach(k=>this.ammo[k]=WEAPONS[k].max);}
}

class Bullet {
  constructor(x,y,vx,vy,opt={}){Object.assign(this,{x,y,vx,vy,r:4,damage:opt.damage||10,color:opt.color||"#ffe274",owner:opt.owner||"player",life:opt.life||2,explosive:!!opt.explosive,alive:true,trail:opt.trail||false});}
  update(dt,game){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.life-=dt; if(this.life<=0)this.alive=false; if(this.x<-100||this.x>game.level.width+100||this.y<-100||this.y>H+500)this.alive=false; }
  draw(cam){ ctx.fillStyle=this.color; ctx.fillRect(Math.round(this.x-cam.x-3),Math.round(this.y-cam.y-2),7,4); if(this.trail){ctx.globalAlpha=.35;ctx.fillRect(Math.round(this.x-cam.x-10),Math.round(this.y-cam.y-1),8,2);ctx.globalAlpha=1;} }
}

class Grenade {
  constructor(x,y,vx,vy){Object.assign(this,{x,y,vx,vy,r:7,life:1.8,alive:true,bounces:0});}
  update(dt,game){ this.vy+=1250*dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.life-=dt; for(const p of game.level.platforms){ if(this.x>p.x&&this.x<p.x+p.w&&this.y+this.r>p.y&&this.y<p.y+p.h&&this.vy>0){this.y=p.y-this.r; this.vy=-Math.abs(this.vy)*.5; this.vx*=.82; this.bounces++; }} if(this.life<=0){this.alive=false; game.explode(this.x,this.y,70,50); } }
  draw(cam){ctx.fillStyle="#7aeb91";ctx.fillRect(Math.round(this.x-cam.x-5),Math.round(this.y-cam.y-5),10,10);ctx.fillStyle="#1a2d22";ctx.fillRect(Math.round(this.x-cam.x+1),Math.round(this.y-cam.y-8),3,4);}
}

class Platform {
  constructor(x,y,w,h,opt={}){Object.assign(this,{x,y,w,h,type:opt.type||"solid",oneWay:!!opt.oneWay,moving:!!opt.moving,baseX:x,baseY:y,range:opt.range||0,speed:opt.speed||1,phase:opt.phase||0});}
  update(dt){if(!this.moving)return; this.phase+=dt*this.speed; if(this.type==='vert')this.y=this.baseY+Math.sin(this.phase)*this.range; else this.x=this.baseX+Math.sin(this.phase)*this.range;}
  draw(theme,cam){const x=this.x-cam.x,y=this.y-cam.y; if(x+this.w<0||x>W||y+this.h<0||y>H)return; ctx.fillStyle=theme==='factory'||theme==='fortress'?"#6e747e":"#76512f"; ctx.fillRect(x,y,this.w,this.h); ctx.fillStyle=theme==='jungle'||theme==='mountain'?"#55a33c":"#a9b0bb"; ctx.fillRect(x,y,this.w,8); ctx.fillStyle="#2d2b2c"; for(let xx=x+8;xx<x+this.w;xx+=22)ctx.fillRect(xx,y+this.h-7,10,4); }
}

class Hazard {
  constructor(x,y,w,h,type){Object.assign(this,{x,y,w,h,type,active:true,t:0});}
  update(dt){this.t+=dt;}
  draw(theme,cam){const x=this.x-cam.x,y=this.y-cam.y; if(x>W||x+this.w<0)return; if(this.type==='fire'){ctx.fillStyle="#ea522f"; ctx.fillRect(x,y+this.h*.35,this.w,this.h*.65); ctx.fillStyle="#ffd24a";ctx.fillRect(x+4,y+(Math.sin(this.t*8)*3+4),this.w-8,this.h*.45);} else if(this.type==='spike'){ctx.fillStyle="#c7cad0"; for(let i=0;i<this.w;i+=12){ctx.beginPath();ctx.moveTo(x+i,y+this.h);ctx.lineTo(x+i+6,y);ctx.lineTo(x+i+12,y+this.h);ctx.fill();}} else {ctx.fillStyle="#9cd8ff";ctx.fillRect(x,y,this.w,this.h); ctx.fillStyle="#f0ffff";ctx.fillRect(x+4,y+this.h/2-2,this.w-8,4);}}
}

class Collectible {
  constructor(x,y,type,weapon=null){Object.assign(this,{x,y,w:20,h:20,type,weapon,alive:true,phase:Math.random()*6});}
  update(dt){this.phase+=dt*4;}
  draw(cam){if(!this.alive)return;const x=this.x-cam.x,y=this.y-cam.y;const bob=Math.sin(this.phase)*3;ctx.fillStyle=this.type==='ammo'?"#e3b53c":this.type==='health'?"#52dc69":this.type==='weapon'?"#8f73ea":"#4ad0d5";ctx.fillRect(x,y+bob,this.w,this.h);ctx.fillStyle="#222";ctx.font="bold 11px Courier New";ctx.fillText(this.type==='ammo'?"A":this.type==='health'?"+":this.type==='weapon'?"W":"P",x+5,y+14+bob);}
}

class Checkpoint {
  constructor(x){this.x=x;this.active=false;}
  draw(cam){const x=this.x-cam.x;ctx.fillStyle="#e5e7dc";ctx.fillRect(x,300,4,160);ctx.fillStyle=this.active?"#63ef73":"#c95e57";ctx.fillRect(x+4,308,36,22);ctx.fillStyle="#1f2627";ctx.fillRect(x+4,316,36,4);}
}

class Destructible {
  constructor(x,y,w=34,h=34){Object.assign(this,{x,y,w,h,hp:24,alive:true});}
  draw(cam){if(!this.alive)return;const x=this.x-cam.x,y=this.y-cam.y;ctx.fillStyle="#885a34";ctx.fillRect(x,y,this.w,this.h);ctx.fillStyle="#b98754";ctx.fillRect(x+4,y+4,this.w-8,this.h-8);ctx.strokeStyle="#54331f";ctx.beginPath();ctx.moveTo(x+7,y+7);ctx.lineTo(x+this.w-7,y+this.h-7);ctx.moveTo(x+this.w-7,y+7);ctx.lineTo(x+7,y+this.h-7);ctx.stroke();}
}

class Enemy {
  constructor(type,x,y,game){
    this.type=type; this.x=x; this.y=y; this.w=30; this.h=38; this.vx=type==='hunter'?105:type==='scout'?65:0; this.vy=0; this.hp= type==='armored'?75:type==='hunter'?40:type==='turret'?60:30; this.max=this.hp; this.cool=Math.random()*1.2; this.dir=Math.random()<.5?-1:1; this.state='patrol'; this.coverX=x; this.game=game; this.alive=true; this.onGround=false; this.phase=Math.random()*6; this.alert=0; if(type==='drone'){this.y-=10; this.baseY=this.y;this.h=24;this.vx=55;} if(type==='turret'){this.h=32;this.y-=4;}
    const d=game.diff; this.hp*=d.enemyHP; this.cool/=d.enemyRate;
  }
  hurt(dmg,game){if(!this.alive)return;this.hp-=dmg;game.audio.event('hit');game.particles.burst(this.x+this.w/2,this.y+this.h/2,4,"#fff",30,120,3,0); if(this.hp<=0)game.killEnemy(this);}
  update(dt,game){if(!this.alive)return; this.phase+=dt; const p=game.player; this.cool=Math.max(0,this.cool-dt); const dist=Math.hypot(p.x-this.x,p.y-this.y);
    if(dist<500)this.state='alert'; else if(this.state==='alert'&&dist>650)this.state='patrol';
    if(this.type==='drone'){this.x+=this.dir*this.vx*dt;this.y=this.baseY+Math.sin(this.phase*2.5)*28;if(this.x<0||this.x>game.level.width-40)this.dir*=-1;if(this.state==='alert'&&this.cool<=0)this.shootAtPlayer(game,.92);return;}
    if(this.type==='turret'){if(this.state==='alert'&&this.cool<=0)this.shootAtPlayer(game,1.1);return;}
    this.vy=Math.min(900,this.vy+1600*dt);this.x+=this.vx*dt;this.y+=this.vy*dt;this.onGround=false;
    for(const plat of game.level.platforms){if(this.x+this.w>plat.x&&this.x<plat.x+plat.w&&this.y+this.h>=plat.y&&this.y+this.h<=plat.y+35&&this.vy>=0){this.y=plat.y-this.h;this.vy=0;this.onGround=true;}}
    if(this.state==='patrol'){this.x+=this.dir*(this.type==='hunter'?40:30)*dt; if(this.x<this.coverX-130||this.x>this.coverX+130)this.dir*=-1;}
    if(this.state==='alert'){
      const dx=p.x-this.x; if(this.type==='hunter')this.dir=Math.sign(dx)||this.dir; this.x+=this.dir*(this.type==='hunter'?70:20)*dt; if(this.cool<=0)this.shootAtPlayer(game,this.type==='hunter'?1.4:.75);
    }
    if(this.onGround && this.type==='scout' && Math.random()<.004){this.vy=-450;}
    if(this.y>H+300)this.alive=false;
  }
  shootAtPlayer(game,rate){this.cool=rate;const p=game.player;const a=Math.atan2(p.y+16-(this.y+16),p.x+14-(this.x+14));const s=340+(this.type==='drone'?60:0);game.enemyBullets.push(new Bullet(this.x+14,this.y+14,Math.cos(a)*s,Math.sin(a)*s,{damage:this.type==='armored'?12:7,color:"#ff7a5c",owner:"enemy",life:3}));game.audio.event('shoot');}
  draw(cam){if(!this.alive)return;const x=this.x-cam.x,y=this.y-cam.y;const blink=this.hp<this.max*.35;ctx.fillStyle=this.type==='scout'?"#4b9950":this.type==='armored'?"#6f7782":this.type==='hunter'?"#c24b57":this.type==='drone'?"#7e66c7":"#a7723d";ctx.fillRect(x,y,this.w,this.h);ctx.fillStyle="#1b1b22";ctx.fillRect(x+5,y+8,this.w-10,10);ctx.fillStyle=blink?"#ffffff":"#6ee2db";ctx.fillRect(x+8,y+10,4,4);ctx.fillRect(x+19,y+10,4,4); if(this.type==='drone'){ctx.fillStyle="#d7dee6";ctx.fillRect(x-4,y+4,this.w+8,5);}}
}

class Boss {
  constructor(kind,x,y,game){this.kind=kind;this.x=x;this.y=y;this.w=130;this.h=110;this.vx=0;this.vy=0;this.max= this.baseHP(game); this.hp=this.max; this.phase=0;this.cool=1;this.cool2=2;this.alive=true;this.game=game;this.stage=1;this.dir=-1;this.inv=0;}
  baseHP(game){return ({"IRON BEETLE":900,"GEAR WARDEN":1100,"SKY REAPER":1250,"TITAN CORE":1600})[this.kind]*game.diff.bossHP;}
  hurt(dmg,game){if(this.inv>0)return;this.hp-=dmg;this.inv=.06;game.audio.event('hit');game.screenShake=5;game.particles.burst(this.x+this.w/2,this.y+this.h/2,8,"#ffe18c",180,240,4,100);if(this.hp<=0)this.alive=false;}
  update(dt,game){if(!this.alive)return;this.phase+=dt;this.cool=Math.max(0,this.cool-dt);this.cool2=Math.max(0,this.cool2-dt);this.inv=Math.max(0,this.inv-dt);this.stage=this.hp<this.max*.5?2:1;const p=game.player;
    if(this.kind==='IRON BEETLE'||this.kind==='GEAR WARDEN'||this.kind==='TITAN CORE'){this.x+=Math.sin(this.phase*.7)*18*dt; this.y=game.level.bossY;}
    if(this.kind==='SKY REAPER'){this.y=game.level.bossY+Math.sin(this.phase*1.8)*75;this.x+=Math.sin(this.phase*.6)*25*dt;}
    if(this.cool<=0){this.cool=this.kind==='TITAN CORE'?.8:this.stage===2?.9:1.25;this.firePattern(game);}
    if(this.cool2<=0 && this.stage===2){this.cool2=3.2;for(let i=0;i<3;i++)game.enemyBullets.push(new Bullet(this.x+this.w/2,this.y+60,(-1+i)*90,220,{damage:10,color:"#f6c542",life:3}));}
  }
  firePattern(game){const p=game.player;const cx=this.x+this.w/2,cy=this.y+45;const ang=Math.atan2(p.y+16-cy,p.x+14-cx);if(this.kind==='IRON BEETLE'){for(let i=-1;i<=1;i++){const a=ang+i*.14;game.enemyBullets.push(new Bullet(cx,cy,Math.cos(a)*330,Math.sin(a)*330,{damage:12,color:"#ff7650",life:3}));}} else if(this.kind==='SKY REAPER'){for(let i=0;i<7;i++){const a=(i-3)*.14+Math.atan2(p.y+16-cy,p.x+14-cx);game.enemyBullets.push(new Bullet(cx,cy,Math.cos(a)*360,Math.sin(a)*360,{damage:9,color:"#8ef0ff",life:3}));}} else if(this.kind==='GEAR WARDEN'){game.enemyBullets.push(new Bullet(cx,cy,Math.cos(ang)*390,Math.sin(ang)*390,{damage:14,color:"#ffba58",life:3})); if(this.stage===2){game.spawnEnemy('scout',this.x-80,this.y+50);}} else {for(let i=0;i<8;i++){const a=i*Math.PI/4+this.phase;game.enemyBullets.push(new Bullet(cx,cy,Math.cos(a)*280,Math.sin(a)*280,{damage:13,color:"#e46dff",life:3}));}} game.audio.event('shoot'); }
  draw(cam){if(!this.alive)return;const x=this.x-cam.x,y=this.y-cam.y;ctx.fillStyle="#303846";ctx.fillRect(x,y,this.w,this.h);ctx.fillStyle="#6a7280";ctx.fillRect(x+12,y+10,this.w-24,28);ctx.fillStyle=this.kind==='TITAN CORE'?"#d65a76":"#54bdac";ctx.fillRect(x+34,y+30,62,40);ctx.fillStyle="#151922";ctx.fillRect(x+48,y+42,34,18);ctx.fillStyle="#ffe073";ctx.fillRect(x+58,y+46,14,8);for(let i=0;i<4;i++){ctx.fillStyle="#858d9b";ctx.fillRect(x+10+i*30,y+78,20,24);}}
}

class Level {
  constructor(data,game){this.data=data;this.width=data.width;this.theme=data.theme;this.platforms=[];this.enemies=[];this.bullets=[];this.collectibles=[];this.hazards=[];this.destructibles=[];this.checkpoints=[];this.boss=null;this.startX=120;this.bossX=data.bossAt;this.bossY=this.theme==='mountain'?250:300;this.pitZone=data.pit?{x:3600,w:260}:null;this.waterZones=this.theme==='mountain'?[{x:900,w:250,y:435,h:25}]:[];this.generate(game);}
  ground(x,w,y=460,h=80){this.platforms.push(new Platform(x,y,w,h));}
  generate(game){this.ground(0,this.width); const step=this.theme==='mountain'?330:380; for(let x=230,i=0;x<this.width-450;x+=step,i++){const y=365-(i%4)*40 + (this.theme==='mountain'?(i%2)*-35:0);this.platforms.push(new Platform(x,y,190,26)); if(i%3===1)this.platforms.push(new Platform(x+210,y-55,120,24,{oneWay:true})); if(this.theme==='factory'&&i%3===0)this.platforms.push(new Platform(x+40,y-120,100,22,{moving:true,type:'vert',range:55,speed:1.2,phase:i})); if(this.theme==='mountain'&&i%4===0)this.platforms.push(new Platform(x+20,y-110,120,22,{moving:true,type:'horiz',range:70,speed:1.1,phase:i})); if(this.theme==='fortress'&&i%2===0)this.platforms.push(new Platform(x+220,300,120,22));}
    for(let x=520,i=0;x<this.bossX-250;x+=300,i++){const groundY=460; if(i%4!==2)this.enemies.push(new Enemy(i%5===1?'hunter':i%5===2?'armored':i%5===3?'drone':'scout',x,groundY-40,game)); if(i%5===0)this.enemies.push(new Enemy('turret',x+80,270,game)); if(i%4===0)this.collectibles.push(new Collectible(x+50,330,'ammo')); if(i%7===0)this.collectibles.push(new Collectible(x+110,290,'health')); if(i%6===0)this.collectibles.push(new Collectible(x+145,310,'weapon', i%12===0?'pulse':'rapid')); if(i%3===0)this.destructibles.push(new Destructible(x+190,426)); if(i%5===0)this.hazards.push(new Hazard(x+250,432,50,28,this.theme==='factory'?'laser':'spike'));}
    const cps=[1500,3000,4200].filter(x=>x<this.bossX-200); cps.forEach(x=>this.checkpoints.push(new Checkpoint(x))); if(this.data.pit)this.collectibles.push(new Collectible(this.bossX-850,420,'ammo')); this.boss=new Boss(this.data.boss,this.bossX,this.bossY,game); this.boss.alive=false;
  }
  update(dt,game){this.platforms.forEach(p=>p.update(dt));this.hazards.forEach(h=>h.update(dt));this.collectibles.forEach(c=>c.update(dt));}
  draw(game,cam){drawBackground(this.theme,cam.x);if(this.waterZones.length){for(const z of this.waterZones){const x=z.x-cam.x;ctx.fillStyle="#2d9ec4";ctx.fillRect(x,z.y,z.w,z.h);ctx.fillStyle="rgba(220,250,255,.6)";ctx.fillRect(x+10,z.y+5,z.w-20,3);}}if(this.pitZone){const x=this.pitZone.x-cam.x;ctx.fillStyle="#5a5f69";ctx.fillRect(x,430,this.pitZone.w,30);ctx.fillStyle="#e5bd45";for(let xx=x;xx<x+this.pitZone.w;xx+=28)ctx.fillRect(xx,442,14,4);}this.platforms.forEach(p=>p.draw(this.theme,cam));this.checkpoints.forEach(c=>c.draw(cam));this.hazards.forEach(h=>h.draw(this.theme,cam));this.destructibles.forEach(d=>d.draw(cam));this.collectibles.forEach(c=>c.draw(cam));}
}

function drawBackground(theme,camX){
  if(theme==='jungle'){ctx.fillStyle="#76c8ff";ctx.fillRect(0,0,W,H);for(let i=0;i<10;i++){const x=i*180-(camX*.18%180);ctx.fillStyle="#3c7c5a";ctx.fillRect(x+50,180,28,280);ctx.fillRect(x,205,130,28);ctx.fillRect(x+20,160,85,30);}ctx.fillStyle="#54a445";ctx.fillRect(0,410,W,130);}
  else if(theme==='factory'){ctx.fillStyle="#7e8794";ctx.fillRect(0,0,W,H);ctx.fillStyle="#38414c";ctx.fillRect(0,220,W,240);for(let i=0;i<8;i++){const x=i*150-(camX*.3%150);ctx.fillStyle="#252d38";ctx.fillRect(x,120,100,100);ctx.fillStyle="#d75e4e";ctx.fillRect(x+20,155,12,12);ctx.fillStyle="#6bc6d9";ctx.fillRect(x+55,170,20,10);}ctx.fillStyle="#4f565e";ctx.fillRect(0,410,W,130);}
  else if(theme==='mountain'){ctx.fillStyle="#5c9ac7";ctx.fillRect(0,0,W,H);for(let i=0;i<7;i++){const x=i*190-(camX*.22%190);ctx.fillStyle="#53677d";ctx.beginPath();ctx.moveTo(x,430);ctx.lineTo(x+80,180);ctx.lineTo(x+180,430);ctx.closePath();ctx.fill();ctx.fillStyle="#dae1dc";ctx.beginPath();ctx.moveTo(x+80,180);ctx.lineTo(x+62,235);ctx.lineTo(x+98,225);ctx.closePath();ctx.fill();}ctx.fillStyle="#314936";ctx.fillRect(0,410,W,130);}
  else {ctx.fillStyle="#1b2430";ctx.fillRect(0,0,W,H);for(let i=0;i<10;i++){const x=i*130-(camX*.18%130);ctx.fillStyle="#333f4b";ctx.fillRect(x,90,90,320);ctx.fillStyle="#db4d64";ctx.fillRect(x+18,145,8,8);ctx.fillStyle="#5fd6dc";ctx.fillRect(x+52,195,12,8);}ctx.fillStyle="#20272d";ctx.fillRect(0,410,W,130);}
}

class Player {
  constructor(character,game){this.char=character;this.w=28;this.h=42;this.weapon=new Weapon();this.x=game.level.startX;this.y=360;this.vx=0;this.vy=0;this.onGround=false;this.crouch=false;this.facing=1;this.aimY=0;this.hp=character.hp*game.diff.hp;this.maxHp=this.hp;this.inv=0;this.fuel=100;this.grip=100;this.damagePct=0;this.maxSpeedPenalty=0;this.fireLock=0;this.grenadeLock=0;this.grenades=character.grenades;this.respawnX=game.level.startX;this.respawnY=360;this.kills=0;}
  resetAt(x,y){this.x=x;this.y=y;this.vx=0;this.vy=0;this.hp=this.maxHp;this.inv=2;this.weapon.timer=0;this.fuel=100;this.grip=100;this.damagePct=0;this.maxSpeedPenalty=0;}
  update(dt,game){const input=game.input;const left=input.pressed('left'),right=input.pressed('right'),up=input.pressed('up'),down=input.pressed('down');this.crouch=down&&this.onGround;const baseSpeed=this.char.speed*(this.crouch?.55:1);const gripFactor=.72+.28*(this.grip/100);const speed=baseSpeed*gripFactor*(1-this.damagePct*.004);this.fuel=Math.max(0,this.fuel - ((Math.abs(this.vx)/this.char.speed)*1.25*dt));if(this.fuel<=0)this.damagePct=Math.min(70,this.damagePct+0.04*dt);const acc=2200;
    if(left){this.vx-=acc*dt;this.facing=-1;}if(right){this.vx+=acc*dt;this.facing=1;}if(!left&&!right)this.vx*=Math.pow(.001,dt);if((left||right)&&Math.abs(this.vx)>this.char.speed*.55)this.grip=Math.max(0,this.grip-7*dt);else this.grip=Math.min(100,this.grip+3.5*dt);this.vx=Math.max(-speed,Math.min(speed,this.vx)); if(input.pressed('jump')&&!this.jumpHeld&&this.onGround&&!this.crouch){this.vy=-this.char.jump;this.onGround=false;game.audio.event('jump');}this.jumpHeld=input.pressed('jump');this.vy=Math.min(980,this.vy+1650*dt);
    if(input.pressed('shoot')&&this.fireLock<=0)this.shoot(game); if(input.pressed('grenade')&&this.grenadeLock<=0){this.throwGrenade(game);}
    this.fireLock=Math.max(0,this.fireLock-dt);this.grenadeLock=Math.max(0,this.grenadeLock-dt);this.weapon.update(dt);this.inv=Math.max(0,this.inv-dt);
    this.aimY=up?-1:down?1:0; if(Math.abs(this.vx)>10)game.audio.engine(Math.abs(this.vx));else game.audio.stopEngine();
    const oldY=this.y;this.x+=this.vx*dt;this.y+=this.vy*dt;this.onGround=false;
    for(const p of game.level.platforms){if(this.x+this.w>p.x&&this.x<p.x+p.w&&oldY+this.h<=p.y+12&&this.y+this.h>=p.y&&this.vy>=0){this.y=p.y-this.h;this.vy=0;this.onGround=true;}}
    for(const p of game.level.platforms){if(this.x+this.w>p.x&&this.x<p.x+p.w&&this.y<p.y+p.h&&this.y+this.h>p.y&&this.vy<0){if(oldY>=p.y+p.h-4){this.y=p.y+p.h;this.vy=30;}}}
    this.x=Math.max(0,Math.min(game.level.width-this.w,this.x));
    if(this.y>H+250)game.playerHit(999);
  }
  shoot(game){if(!this.weapon.canFire())return;this.weapon.fire();const d=this.weapon.data;let base=-this.facing;let ang=this.aimY===-1?-Math.PI/2:this.aimY===1?Math.PI/2:0; if(this.aimY!==0)ang*=base; else ang=this.facing>0?0:Math.PI; if(this.aimY===-1&&this.facing<0)ang=-Math.PI/2; if(this.aimY===1&&this.facing<0)ang=Math.PI/2; for(let i=0;i<d.pellets;i++){let a=ang+(Math.random()-.5)*d.spread;const px=this.x+this.w/2+Math.cos(a)*18,py=this.y+18+Math.sin(a)*18;game.bullets.push(new Bullet(px,py,Math.cos(a)*d.speed,Math.sin(a)*d.speed,{damage:d.damage,color:d.color,owner:'player',explosive:d.explosive,trail:true,life:2.5}));}this.fireLock=d.rate;game.audio.event('shoot');game.particles.burst(this.x+this.w/2+this.facing*18,this.y+18,3,"#ffe38a",30,80,3,0);}
  throwGrenade(game){if(this.grenades<=0)return;this.grenades--;this.grenadeLock=.45;const dir=this.facing;game.grenades.push(new Grenade(this.x+dir*18,this.y+12,dir*300,-500));game.audio.event('grenade');}
  damage(amount,game){if(this.inv>0)return;this.hp-=amount;this.damagePct=Math.min(90,this.damagePct+amount*.16);this.maxSpeedPenalty=this.damagePct;this.inv=1.1;game.screenShake=8;game.audio.event('hit');game.particles.burst(this.x+14,this.y+18,7,"#ff735c",120,220,3,160);if(this.hp<=0)game.playerHit(999);}
  draw(cam){if(this.inv>0&&Math.floor(this.inv*18)%2===0)return;const x=this.x-cam.x,y=this.y-cam.y;ctx.save();ctx.translate(x+14,y+21);ctx.scale(this.facing,1);ctx.fillStyle=this.char.color;ctx.fillRect(-12,-10,24,20);ctx.fillStyle="#2c3943";ctx.fillRect(-9,-26,18,16);ctx.fillStyle="#e8b086";ctx.fillRect(-7,-21,13,10);ctx.fillStyle=this.char.accent;ctx.fillRect(-10,10,8,11);ctx.fillRect(2,10,8,11);ctx.fillStyle="#20252d";ctx.fillRect(3,-16,4,4);ctx.fillRect(16,-2,14,4);if(this.crouch)ctx.fillRect(-15,4,28,5);ctx.restore();}
}

class Camera {constructor(){this.x=0;this.y=0;this.shake=0;}update(dt,player,level){const tx=Math.max(0,Math.min(level.width-W,player.x-W*.35));this.x+= (tx-this.x)*(1-Math.pow(.0001,dt));this.y=0;if(this.shake>0){this.shake*=Math.pow(.02,dt);this.x+=(Math.random()-.5)*this.shake;this.y+=(Math.random()-.5)*this.shake;}}}

class Game {
  constructor(){this.input=new InputManager();this.audio=new AudioManager();this.particles=new ParticleSystem();this.camera=new Camera();this.state='menu';this.characterIndex=0;this.levelIndex=0;this.diff=DIFFICULTIES.NORMAL;this.diffName='NORMAL';this.level=null;this.player=null;this.bullets=[];this.enemyBullets=[];this.grenades=[];this.enemies=[];this.score=0;this.lives=3;this.combo=1;this.comboTimer=0;this.checkpoint=0;this.screenShake=0;this.selectedLevel=0;this.pitTimer=0;this.pitAction=null;this.pitX=0;this.bindUI();this.renderSelections();this.last=performance.now();requestAnimationFrame(t=>this.loop(t));}
  bindUI(){
    const $=id=>document.getElementById(id); const show=id=>$(id).classList.remove('hidden'); const hide=id=>$(id).classList.add('hidden');
    $('startBtn').onclick=()=>this.startGame(0); $('charBtn').onclick=()=>{hide('menu');show('characterScreen');}; $('levelBtn').onclick=()=>{hide('menu');show('levelScreen');}; $('howBtn').onclick=()=>{hide('menu');show('howScreen');};
    $('diffBtn').onclick=()=>{const names=['EASY','NORMAL','HARD'];const i=(names.indexOf(this.diffName)+1)%3;this.diffName=names[i];this.diff=DIFFICULTIES[this.diffName];$('diffBtn').textContent='DIFFICULTY: '+this.diffName;};
    $('soundBtn').onclick=()=>{this.audio.enabled=!this.audio.enabled;$('soundBtn').textContent='SOUND: '+(this.audio.enabled?'ON':'OFF'); if(this.audio.enabled)this.audio.event('pickup');};
    $('charBackBtn').onclick=()=>{hide('characterScreen');show('menu');}; $('levelBackBtn').onclick=()=>{hide('levelScreen');show('menu');}; $('howBackBtn').onclick=()=>{hide('howScreen');show('menu');};
    $('resumeBtn').onclick=()=>this.setState('playing'); $('pitRefuelBtn').onclick=()=>this.startPitAction('refuel'); $('pitGripBtn').onclick=()=>this.startPitAction('grip'); $('pitRepairBtn').onclick=()=>this.startPitAction('repair'); $('pitContinueBtn').onclick=()=>this.leavePit(); $('restartBtn').onclick=()=>this.restartLevel(); $('pauseMenuBtn').onclick=()=>this.toMenu();
    $('overRetryBtn').onclick=()=>this.restartLevel(true); $('overMenuBtn').onclick=()=>this.toMenu(); $('completeRetryBtn').onclick=()=>this.restartLevel(true); $('completeMenuBtn').onclick=()=>this.toMenu(); $('nextLevelBtn').onclick=()=>this.nextLevel(); $('victoryReplayBtn').onclick=()=>this.startGame(0); $('victoryMenuBtn').onclick=()=>this.toMenu();
  }
  setState(s){this.state=s;document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));if(s==='menu')document.getElementById('menu').classList.remove('hidden');if(s==='character')document.getElementById('characterScreen').classList.remove('hidden');if(s==='levelselect')document.getElementById('levelScreen').classList.remove('hidden');if(s==='paused')document.getElementById('pauseScreen').classList.remove('hidden');if(s==='pit')document.getElementById('pitScreen').classList.remove('hidden');if(s==='gameover')document.getElementById('gameOverScreen').classList.remove('hidden');if(s==='complete')document.getElementById('completeScreen').classList.remove('hidden');if(s==='victory')document.getElementById('victoryScreen').classList.remove('hidden');this.updateHudVisibility();}
  updateHudVisibility(){document.getElementById('hud').classList.toggle('hidden',!(this.state==='playing'||this.state==='paused'||this.state==='pit'));document.getElementById('touchControls').classList.toggle('hidden',!(this.state==='playing'));}
  toMenu(){this.audio.stopEngine();this.setState('menu');}
  renderSelections(){
    const cg=document.getElementById('characterCards');cg.innerHTML='';CHARACTERS.forEach((c,i)=>{const div=document.createElement('div');div.className='option-card '+(i===this.characterIndex?'selected':'');div.innerHTML=`<h3>${c.name}</h3><p>${c.desc}</p><div class="stat">SPEED<div class="statbar"><span style="width:${c.speed/3}%"></span></div></div><div class="stat">HP<div class="statbar"><span style="width:${c.hp/1.3}%"></span></div></div><div class="stat">JUMP<div class="statbar"><span style="width:${c.jump/7}%"></span></div></div><button>SELECT</button>`;div.querySelector('button').onclick=()=>{this.characterIndex=i;this.renderSelections();};cg.appendChild(div);});
    const lg=document.getElementById('levelCards');lg.innerHTML='';LEVELS.forEach((l,i)=>{const div=document.createElement('div');div.className='option-card '+(i===this.selectedLevel?'selected':'')+(i>this.levelIndex?' locked':'');div.innerHTML=`<h3>${l.id} — ${l.name}</h3><p>Theme: ${l.theme.toUpperCase()}<br>Boss: ${l.boss}</p><button>${i>this.levelIndex?'LOCKED':'SELECT'}</button>`;div.querySelector('button').onclick=()=>{if(i<=this.levelIndex){this.selectedLevel=i;this.renderSelections();this.startGame(i);}};lg.appendChild(div);});
  }
  startGame(levelIndex=0){this.levelIndex=levelIndex;this.selectedLevel=levelIndex;this.score=0;this.lives=3;this.combo=1;this.checkpoint=0;this.loadLevel();this.setState('playing');this.audio.event('checkpoint');}
  loadLevel(){this.level=new Level(LEVELS[this.levelIndex],this);this.player=new Player(CHARACTERS[this.characterIndex],this);this.bullets=[];this.enemyBullets=[];this.grenades=[];this.level.boss.alive=false;this.bossWarned=false;this.updateHud();}
  restartLevel(full=false){if(full)this.lives=3;this.loadLevel();this.setState('playing');}
  nextLevel(){if(this.levelIndex>=LEVELS.length-1){this.finishVictory();return;}this.levelIndex++;this.loadLevel();this.setState('playing');}
  spawnEnemy(type,x,y){this.level.enemies.push(new Enemy(type,x,y,this));}
  activateBoss(){if(this.level.boss.alive)return;this.level.boss.alive=true;this.audio.event('boss');this.screenShake=10;this.enemyBullets=[];this.particles.burst(this.level.boss.x+60,this.level.boss.y+55,35,"#ff8e68",250,450,5,120);}
  killEnemy(e){if(!e.alive)return;e.alive=false;this.player.kills++;this.score += e.type==='armored'?250:e.type==='turret'?300:100;this.combo=Math.min(9,this.combo+1);this.comboTimer=2.8;this.score+=50*(this.combo-1);this.particles.burst(e.x+15,e.y+15,12,"#ffb57b",180,280,4,420);this.audio.event('death');if(Math.random()<.22)this.level.collectibles.push(new Collectible(e.x,e.y,'ammo'));if(Math.random()<.1)this.level.collectibles.push(new Collectible(e.x,e.y-20,'health'));}
  playerHit(amount){if(this.state!=='playing')return;if(amount!==999)this.player.damage(amount,this);if(amount===999||this.player.hp<=0){this.lives--;this.combo=1;if(this.lives<=0){this.audio.event('gameover');document.getElementById('gameOverText').textContent=`SCORE ${String(this.score).padStart(6,'0')} · KILLS ${this.player.kills}`;this.setState('gameover');}else{this.respawn();}}}
  respawn(){const x=this.checkpoint||this.level.startX;this.player.resetAt(x,360);this.enemyBullets=[];this.bullets=[];this.grenades=[];this.camera.x=Math.max(0,x-W*.35);this.particles.burst(x,400,12,"#71e5bb",160,220,4,180);}
  explode(x,y,radius,damage){this.particles.burst(x,y,30,"#ff724d",280,450,5,300);this.audio.event('explode');this.screenShake=12;const p=this.player;if(Math.hypot(p.x-x,p.y-y)<radius)p.damage(damage,this);this.level.enemies.forEach(e=>{if(e.alive&&Math.hypot(e.x-x,e.y-y)<radius)e.hurt(damage*1.3,this);});if(this.level.boss&&this.level.boss.alive&&Math.hypot(this.level.boss.x-x,this.level.boss.y-y)<radius)this.level.boss.hurt(damage*1.4,this);}
  collideBullets(){
    for(const b of this.bullets){if(!b.alive)continue;for(const d of this.level.destructibles){if(d.alive&&pointRect(b.x,b.y,d)){d.hp-=b.damage;if(d.hp<=0){d.alive=false;this.score+=50;this.particles.burst(d.x+15,d.y+15,12,"#c8925a",160,240,4,380);this.explode(d.x+15,d.y+15,30,20);}b.alive=false;break;}}if(!b.alive)continue;for(const e of this.level.enemies){if(e.alive&&pointRect(b.x,b.y,e)){e.hurt(b.damage,this);b.alive=false;if(b.explosive)this.explode(b.x,b.y,75,b.damage*.65);break;}}if(!b.alive)continue;if(this.level.boss&&this.level.boss.alive&&pointRect(b.x,b.y,this.level.boss)){this.level.boss.hurt(b.damage,this);b.alive=false;if(b.explosive)this.explode(b.x,b.y,85,b.damage*.45);}}
    for(const b of this.enemyBullets){if(!b.alive)continue;if(pointRect(b.x,b.y,this.player)){this.player.damage(b.damage,this);b.alive=false;}}
  }
  collect(){for(const c of this.level.collectibles){if(c.alive&&rects(this.player,c)){c.alive=false;if(c.type==='ammo'){this.player.weapon.refill(null,8);this.score+=50;this.audio.event('pickup');}else if(c.type==='health'){this.player.hp=Math.min(this.player.maxHp,this.player.hp+28);this.score+=50;this.audio.event('pickup');}else if(c.type==='weapon'){this.player.weapon.id=c.weapon||'rapid';this.player.weapon.refill(this.player.weapon.id,10);this.score+=50;this.audio.event('pickup');}else{this.score+=100;this.audio.event('pickup');}}}
    for(const cp of this.level.checkpoints){if(!cp.active&&this.player.x>cp.x){cp.active=true;this.checkpoint=cp.x;this.audio.event('checkpoint');this.particles.burst(cp.x,330,15,"#7fe6b4",180,250,3,180);}}
  }
  hazards(){for(const h of this.level.hazards)if(rects(this.player,h)){this.player.damage(h.type==='laser'?16:20,this);if(h.type==='fire')this.particles.burst(this.player.x+14,this.player.y+34,8,"#ff974f",100,180,3,160);}}
  enemyContacts(){for(const e of this.level.enemies)if(e.alive&&rects(this.player,e))this.player.damage(e.type==='armored'?18:12,this);if(this.level.boss&&this.level.boss.alive&&rects(this.player,this.level.boss))this.player.damage(22,this);}
  enterPit(){if(!this.level.pitZone||this.pitTimer>0)return;this.pitX=this.level.pitZone.x;this.player.vx=0;this.setState('pit');document.getElementById('pitText').textContent=`Fuel ${Math.round(this.player.fuel??100)}% · Grip ${Math.round(this.player.grip)}% · Damage ${Math.round(this.player.damagePct)}%`;}
  startPitAction(action){if(this.state!=='pit'||this.pitTimer>0)return;this.pitAction=action;this.pitTimer=2;document.getElementById('pitText').textContent=`${action.toUpperCase()} IN PROGRESS…`;this.audio.event('warning');}
  leavePit(){if(this.pitTimer>0)return;this.pitAction=null;this.setState('playing');}
  finishPitAction(){if(!this.pitAction)return;if(this.pitAction==='refuel')this.player.fuel=100;if(this.pitAction==='grip')this.player.grip=100;if(this.pitAction==='repair'){this.player.damagePct=0;this.player.maxSpeedPenalty=0;}this.pitAction=null;document.getElementById('pitText').textContent=`Service complete. Fuel ${Math.round(this.player.fuel)}% · Grip ${Math.round(this.player.grip)}% · Damage ${Math.round(this.player.damagePct)}%`;this.audio.event('pickup');}
  loop(t){const dt=Math.min(.033,(t-this.last)/1000);this.last=t;if(this.state==='playing')this.update(dt);this.render();requestAnimationFrame(x=>this.loop(x));}
  update(dt){if(this.state==='pit'){if(this.pitTimer>0){this.pitTimer-=dt;if(this.pitTimer<=0)this.finishPitAction();}this.particles.update(dt);this.updateHud();return;}if(this.state!=='playing')return;this.level.update(dt,this);this.player.update(dt,this);this.level.enemies.forEach(e=>e.update(dt,this));if(this.level.boss&&this.level.boss.alive)this.level.boss.update(dt,this);this.bullets.forEach(b=>b.update(dt,this));this.enemyBullets.forEach(b=>b.update(dt,this));this.grenades.forEach(g=>g.update(dt,this));this.bullets=this.bullets.filter(b=>b.alive);this.enemyBullets=this.enemyBullets.filter(b=>b.alive);this.grenades=this.grenades.filter(g=>g.alive);this.collideBullets();this.collect();this.hazards();this.enemyContacts();if(this.level.waterZones.some(z=>rects(this.player,z))){this.player.vx*=.88;this.player.fuel=Math.max(0,this.player.fuel-.15*dt);}if(this.level.pitZone&&this.player.x>this.level.pitZone.x&&this.player.x<this.level.pitZone.x+this.level.pitZone.w&&this.player.onGround&&this.input.pressed('down'))this.enterPit();this.particles.update(dt);this.comboTimer=Math.max(0,this.comboTimer-dt);if(this.comboTimer<=0)this.combo=1;this.camera.update(dt,this.player,this.level);this.screenShake=Math.max(0,this.screenShake-dt*20);if(this.player.x>this.level.bossX-350)this.activateBoss();if(this.level.boss&&!this.level.boss.alive&&this.bossWarned){this.score+=5000;this.setState(this.levelIndex===LEVELS.length-1?'victory':'complete');if(this.state==='complete'){document.getElementById('completeText').textContent=`${this.level.data.boss} destroyed. Score ${String(this.score).padStart(6,'0')} · Kills ${this.player.kills}`;}else{document.getElementById('victoryText').textContent=`FINAL SCORE ${String(this.score).padStart(6,'0')} · KILLS ${this.player.kills}`;}this.audio.event('complete');this.renderSelections();}if(this.level.boss&&this.level.boss.alive)this.bossWarned=true;this.updateHud();
    if(keys.has('p')){keys.delete('p');this.setState('paused');}if(keys.has('r')){keys.delete('r');this.restartLevel();}
  }
  updateHud(){const pad=n=>String(n).padStart(6,'0');document.getElementById('scoreVal').textContent=pad(this.score);document.getElementById('livesVal').textContent=this.lives;const hpBars=Math.max(0,Math.ceil((this.player?.hp||0)/(this.player?.maxHp||100)*10));document.getElementById('hpVal').textContent='█'.repeat(hpBars)+'░'.repeat(10-hpBars);document.getElementById('weaponVal').textContent=this.player?.weapon.data.name||'BLASTER';document.getElementById('fuelVal').textContent=Math.round(this.player?.fuel??100)+'%';document.getElementById('gripVal').textContent=Math.round(this.player?.grip??100)+'%';document.getElementById('damageVal').textContent=Math.round(this.player?.damagePct??0)+'%';document.getElementById('ammoVal').textContent=this.player?.weapon.ammo[this.player.weapon.id]??30;document.getElementById('levelVal').textContent=this.level?.data.id||'1-1';document.getElementById('comboVal').textContent='×'+this.combo;const bh=document.getElementById('bossHud');if(this.level?.boss?.alive){bh.classList.remove('hidden');document.getElementById('bossName').textContent=this.level.boss.kind;document.getElementById('bossBarFill').style.width=Math.max(0,this.level.boss.hp/this.level.boss.max*100)+'%';}else bh.classList.add('hidden');}
  render(){ctx.save();ctx.clearRect(0,0,W,H);if(this.level)this.level.draw(this,this.camera);else{ctx.fillStyle="#152337";ctx.fillRect(0,0,W,H);drawBackground('jungle',0);}if(this.state==='playing'||this.state==='paused'||this.state==='pit'||this.state==='complete'||this.state==='victory'||this.state==='gameover'){for(const b of this.bullets)b.draw(this.camera);for(const b of this.enemyBullets)b.draw(this.camera);for(const g of this.grenades)g.draw(this.camera);this.level?.enemies.forEach(e=>e.draw(this.camera));this.player?.draw(this.camera);this.level?.boss?.alive&&this.level.boss.draw(this.camera);this.particles.draw(this.camera);}ctx.restore();}
}

function rects(a,b){return a.x<a.w+b.x&&a.x+a.w>b.x&&a.y<a.h+b.y&&a.y+a.h>b.y;}
function pointRect(px,py,r){return px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h;}

new Game();
