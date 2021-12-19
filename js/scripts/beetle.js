"use strict";
/* global util, vec2, squar */
/* global GameObject, PlayerObject */
/* global NET011, NET020 */

function BuzzyBeetleObject(game, level, zone, pos, oid, fly, variant) {
  GameObject.call(this, game, level, zone, pos);
  
  this.oid = oid; // Unique Object ID, is the shor2 of the spawn location
  
  this.variant = isNaN(parseInt(variant))?0:parseInt(variant);
  this.setState(BuzzyBeetleObject.STATE.RUN);
  
  /* Animation */
  this.anim = 0;
  
  /* Dead */
  this.bonkTimer = 0;
  
  /* Physics */
  this.dim = vec2.make(1., 1.);
  this.moveSpeed = 0;
  this.fallSpeed = 0;
  this.grounded = false;
  this.jump = -1;
  
  /* Var */
  this.disabled = false;
  this.disabledTimer = 0;
  this.proxHit = false;    // So we don't send an enable event every single frame while waiting for server response.
  
  this.immuneTimer = 0;
  
  /* Control */
  this.dir = true; /* false = right, true = left */
  
  this.disable();
}

BuzzyBeetleObject = BuzzyBeetleObject

/* === STATIC =============================================================== */
BuzzyBeetleObject.ASYNC = false;
BuzzyBeetleObject.ID = 0x12;
BuzzyBeetleObject.NAME = "BUZZY BEETLE"; // Used by editor

BuzzyBeetleObject.ANIMATION_RATE = 3;
BuzzyBeetleObject.VARIANT_OFFSET = 0x20; //2 rows down in the sprite sheet

BuzzyBeetleObject.ENABLE_FADE_TIME = 15;
BuzzyBeetleObject.ENABLE_DIST = 26;          // Distance to player needed for proximity to trigger and the enemy to be enabled

BuzzyBeetleObject.BONK_TIME = 90;
BuzzyBeetleObject.BONK_IMP = vec2.make(0.25, 0.4);
BuzzyBeetleObject.BONK_DECEL = 0.925;
BuzzyBeetleObject.BONK_FALL_SPEED = 0.5;

BuzzyBeetleObject.PLAYER_IMMUNE_TIME = 6;  // Player is immune to damage for this many frames after bouncing off or kicking this enemy

BuzzyBeetleObject.MOVE_SPEED_MAX = 0.075;
BuzzyBeetleObject.SHELL_MOVE_SPEED_MAX = 0.35;

BuzzyBeetleObject.FALL_SPEED_MAX = 0.35;
BuzzyBeetleObject.FALL_SPEED_ACCEL = 0.085;

BuzzyBeetleObject.JUMP_LENGTH_MAX = 20;
BuzzyBeetleObject.JUMP_DECEL = 0.025;

BuzzyBeetleObject.TRANSFORM_TIME = 175;
BuzzyBeetleObject.TRANSFORM_THRESHOLD = 75;

BuzzyBeetleObject.SPRITE = {};
BuzzyBeetleObject.SPRITE_LIST = [
  {NAME: "RUN0", ID: 0x02, INDEX: [[0x0066],[0x0056]]},
  {NAME: "RUN1", ID: 0x03, INDEX: [[0x0067],[0x0057]]},
  {NAME: "TRANSFORM", ID: 0x04, INDEX: 0x0051},
  {NAME: "SHELL", ID: 0x05, INDEX: 0x0050}
];

/* Makes sprites easily referenceable by NAME. For sanity. */
for(var i=0;i<BuzzyBeetleObject.SPRITE_LIST.length;i++) {
  BuzzyBeetleObject.SPRITE[BuzzyBeetleObject.SPRITE_LIST[i].NAME] = BuzzyBeetleObject.SPRITE_LIST[i];
  BuzzyBeetleObject.SPRITE[BuzzyBeetleObject.SPRITE_LIST[i].ID] = BuzzyBeetleObject.SPRITE_LIST[i];
}

BuzzyBeetleObject.STATE = {};
BuzzyBeetleObject.STATE_LIST = [
  {NAME: "RUN", ID: 0x01, SPRITE: [BuzzyBeetleObject.SPRITE.RUN0,BuzzyBeetleObject.SPRITE.RUN1]},
  {NAME: "TRANSFORM", ID: 0x02, SPRITE: [BuzzyBeetleObject.SPRITE.SHELL,BuzzyBeetleObject.SPRITE.TRANSFORM]},
  {NAME: "SHELL", ID: 0x03, SPRITE: [BuzzyBeetleObject.SPRITE.SHELL]},
  {NAME: "SPIN", ID: 0x04, SPRITE: [BuzzyBeetleObject.SPRITE.SHELL]},
  {NAME: "BONK", ID: 0x51, SPRITE: []}
];

/* Makes states easily referenceable by either ID or NAME. For sanity. */
for(var i=0;i<BuzzyBeetleObject.STATE_LIST.length;i++) {
  BuzzyBeetleObject.STATE[BuzzyBeetleObject.STATE_LIST[i].NAME] = BuzzyBeetleObject.STATE_LIST[i];
  BuzzyBeetleObject.STATE[BuzzyBeetleObject.STATE_LIST[i].ID] = BuzzyBeetleObject.STATE_LIST[i];
}


/* === INSTANCE ============================================================= */

BuzzyBeetleObject.prototype.update = function(event) {
  /* Event trigger */
  switch(event) {
    case 0x01 : { this.bonk(); break; }
    case 0x10 : { this.stomped(true); break; }
    case 0x11 : { this.stomped(false); break; }
    case 0xA0 : { this.enable(); break; }
  }
};

BuzzyBeetleObject.prototype.step = function() {
  /* Disabled */
  if(this.disabled) { this.proximity(); return; }
  else if(this.disabledTimer > 0) { this.disabledTimer--; }
  
  /* Bonked */
  if(this.state === BuzzyBeetleObject.STATE.BONK) {
    if(this.bonkTimer++ > BuzzyBeetleObject.BONK_TIME || this.pos.y+this.dim.y < 0) { this.destroy(); return; }
    
    this.pos = vec2.add(this.pos, vec2.make(this.moveSpeed, this.fallSpeed));
    this.moveSpeed *= BuzzyBeetleObject.BONK_DECEL;
    this.fallSpeed = Math.max(this.fallSpeed - BuzzyBeetleObject.FALL_SPEED_ACCEL, -BuzzyBeetleObject.BONK_FALL_SPEED);
    return;
  }
  
  /* Anim */
  this.anim++;
  this.sprite = this.state.SPRITE[parseInt(this.anim/BuzzyBeetleObject.ANIMATION_RATE) % this.state.SPRITE.length];
  
  if(this.state === BuzzyBeetleObject.STATE.SHELL || this.state === BuzzyBeetleObject.STATE.TRANSFORM) {
    if(--this.transformTimer < BuzzyBeetleObject.TRANSFORM_THRESHOLD) { this.setState(BuzzyBeetleObject.STATE.TRANSFORM); }
    if(this.transformTimer <= 0) { this.setState(BuzzyBeetleObject.STATE.RUN); }
  }
  
  /* Normal Gameplay */
  if(this.immuneTimer > 0) { this.immuneTimer--; }
  
  this.control();
  this.physics();
  this.interaction();
  this.sound();
  
  if(this.pos.y < 0.) { this.destroy(); }
};

BuzzyBeetleObject.prototype.control = function() {
  if(this.state === BuzzyBeetleObject.STATE.FLY) {
    this.moveSpeed = this.dir ? -BuzzyBeetleObject.MOVE_SPEED_MAX : BuzzyBeetleObject.MOVE_SPEED_MAX;
    if(this.grounded) { this.jump = 0; }
  }
  else if(this.state === BuzzyBeetleObject.STATE.RUN) { this.moveSpeed = this.dir ? -BuzzyBeetleObject.MOVE_SPEED_MAX : BuzzyBeetleObject.MOVE_SPEED_MAX; }
  else if(this.state === BuzzyBeetleObject.STATE.SPIN) { this.moveSpeed = this.dir ? -BuzzyBeetleObject.SHELL_MOVE_SPEED_MAX : BuzzyBeetleObject.SHELL_MOVE_SPEED_MAX; }
  else if(this.state === BuzzyBeetleObject.STATE.SHELL || this.state === BuzzyBeetleObject.STATE.TRANSFORM) { this.moveSpeed = 0; }
  
  if(this.jump > BuzzyBeetleObject.JUMP_LENGTH_MAX) { this.jump = -1; }
};

BuzzyBeetleObject.prototype.physics = function() {
  if(this.jump !== -1) {
    this.fallSpeed = BuzzyBeetleObject.FALL_SPEED_MAX - (this.jump*BuzzyBeetleObject.JUMP_DECEL);
    this.jump++;
    this.grounded = false;
  }
  else {
    if(this.grounded) { this.fallSpeed = 0; }
    this.fallSpeed = Math.max(this.fallSpeed - BuzzyBeetleObject.FALL_SPEED_ACCEL, -BuzzyBeetleObject.FALL_SPEED_MAX);
  }
  
  if(this.grounded) {
    this.fallSpeed = 0;
  }
  this.fallSpeed = Math.max(this.fallSpeed - BuzzyBeetleObject.FALL_SPEED_ACCEL, -BuzzyBeetleObject.FALL_SPEED_MAX);
  
  var movx = vec2.add(this.pos, vec2.make(this.moveSpeed, 0.));
  var movy = vec2.add(this.pos, vec2.make(this.moveSpeed, this.fallSpeed));
  
  var ext1 = vec2.make(this.moveSpeed>=0?this.pos.x:this.pos.x+this.moveSpeed, this.fallSpeed<=0?this.pos.y:this.pos.y+this.fallSpeed);
  var ext2 = vec2.make(this.dim.y+Math.abs(this.moveSpeed), this.dim.y+Math.abs(this.fallSpeed));
  var tiles = this.game.world.getZone(this.level, this.zone).getTiles(ext1, ext2);
  var tdim = vec2.make(1., 1.);
  
  var changeDir = false;
  this.grounded = false;
  for(var i=0;i<tiles.length;i++) {
    var tile = tiles[i];
    if(!tile.definition.COLLIDE) { continue; }
    
    var hitx = squar.intersection(tile.pos, tdim, movx, this.dim);
    
    if(hitx) {
      if(this.pos.x + this.dim.x <= tile.pos.x && movx.x + this.dim.x > tile.pos.x) {
        movx.x = tile.pos.x - this.dim.x;
        movy.x = movx.x;
        this.moveSpeed = 0;
        changeDir = true;
      }
      else if(this.pos.x >= tile.pos.x + tdim.x && movx.x < tile.pos.x + tdim.x) {
        movx.x = tile.pos.x + tdim.x;
        movy.x = movx.x;
        this.moveSpeed = 0;
        changeDir = true;
      }
    }
  }
    
  for(var i=0;i<tiles.length;i++) {
    var tile = tiles[i];
    if(!tile.definition.COLLIDE) { continue; }
    
    var hity = squar.intersection(tile.pos, tdim, movy, this.dim);
    
    if(hity) {
      if(this.pos.y >= tile.pos.y + tdim.y && movy.y < tile.pos.y + tdim.y) {
        movy.y = tile.pos.y + tdim.y;
        this.grounded = true;
      }
      else if(this.pos.y + this.dim.y <= tile.pos.y && movy.y + this.dim.y > tile.pos.y) {
        movy.y = tile.pos.y - this.dim.y;
        this.jump = -1;
        this.fallSpeed = 0;
      }
    }
  }
  this.pos = vec2.make(movx.x, movy.y);
  if(changeDir) { this.dir = !this.dir; }
};

BuzzyBeetleObject.prototype.interaction = function() {
  if(this.state !== BuzzyBeetleObject.STATE.SPIN) { return; }
  for(var i=0;i<this.game.objects.length;i++) {
    var obj = this.game.objects[i];
    if(obj === this || obj instanceof PlayerObject || !obj.isTangible() || !obj.damage) { continue; }  // Skip players and objects that lack a damage function to call
    if(obj.level === this.level && obj.zone === this.zone) {
      var hit = squar.intersection(obj.pos, obj.dim, this.pos, this.dim);
      if(hit) { obj.damage(this); }  // We don't sync this event since it's not a direct player interaction. It *should* synchronize naturally though.
    }
  }
};

/* Tests against client player to see if they are near enough that we should enable this enemy. */
/* On a successful test we send a object event 0xA0 to the server to trigger this enemy being enabled for all players */
BuzzyBeetleObject.prototype.proximity = function() {
  var ply = this.game.getPlayer();
  if(ply && !ply.dead && ply.level === this.level && ply.zone === this.zone && !this.proxHit && vec2.distance(ply.pos, this.pos) < BuzzyBeetleObject.ENABLE_DIST) {
    this.game.out.push(NET020.encode(this.level, this.zone, this.oid, 0xA0));
    this.proxHit = true;
  }
};

BuzzyBeetleObject.prototype.sound = GameObject.prototype.sound;

BuzzyBeetleObject.prototype.enable = function() {
  if(!this.disabled) { return; }
  this.disabled = false;
  this.disabledTimer = BuzzyBeetleObject.ENABLE_FADE_TIME;
};

BuzzyBeetleObject.prototype.disable = function() {
  this.disabled = true;
};

BuzzyBeetleObject.prototype.damage = function(p) { if(!this.dead) { this.bonk(); this.game.out.push(NET020.encode(this.level, this.zone, this.oid, 0x01)); } };

/* 'Bonked' is the type of death where an enemy flips upside down and falls off screen */
/* Generally triggred by shells, fireballs, etc */
BuzzyBeetleObject.prototype.bonk = function() {
  if(this.dead) { return; }
  this.setState(BuzzyBeetleObject.STATE.BONK);
  this.moveSpeed = BuzzyBeetleObject.BONK_IMP.x;
  this.fallSpeed = BuzzyBeetleObject.BONK_IMP.y;
  this.dead = true;
  this.play("sfx/kick.wav", 1., .04);
};

/* dir (true = left, false = right) */
BuzzyBeetleObject.prototype.stomped = function(dir) {
  if(this.state === BuzzyBeetleObject.STATE.FLY) { this.setState(BuzzyBeetleObject.STATE.RUN); this.jump = -1; }
  else if(this.state === BuzzyBeetleObject.STATE.RUN) { this.setState(BuzzyBeetleObject.STATE.SHELL); this.transformTimer = BuzzyBeetleObject.TRANSFORM_TIME; }
  else if(this.state === BuzzyBeetleObject.STATE.SPIN) { this.setState(BuzzyBeetleObject.STATE.SHELL); this.transformTimer = BuzzyBeetleObject.TRANSFORM_TIME; }
  else if(this.state === BuzzyBeetleObject.STATE.SHELL || this.state === BuzzyBeetleObject.STATE.TRANSFORM) {
    this.setState(BuzzyBeetleObject.STATE.SPIN);
    this.dir = dir;
  }
  this.play("sfx/stomp.wav", 1., .04);
};

BuzzyBeetleObject.prototype.playerCollide = function(p) {
  if(this.dead || this.garbage) { return; }
  if(this.state === BuzzyBeetleObject.STATE.SHELL || this.state === BuzzyBeetleObject.STATE.TRANSFORM) {
    var dir = p.pos.x-this.pos.x > 0;
    this.stomped(dir);
    this.game.out.push(NET020.encode(this.level, this.zone, this.oid, dir?0x10:0x11));
    this.immuneTimer = BuzzyBeetleObject.PLAYER_IMMUNE_TIME;
  }
  else if(this.immuneTimer <= 0) { p.damage(this); }
};

BuzzyBeetleObject.prototype.playerStomp = function(p) {
  if(this.dead || this.garbage) { return; }
  var dir = p.pos.x-this.pos.x > 0;
  p.bounce();
  this.stomped(dir);
  this.immuneTimer = BuzzyBeetleObject.PLAYER_IMMUNE_TIME;
  this.game.out.push(NET020.encode(this.level, this.zone, this.oid, dir?0x10:0x11));
};

BuzzyBeetleObject.prototype.playerBump = function(p) {
  if(this.dead || this.garbage) { return; }
  p.damage(this);
};

BuzzyBeetleObject.prototype.kill = function() { };
BuzzyBeetleObject.prototype.destroy = GameObject.prototype.destroy;
BuzzyBeetleObject.prototype.isTangible = GameObject.prototype.isTangible;

BuzzyBeetleObject.prototype.setState = function(STATE) {
  if(STATE === this.state) { return; }
  this.state = STATE;
  if(STATE.SPRITE.length > 0) { this.sprite = STATE.SPRITE[0]; }
  this.anim = 0;
};

BuzzyBeetleObject.prototype.draw = function(sprites) {
  /* Disabled */
  if(this.disabled) { return; }
  
  var mod;
  if(this.state === BuzzyBeetleObject.STATE.BONK) { mod = 0x03; }
  else if(this.disabledTimer > 0) { mod = 0xA0 + parseInt((1.-(this.disabledTimer/BuzzyBeetleObject.ENABLE_FADE_TIME))*32.); }
  else { mod = 0x00; }
  
  if(this.sprite.INDEX instanceof Array) {
    var s = this.sprite.INDEX;
    for(var i=0;i<s.length;i++) {
      for(var j=0;j<s[i].length;j++) {
        var sp = s[mod!==0x03?i:(s.length-1-i)][j];
        switch(this.variant) {
          case 1 : { sp += BuzzyBeetleObject.VARIANT_OFFSET; break; }
          default : { break; }
        }
        sprites.push({pos: vec2.add(this.pos, vec2.make(j,i)), reverse: !this.dir, index: sp, mode: mod});
      }
    }
  }
  else {
    var sp = this.sprite.INDEX;
    switch(this.variant) {
      case 1 : { sp += BuzzyBeetleObject.VARIANT_OFFSET; break; }
      default : { break; }
    }
    sprites.push({pos: this.pos, reverse: !this.dir, index: sp, mode: mod});
  }
};

BuzzyBeetleObject.prototype.play = GameObject.prototype.play;

/* Register object class */
GameObject.REGISTER_OBJECT(BuzzyBeetleObject);