/* 象棋杀棋练习 - 主逻辑 */
(function () {
  'use strict';

  var CATS = ['连将杀 1-4', '连将杀 5-7', '杀着大全'];
  var PUZZLES = null;
  var curCat = 0;
  var curIdx = 0;
  var board = null;
  var game = null;
  var thinking = false;
  var finished = false;
  var startPos = null;
  var lastWin = false;

  var $status = $('#status');

  /* ---------- 进度 ---------- */
  function getProgress() {
    try { return JSON.parse(localStorage.getItem('xqp_progress') || '{}'); }
    catch (e) { return {}; }
  }
  function addSolved(cat) {
    var p = getProgress();
    p[cat] = (p[cat] || 0) + 1;
    localStorage.setItem('xqp_progress', JSON.stringify(p));
    renderSolved();
  }
  function renderSolved() {
    var p = getProgress(), n = 0;
    CATS.forEach(function (c) { n += p[c] || 0; });
    $('#solvedCount').text(n);
  }

  /* ---------- FEN ---------- */
  function fenToPos(fen) {
    var pos = {};
    var rows = fen.split(' ')[0].split('/');   // 只取棋盘部分，去掉行棋方等后缀
    var FILES = 'abcdefghi';
    for (var r = 0; r < 10; r++) {
      var row = rows[r] || '9';
      var c = 0;
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '1' && ch <= '9') { c += parseInt(ch, 10); }
        else {
          var color = ch === ch.toUpperCase() ? 'r' : 'b';
          pos[FILES[c] + (9 - r)] = color + ch.toUpperCase();
          c++;
        }
      }
    }
    return pos;
  }

  function fenForRules() {
    var puzzle = PUZZLES[CATS[curCat]][curIdx];
    var side = puzzle[1] === 'b' ? ' b ' : ' r ';
    return startPos + side + '- - 0 1';
  }

  /* ---------- 引擎 ---------- */
  function engineMove(fen) {
    var pos = new Position();
    pos.fromFen(fen);
    var search = new Search(pos, 8);
    var mv = search.searchMain(5, 600);
    return mv > 0 ? move2Iccs(mv) : null;
  }

  /* ---------- 局面同步 ---------- */
  // 统一刷新棋盘 + 状态栏
  function syncBoard(opts) {
    opts = opts || {};
    var pos = fenToPos(game.fen());
    board.setPosition(pos);
    if (opts.lastMove !== false) {
      var hist = game.history({ verbose: true });
      var last = hist[hist.length - 1];
      board.setLastMove(last ? last.from : null, last ? last.to : null);
    }
    // 将军提示
    var checkedKing = null;
    if (game.in_check()) checkedKing = findKing(game.turn());
    board.setCheck(checkedKing);
  }

  function findKing(color) {
    var pos = fenToPos(game.fen());
    var want = color + 'K';
    for (var sq in pos) if (pos[sq] === want) return sq;
    return null;
  }

  /* ---------- 流程 ---------- */
  function loadPuzzle(cat, idx) {
    curCat = cat; curIdx = idx;
    var puzzle = PUZZLES[CATS[cat]][idx];
    startPos = puzzle[0];
    finished = false; thinking = false;
    $('#overlay').removeClass('show');
    $('#catTitle').text(CATS[cat]);
    $('#puzIdx').text('第 ' + (idx + 1) + ' / ' + PUZZLES[CATS[cat]].length + ' 题');
    game = new Xiangqi();
    var ok = game.load(fenForRules());
    if (!ok) console.error('题目 FEN 加载失败:', fenForRules());
    board.setSelected(null, []);
    syncBoard();
    $status.text('轮到你走（红方）');
    $('#jumpNum').val(idx + 1);
  }

  function gameOver(win, reason) {
    finished = true;
    thinking = false;
    lastWin = !!win;
    $status.text(win ? '解出！' : '未能解出');
    if (win) addSolved(CATS[curCat]);
    board.setSelected(null, []);
    // 先同步棋盘（保证弹窗前看得到最后局面），再弹窗
    syncBoard();
    $('#ovTitle').text(win ? '🎉 解出！' : '未能解出');
    $('#ovText').text(reason || '');
    $('#ovAgain').text(win ? '重做这题' : '再看看这局');
    $('#ovNext').text('下一题');
    $('#overlay').addClass('show');
  }

  // 红方走完：先渲染红方这一步，再让黑方思考
  function afterRedMove() {
    syncBoard();                              // ← 关键：立即显示红方刚走完的局面

    if (game.in_checkmate()) { gameOver(true, '黑方被将杀'); return; }
    if (game.moves().length === 0) { gameOver(true, '黑方困毙'); return; }

    thinking = true;
    $status.text('黑方思考中…');
    setTimeout(function () {
      var iccs = engineMove(game.fen());
      thinking = false;
      if (!iccs) { gameOver(true, '黑方无着可走'); return; }
      var p = iccs.split('-');
      var m = game.move({ from: p[0].toLowerCase(), to: p[1].toLowerCase() });
      if (!m) { gameOver(false, '引擎走法异常'); return; }

      syncBoard();                            // 黑方走完也立刻同步

      if (game.in_checkmate()) { gameOver(false, '你的帅被将死了'); return; }
      if (game.moves().length === 0) { gameOver(false, '红方被困毙'); return; }
      $status.text(game.in_check() ? '被将军了！轮到你走' : '轮到你走（红方）');
    }, 50);
  }

  /* ---------- 点击选子/走子 ---------- */
  var selected = null;

  function onClickSquare(sq) {
    if (finished || thinking) return;
    if (game.turn() !== 'r') return;

    var piece = game.get(sq);

    if (selected) {
      if (sq === selected) {                  // 取消选中
        selected = null;
        board.setSelected(null, []);
        $status.text('轮到你走（红方）');
        return;
      }
      // 点自己另一枚棋子：改选
      if (piece && piece.color === 'r') {
        selected = sq;
        var list = (game.moves({ square: sq, verbose: true }) || []).map(function (m) { return m.to; });
        board.setSelected(sq, list);
        $status.text(list.length ? '选择目标位置' : '这枚棋子无处可走');
        return;
      }
      // 走子
      var mv = game.move({ from: selected, to: sq });
      if (!mv) {
        $status.text('这步走不了');
        return;
      }
      selected = null;
      board.setSelected(null, []);
      afterRedMove();
      return;
    }

    if (!piece || piece.color !== 'r') return;
    selected = sq;
    var list2 = (game.moves({ square: sq, verbose: true }) || []).map(function (m) { return m.to; });
    board.setSelected(sq, list2);
    $status.text(list2.length ? '选择目标位置' : '这枚棋子无处可走');
  }

  /* ---------- 初始化 ---------- */
  function initBoard() {
    board = new XiangqiBoard('board', {});
    board.onClickSquare = onClickSquare;
    fitBoard();
    requestAnimationFrame(function () { fitBoard(); });   // 二次校准（首次测量含未定尺寸）
    setTimeout(function () { fitBoard(); }, 120);
    window.addEventListener('resize', fitBoard);
    window.addEventListener('orientationchange', function () { setTimeout(fitBoard, 200); });
  }

  // 棋盘按可用宽高取小，保证一屏放得下（实测收缩，不靠估算）
  function fitBoard() {
    var wrap = document.getElementById('boardWrap');
    var main = document.querySelector('.main');
    if (!wrap || !main || !board) return;
    var size = wrap.clientWidth || main.clientWidth || 320;
    // 先按高度估算一个初始值
    var others = 0, kids = main.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].id !== 'boardWrap') others += kids[i].offsetHeight || 0;
    }
    size = Math.min(size, Math.max((main.clientHeight - others - 30) / 1.13, 220), 520);
    // 再实测收缩：溢出多少就缩多少
    for (var k = 0; k < 4; k++) {
      wrap.style.maxWidth = size + 'px';
      board.resize(size);
      var delta = main.scrollHeight - main.clientHeight;
      if (delta <= 0) break;
      size = Math.max(size - delta - 4, 200);
    }
  }

  /* ---------- 分类 ---------- */
  function renderCats() {
    var $c = $('#cats').empty();
    CATS.forEach(function (c, i) {
      var $b = $('<button class="cat"></button>').text(c);
      if (i === curCat) $b.addClass('active');
      $b.on('click', function () { renderCats(); loadPuzzle(i, 0); });
      $c.append($b);
    });
  }

  /* ---------- 按钮 ---------- */
  $('#btnRetry').on('click', function () { loadPuzzle(curCat, curIdx); });
  $('#ovAgain').on('click', function () {
    // 失败时「再看看这局」：只关弹层，保留当前局面，方便复盘
    if (!lastWin) {
      $('#overlay').removeClass('show');
      finished = false;                    // 允许继续点着看/悔棋
      $status.text('可以复盘：悔棋或直接换下一题');
      return;
    }
    loadPuzzle(curCat, curIdx);
  });
  $('#btnUndo').on('click', function () {
    if (thinking) return;
    if (finished) { $('#overlay').removeClass('show'); finished = false; }
    game.undo();                       // 撤黑
    if (game.turn() !== 'r') game.undo();  // 再撤红（保证轮到红方）
    selected = null;
    board.setSelected(null, []);
    syncBoard();
    $status.text('轮到你走（红方）');
  });
  $('#btnNext').on('click', function () { loadPuzzle(curCat, (curIdx + 1) % PUZZLES[CATS[curCat]].length); });
  $('#ovNext').on('click', function () { loadPuzzle(curCat, (curIdx + 1) % PUZZLES[CATS[curCat]].length); });
  $('#btnPrev').on('click', function () {
    var n = PUZZLES[CATS[curCat]].length;
    loadPuzzle(curCat, (curIdx - 1 + n) % n);
  });
  $('#btnRandom').on('click', function () {
    var n = PUZZLES[CATS[curCat]].length;
    var r = Math.floor(Math.random() * n);
    if (n > 1 && r === curIdx) r = (r + 1) % n;
    loadPuzzle(curCat, r);
  });
  $('#btnJump').on('click', function () {
    var v = parseInt($('#jumpNum').val(), 10);
    var n = PUZZLES[CATS[curCat]].length;
    if (v >= 1 && v <= n) loadPuzzle(curCat, v - 1);
    else $status.text('题号需在 1 - ' + n + ' 之间');
  });

  /* ---------- 启动 ---------- */
  $.getJSON('puzzles/puzzles.json', function (data) {
    PUZZLES = data;
    renderCats();
    renderSolved();
    initBoard();
    loadPuzzle(0, 0);
  }).fail(function () {
    $('body').prepend('<div style="background:#c0392b;color:#fff;padding:10px 14px">题库加载失败，请检查 puzzles/puzzles.json</div>');
  });
})();
