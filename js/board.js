/* 自绘象棋棋盘 —— 纯 HTML/CSS 绝对定位，点击走子，无拖拽冲突 */
(function (global) {
  'use strict';

  var COLS = 9, ROWS = 10;
  var FILES = 'abcdefghi';

  // 棋子中文名
  var NAMES = {
    rK: '帥', rA: '仕', rB: '相', rN: '馬', rR: '車', rC: '炮', rP: '兵',
    bK: '將', bA: '士', bB: '象', bN: '馬', bR: '車', bC: '砲', bP: '卒'
  };

  function XiangqiBoard(el, opts) {
    opts = opts || {};
    this.el = typeof el === 'string' ? document.getElementById(el) : el;
    this.onMove = opts.onMove || function () {};
    this.canSelect = opts.canSelect || function () { return true; };
    this.position = {};          // { 'e5': 'rP' }
    this.selected = null;
    this.legal = [];             // 当前选中棋子的合法落点
    this.lastMove = null;        // { from, to } 高亮上一手
    this.checkSq = null;         // 被将军的将/帅所在格
    this.build();
  }

  XiangqiBoard.prototype.build = function () {
    var self = this;
    this.el.classList.add('xq-board-root');
    this.el.innerHTML = '';

    var inner = document.createElement('div');
    inner.className = 'xq-board-inner';
    this.inner = inner;

    // 木纹底 + 网格线（用 canvas 画最省事且清晰）
    var cv = document.createElement('canvas');
    cv.className = 'xq-canvas';
    inner.appendChild(cv);
    this.canvas = cv;

    // 棋子层
    var layer = document.createElement('div');
    layer.className = 'xq-pieces';
    inner.appendChild(layer);
    this.layer = layer;

    this.el.appendChild(inner);

    // 点击走子：整块棋盘一个监听，坐标反算格子（比逐格绑定可靠得多）
    inner.addEventListener('click', function (e) {
      var sq = self.squareAt(e.clientX, e.clientY);
      if (sq) self.clickSquare(sq);
    });

    this.resize();
    window.addEventListener('resize', function () { self.resize(); });
  };

  // 根据容器宽度计算尺寸，重绘
  XiangqiBoard.prototype.resize = function (size) {
    var w = size || this.el.clientWidth || 320;
    // 棋盘比例：9 列 8 格宽 + 边距，10 行 9 格高 + 边距
    var cell = Math.floor((w - 2 * 20) / 8);
    var boardW = cell * 8 + 40;
    var boardH = cell * 9 + 40;
    this.cell = cell;
    this.pad = 20;
    this.boardW = boardW;
    this.boardH = boardH;
    this.inner.style.width = boardW + 'px';
    this.inner.style.height = boardH + 'px';
    this.drawGrid();
    this.render();
  };

  XiangqiBoard.prototype.drawGrid = function () {
    var cv = this.canvas, cell = this.cell, pad = this.pad;
    var dpr = window.devicePixelRatio || 1;
    var W = this.boardW, H = this.boardH;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 底板（木色 + 细腻纹理）
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ecd0a1');
    g.addColorStop(0.5, '#e3c088');
    g.addColorStop(1, '#d9b477');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 木纹：随机的浅色细纹
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 1;
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 26; i++) {
      var wy = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.bezierCurveTo(W * 0.3, wy + (rnd() - 0.5) * 14, W * 0.7, wy + (rnd() - 0.5) * 14, W, wy + (rnd() - 0.5) * 8);
      ctx.stroke();
    }
    ctx.restore();
    // 四周暗角，增加质感
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(60,35,10,.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#5a4029';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    var x, y;
    // 横线：10 条
    for (var r = 0; r < ROWS; r++) {
      y = pad + r * cell;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + cell * 8, y);
      ctx.stroke();
    }
    // 竖线：9 条，中间 7 条在河界断开
    for (var c = 0; c < COLS; c++) {
      x = pad + c * cell;
      ctx.beginPath();
      if (c === 0 || c === COLS - 1) {
        ctx.moveTo(x, pad);
        ctx.lineTo(x, pad + cell * 9);
      } else {
        ctx.moveTo(x, pad);
        ctx.lineTo(x, pad + cell * 4);
        ctx.moveTo(x, pad + cell * 5);
        ctx.lineTo(x, pad + cell * 9);
      }
      ctx.stroke();
    }
    // 外框：粗外框 + 细内框（经典双线）
    ctx.lineWidth = 3;
    ctx.strokeRect(pad - 4, pad - 4, cell * 8 + 8, cell * 9 + 8);
    ctx.lineWidth = 2.2;
    ctx.strokeRect(pad, pad, cell * 8, cell * 9);

    // 九宫斜线：只有黑方（顶部 d-f 列）和红方（底部 d-f 列）两个宫
    ctx.lineWidth = 1.2;
    [[3, 0], [3, 7]].forEach(function (p) {
      var x0 = pad + p[0] * cell, y0 = pad + p[1] * cell;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + cell * 2, y0 + cell * 2);
      ctx.moveTo(x0 + cell * 2, y0);
      ctx.lineTo(x0, y0 + cell * 2);
      ctx.stroke();
    });

    // 炮/兵位的"十"字标记（标准画法：四个象限各一个直角折线）
    var marks = [
      [1, 2], [7, 2], [1, 7], [7, 7],          // 炮位
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],  // 兵位
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]   // 卒位
    ];
    var gap = cell * 0.08, len = cell * 0.16;
    ctx.lineWidth = 1.2;
    marks.forEach(function (m) {
      var cx = pad + m[0] * cell, cy = pad + m[1] * cell;
      var dirs = [];
      if (m[0] > 0) dirs.push([-1, -1], [-1, 1]);
      if (m[0] < 8) dirs.push([1, -1], [1, 1]);
      dirs.forEach(function (dir) {
        var vx = cx + dir[0] * gap, vy = cy + dir[1] * gap;
        ctx.beginPath();
        // 竖边 + 横边组成直角，开口朝向交点
        ctx.moveTo(vx, vy + dir[1] * len);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx + dir[0] * len, vy);
        ctx.stroke();
      });
    });

    // 楚河汉界：都按页面正常方向书写
    ctx.fillStyle = 'rgba(90,64,41,.78)';
    ctx.font = '600 ' + Math.round(cell * 0.46) + 'px "KaiTi","STKaiti","Songti SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var my = pad + cell * 4.5;
    ctx.fillText('楚  河', pad + cell * 1.9, my);
    ctx.fillText('漢  界', pad + cell * 6.1, my);
  };

  // 格子名 -> 像素中心
  XiangqiBoard.prototype.xy = function (sq) {
    var c = FILES.indexOf(sq[0]);
    var r = 9 - parseInt(sq[1], 10);        // rank 9 在顶部
    return { x: this.pad + c * this.cell, y: this.pad + r * this.cell };
  };

  // 像素 -> 格子名（超过半格容差视为空）
  XiangqiBoard.prototype.squareAt = function (px, py) {
    var rect = this.inner.getBoundingClientRect();
    var lx = px - rect.left - this.pad;
    var ly = py - rect.top - this.pad;
    var c = Math.round(lx / this.cell);
    var r = Math.round(ly / this.cell);
    if (c < 0 || c > 8 || r < 0 || r > 9) return null;
    // 容差：偏离超过 0.5 格才算没点中
    if (Math.abs(lx - c * this.cell) > this.cell * 0.55) return null;
    if (Math.abs(ly - r * this.cell) > this.cell * 0.55) return null;
    return FILES[c] + (9 - r);
  };

  // 渲染棋子层
  XiangqiBoard.prototype.render = function () {
    var self = this;
    var cell = this.cell;
    var size = Math.round(cell * 0.86);
    var layer = this.layer;
    layer.innerHTML = '';
    layer.style.width = this.boardW + 'px';
    layer.style.height = this.boardH + 'px';

    Object.keys(this.position).forEach(function (sq) {
      var piece = self.position[sq];
      var p = self.xy(sq);
      var d = document.createElement('div');
      d.className = 'xq-piece';
      d.style.width = size + 'px';
      d.style.height = size + 'px';
      d.style.left = (p.x - size / 2) + 'px';
      d.style.top = (p.y - size / 2) + 'px';
      d.style.backgroundImage = 'url("lib/pieces/' + piece + '.svg")';
      d.dataset.square = sq;
      if (sq === self.selected) d.classList.add('sel');
      layer.appendChild(d);
    });

    // 标记层
    var marks = this.marks || (this.marks = document.createElement('div'));
    if (!marks.parentNode) {
      marks.className = 'xq-marks';
      layer.appendChild(marks);
    }
    marks.innerHTML = '';
    marks.style.width = this.boardW + 'px';
    marks.style.height = this.boardH + 'px';

    // 上一手：起点小橙点，落点橙色圆环套住棋子（参考经典象棋 App 的走子提示）
    if (this.lastMove) {
      if (this.lastMove.from) {
        var fp = this.xy(this.lastMove.from), fr = cell * 0.115;
        var fd = document.createElement('div');
        fd.className = 'xq-last-from';
        fd.style.left = (fp.x - fr) + 'px';
        fd.style.top = (fp.y - fr) + 'px';
        fd.style.width = (fr * 2) + 'px';
        fd.style.height = (fr * 2) + 'px';
        marks.appendChild(fd);
      }
      if (this.lastMove.to) {
        var tp = this.xy(this.lastMove.to), tr = cell * 0.475;
        var td = document.createElement('div');
        td.className = 'xq-last-to';
        td.style.left = (tp.x - tr) + 'px';
        td.style.top = (tp.y - tr) + 'px';
        td.style.width = (tr * 2) + 'px';
        td.style.height = (tr * 2) + 'px';
        marks.appendChild(td);
      }
    }

    // 可落点
    this.legal.forEach(function (sq) {
      var p = self.xy(sq), r = cell * 0.16;
      var m = document.createElement('div');
      m.className = 'xq-dot';
      m.style.left = (p.x - r) + 'px';
      m.style.top = (p.y - r) + 'px';
      m.style.width = (r * 2) + 'px';
      m.style.height = (r * 2) + 'px';
      marks.appendChild(m);
    });

    // 将军提示
    if (this.checkSq) {
      var cp = this.xy(this.checkSq), cr = cell * 0.47;
      var c = document.createElement('div');
      c.className = 'xq-check';
      c.style.left = (cp.x - cr) + 'px';
      c.style.top = (cp.y - cr) + 'px';
      c.style.width = (cr * 2) + 'px';
      c.style.height = (cr * 2) + 'px';
      marks.appendChild(c);
    }

    // 选中格：金色框画在棋子层下面，这里用 CSS class 处理
  };

  XiangqiBoard.prototype.clickSquare = function (sq) {
    this.onClickSquare && this.onClickSquare(sq);
  };

  // 设置局面（fen 只取前半段或 position 对象）
  XiangqiBoard.prototype.setPosition = function (pos, animate) {
    this.position = pos || {};
    this.selected = null;
    this.legal = [];
    this.render();
  };

  XiangqiBoard.prototype.setSelected = function (sq, legal) {
    this.selected = sq;
    this.legal = legal || [];
    this.render();
  };

  XiangqiBoard.prototype.setLastMove = function (from, to) {
    this.lastMove = from ? { from: from, to: to } : null;
    this.render();
  };

  XiangqiBoard.prototype.setCheck = function (sq) {
    this.checkSq = sq || null;
    this.render();
  };

  global.XiangqiBoard = XiangqiBoard;
})(window);
