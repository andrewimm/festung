/* Festung.js - JS engine based upon the capabilities of Wolf3D */

var Festung = (function() {

var viewWidth = 320;
var viewHeight = 200;
var depth = 277;
var blockSize = 64;
var dA = Math.PI / 3 / 320;
var maxCast = 20;
var maxDist = maxCast * Math.sqrt(2);

var twoPi = Math.PI * 2;
var halfPi = Math.PI / 2;
var threeHalfPi = Math.PI * 3 / 2;

var F = function(canvas) {
  this.viewport = canvas;
  this.scale = 1;
  while (320 * this.scale < window.innerWidth && 200 * this.scale < window.innerHeight) {
    this.scale++;
  }
  this.scale--;

  this.viewport.width = viewWidth * this.scale;
  this.viewport.height = viewHeight * this.scale;

  this.cx = viewport.getContext('2d');
  this.cx.webkitImageSmoothingEnabled = false;
  this.cx.mozImageSmoothingEnabled = false;
  this.cx.imageSmoothingEnabled = false;

  this.lastTime = null;

  this.keyState = {};
  window.addEventListener('keydown', this.keyHandler.bind(this, true));
  window.addEventListener('keyup', this.keyHandler.bind(this, false));

  this.resources = {};
  this.textures = [ 'images/tex_brick.png', 'images/tex_woodpanel.png', 'images/tex_brick_banner.png' ];
  this.sprites = [ 'images/sprite_chest.png', 'images/sprite_box.png' ];

  this.loadLevel({
    map: [
      '00007700000000000000000000000000',
      '0000  0                     0  0',
      '00    0                     0  0',
      '00    000000000  000000000000  0',
      '0     0                        0',
      '0     0   000050050000  03333330',
      '0     0   05        50  2      1',
      '0  00000  0          0  2      1',
      '0      0  0          0  2      1',
      '0      0  0          0  2      1',
      '0      0  0  6    6  0  2      1',
      '0333 330  0          0  2      1',
      '1      8  0          0         1',
      '1      8  0  6    6  0         1',
      '1      8  0          0  2      1',
      '1      8  0          0  2      1',
      '1      8  0  6    6  0  04444440',
      '1      8  0          0    0    0',
      '1      8  0          0    0    0',
      '1      8  0          0    0    0',
      '044  440  0          0    000  0',
      '0                              0',
      '0                              0',
      '0 0       0          0         0',
      '0         0          0    005500',
      '0 0 0     0          0    0    0',
      '0         0          0    0    6',
      '0 0 0 0   0          0         6',
      '0         0  070070  0      X  0',
      '00000000000000000000000000007700',
    ],
    blocks: [
      [0,0,0,0],
      [1,1,1,1],
      [0,1,0,0],
      [0,0,1,0],
      [1,0,0,0],
      [0,0,2,0],
      [0,2,0,2],
      [2,0,2,0],
      [0,0,0,1],
    ],
    spriteMap: [
      {index: 0, x: 27.5, y: 25.5},
      {index: 0, x: 28.5, y: 25.5},
      {index: 0, x: 29.5, y: 25.5},
      {index: 0, x: 28, y: 26},
      {index: 0, x: 29, y: 26},
      {index: 1, x: 29, y: 17.5},
      {index: 1, x: 28.5, y: 17.5},
      {index: 1, x: 28, y: 17.5},
      {index: 1, x: 27.5, y: 17.5},
      {index: 1, x: 28, y: 18},
      {index: 1, x: 27.5, y: 18},
      {index: 0, x: 5, y: 1.5},
      {index: 1, x: 29, y: 8},
      {index: 1, x: 29, y: 10},
    ]
  });

  this.loadResources();
};

F.prototype = {
  start: function() {
    console.log('loaded.');
    requestAnimationFrame(this.render.bind(this));
  },

  loadResources: function() {
    var self = this;
    var waiting = this.textures.length + this.sprites.length;
    var register = function(name) {
      self.resources[name] = this;
      waiting--;
      if (waiting <= 0) {
        self.start();
      }
    };
    var i;
    for (i = 0; i < this.textures.length; i++) {
      var img = new Image();
      img.onload = register.bind(img, this.textures[i]);
      img.src = this.textures[i];
    }
    for (i = 0; i < this.sprites.length; i++) {
      var img = new Image();
      img.onload = register.bind(img, this.sprites[i]);
      img.src = this.sprites[i];
    }
  },

  loadLevel: function(level) {
    this.map = level.map;
    this.blocks = level.blocks;
    this.spriteMap = level.spriteMap;

    for (var i = 0; i < this.map.length; i++) {
      var index = this.map[i].indexOf('X');
      if (index > -1) {
        this.curX = index + 0.5;
        this.curY = i + 0.5;
        this.map[i] = this.map[i].replace('X', ' ');
      }
    }
    this.curA = halfPi;
  },

  castRay: function(v) {
    var scale = this.scale;

    // angle of column v
    var alpha = (dA * (160 - v) + this.curA) % twoPi;
    if (alpha < 0) {
      alpha += twoPi;
    }
    // The distance to the nearest wall
    var wallX = maxCast;
    var wallY = maxCast;
    var dist = maxDist;

    // The block containing the nearest wall
    // (so we know how to paint it)
    var blockX = -1;
    var blockY = -1;

    // alpha is positive and bounded on [0, 2PI)
    var yMax = maxCast * Math.sin(alpha);
    var xMax = maxCast * Math.cos(alpha);
    var m = Math.tan(alpha);

    // Check x-surface intersections
    var dY = alpha < Math.PI ? -1 : 1;
    var startY = ~~(this.curY);

    var y = dY;
    var x = (alpha < Math.PI ? this.curY - startY : this.curY - startY - 1) / m;
    var dX = (alpha < Math.PI ? 1 : -1) / m;

    var paintVert = false;

    var mX;
    for (; Math.abs(y) < maxCast && Math.abs(x) < maxCast; y += dY, x += dX) {
      if (startY + y >= this.map.length || startY + y < 0) {
        break;
      }
      mX = ~~(this.curX + x);
      if (mX < 0 || mX >= this.map[0].length) {
        break;
      }
      if (this.map[startY + y].charAt(mX) !== ' ') {
        blockY = startY + y;
        blockX = mX;
        wallX = x;
        wallY = y - (this.curY - startY);
        if (alpha < Math.PI) {
          wallY++;
        }
        dist = Math.sqrt(wallX * wallX + wallY * wallY);
        break;
      }
    }

    // Check y-surface intersections
    var startX = ~~this.curX;
    dX = dX >= 0 ? 1 : -1;
    x = dX;
    y = (dX >= 0 ? this.curX - startX - 1 : this.curX - startX) * m;
    dY = dX >= 0 ? -m : m;

    var mY;
    for (; Math.abs(y) < maxCast && Math.abs(x) < maxCast; x += dX, y += dY) {
      if (startX + x >= this.map[0].length || startX + x < 0) {
        break;
      }
      mY = ~~(this.curY + y);
      if (mY < 0 || mY >= this.map.length) {
        break;
      }
      if (this.map[mY].charAt(startX + x) !== ' ') {
        var xDist = x - (this.curX - startX);
        if (dX < 0) {
          xDist++;
        }
        var curDist = Math.sqrt(xDist * xDist + y * y);
        if (curDist < dist) {
          blockX = startX + x;
          blockY = mY;
          paintVert = true;
          wallX = xDist;
          wallY = y;
          dist = curDist;
        }
        break;
      }
    }

    // Convert dist from polar -> cartesian
    dist *= Math.cos(dA * (160 - v));
    var h = depth / dist;

    // Erase the top half of the screen
    this.cx.fillStyle = '#000000';
    this.cx.fillRect(v * scale, 0, scale, 100 * scale);

    if (blockX >= 0 && blockY >= 0 && dist < maxCast) {
      var tX = this.curX + wallX;
      tX -= ~~tX;
      var tY = this.curY + wallY;
      tY -= ~~tY;

      // Which block face to draw from
      var face = paintVert ?
        (wallX < 0 ? 1 : 3) :
        (alpha > Math.PI ? 0 : 2);
      var block = this.blocks[this.map[blockY].charAt(blockX)];
      if (!block) {
        return;
      }
      var tex = this.resources[this.textures[block[face]]];
      if (!tex) {
        return;
      }
      var texPos = ~~((paintVert ? tY : tX) * tex.naturalWidth);

      var top = 100 - h / 2;
      this.cx.drawImage(tex, texPos, 0, 1, tex.naturalHeight, v * scale, top * scale, scale, h * scale);
      this.cx.fillStyle = 'rgba(0,0,0,' + (dist / maxCast) + ')';
      this.cx.fillRect(v * scale, ~~(top * scale), scale, Math.ceil(h * scale));
    }

    return dist;
  },

  render: function() {
    if (!this.lastTime) {
      this.lastTime = new Date();
      requestAnimationFrame(this.render.bind(this));
      return;
    }
    var delta = new Date() - this.lastTime;
    this.lastTime = new Date();

    var speed = this.keyState.shift ? 1.5 : 1;

    if (this.keyState.left) {
      this.curA += speed * 0.001 * delta;
    } else if (this.keyState.right) {
      this.curA -= speed * 0.001 * delta;
    }

    var moved = false;
    var dX = 0;
    var dY = 0;
    var shift = 0.003 * delta * speed;
    if (this.keyState.w) {
      dX = shift * Math.cos(this.curA);
      dY = -shift * Math.sin(this.curA);
      moved = true;
    } else if (this.keyState.s) {
      dX = -shift * Math.cos(this.curA);
      dY = shift * Math.sin(this.curA);
      moved = true;
    }
    if (this.keyState.a) {
      dX = shift * Math.cos(this.curA + halfPi);
      dY = -shift * Math.sin(this.curA + halfPi);
      moved = true;
    } else if (this.keyState.d) {
      dX = shift * Math.cos(this.curA - halfPi);
      dY = -shift * Math.sin(this.curA - halfPi);
      moved = true;
    }
    if (moved) {
      if (this.map[~~(this.curY + dY)].charAt(~~(this.curX + dX)) !== ' ') {
        if (this.map[~~(this.curY + dY)].charAt(~~this.curX) === ' ') {
          dX = 0;
        } else if (this.map[~~this.curY].charAt(~~(this.curX + dX)) === ' ') {
          dY = 0;
        } else {
          dX = 0;
          dY = 0;
        }
      }
      this.curX += dX;
      this.curY += dY;
    }

    for (var r = 0; r < 100; r += 2) {
      var shade = ~~(r * 1.2);
      this.cx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
      this.cx.fillRect(0, (100 + r) * this.scale, viewWidth * this.scale, 2 * this.scale);
    }

    var zBuf = [];
    for (var c = 0; c < viewWidth; c++) {
      zBuf[c] = this.castRay(c);
    }

    if (moved) {
      this.spriteMap.sort(this.spriteComparator.bind(this));
    }

    for (var s = 0; s < this.spriteMap.length; s++) {
      this.renderSprite(this.spriteMap[s], zBuf);
    }

    requestAnimationFrame(this.render.bind(this));
  },

  renderSprite: function(sprite, zBuf) {
    var spriteX = sprite.x - this.curX;
    var spriteY = sprite.y - this.curY;

    var spriteA = Math.atan(-spriteY / spriteX);
    if (spriteX < 0) {
      spriteA += Math.PI;
    }

    var a = this.curA % twoPi;
    if (Math.abs(a - spriteA) > Math.PI) {
      if (a < spriteA) {
        a += twoPi;
      } else {
        spriteA += twoPi;
      }
    }

    var screenX = ~~((a - spriteA) / dA) + 160;
    // screenX can be absurdly huge, and cause everything to freeze up
    // we need to set some bounds on it early
    if (screenX < -50 || screenX > 370) {
      return;
    }

    var dist = Math.sqrt(spriteX * spriteX + spriteY * spriteY);
    dist *= Math.cos(dA * (160 - screenX));

    var h = depth / dist;
    if (h < 1) {
      return;
    }

    var tex = this.resources[this.sprites[sprite.index]];
    var texHeight = h / 64 * tex.naturalHeight;
    var texWidth = h / 64 * tex.naturalWidth;

    var strip = tex.naturalWidth / texWidth;

    for (var t = 0; t < texWidth; t++) {
      var horiz = screenX - texWidth / 2 + t;
      if (horiz < 0 || horiz > 320) {
        continue;
      }
      if (zBuf[~~horiz] > dist) {
        this.cx.drawImage(tex, t * strip, 0, strip, tex.naturalHeight, horiz * this.scale, (100 + h / 2 - texHeight) * this.scale, this.scale, texHeight * this.scale);
      }
    }
  },

  keyHandler: function(down, e) {
    switch (e.keyCode) {
      case 37: // left
        this.keyState.left = down;
        break;
      case 39: // right
        this.keyState.right = down;
        break;
      case 87: // W
        this.keyState.w = down;
        break;
      case 65: // A
        this.keyState.a = down;
        break;
      case 83: // S
        this.keyState.s = down;
        break;
      case 68: // D
        this.keyState.d = down;
        break;
    }
    this.keyState.shift = e.shiftKey;
  },

  spriteComparator: function(a, b) {
    var adx = (a.x - this.curX);
    var ady = (a.y - this.curY);
    var bdx = (b.x - this.curX);
    var bdy = (b.y - this.curY);
    return (bdx * bdx + bdy * bdy) - (adx * adx + ady * ady);
  },
};

return F;
})();