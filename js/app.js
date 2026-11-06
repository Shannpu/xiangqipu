/* 象棋杀棋练习 - 主逻辑 */
(function () {
  'use strict';

  var CATS = ['连将杀 1-4', '连将杀 5-7', '杀着大全'];
  var PUZZLES = null;          // { cat: [[fen, side], ...] }
  var curCat = 0;
  var curIdx = 0;              // 当前题目在该分类内的下标
  var board = null;
  var game = null;             // xiangqi.js 规则实例
  var thinking = false;
  var finished = false;
  var startPos = null;

  var $status = $('#status');
  var $spin = $('#spin');

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

  /* ---------- 引擎 ---------- */
  function engineMove(fen) {
    // xqwlight 接受 w/b 记号
    var pos = new Position();
    pos.fromFen(fen);
    var search = new Search(pos, 8);
    var mv = search.searchMain(5, 600);
    return mv > 0 ? move2Iccs(mv) : null;
  }

  /* ---------- 局面与流程 ---------- */
  function fenForRules() {
    // canju12 用 w/b 表示行棋方，xiangqi.js 用 r/b
    var puzzle = PUZZLES[CATS[curCat]][curIdx];
    var side = puzzle[1] === 'b' ? ' b ' : ' r ';
    return startPos + side + '- - 0 1';
  }

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
    if (!ok) console.error('[dbg] 题目 FEN 加载失败:', fenForRules());
    board.orientation('red');
    board.position(startPos, false);
    $status.text('轮到你走（红方）');
    $('#jumpNum').val(idx + 1);
  }

  function gameOver(win, reason) {
    finished = true;
    $spin.hide();
    if (win) {
      addSolved(CATS[curCat]);
      $('#ovTitle').text('🎉 解出！');
      $('#ovText').text(reason || '漂亮，将杀成功');
    } else {
      $('#ovTitle').text('未能解出');
      $('#ovText').text(reason || '没关系，换一题或重头再来');
    }
    $('#overlay').addClass('show');
  }

  function afterRedMove() {
    if (game.in_checkmate()) {
      gameOver(true, '黑方被将杀');
      return;
    }
    // 黑方是否还有棋可走（困毙判红胜）
    if (game.moves().length === 0) {
      gameOver(true, '黑方困毙');
      return;
    }
    // 引擎防守
    thinking = true;
    $status.text('黑方思考中…');
    $spin.show();
    setTimeout(function () {
      var iccs = engineMove(game.fen());
      $spin.hide();
      thinking = false;
      if (!iccs) {
        gameOver(true, '黑方无着可走');
        return;
      }
      var p = iccs.split('-');
      var m = game.move({ from: p[0].toLowerCase(), to: p[1].toLowerCase() });
      if (!m) { gameOver(false, '引擎走法异常'); return; }
      board.position(game.fen());
      $status.text('轮到你走（红方）');
      if (game.in_checkmate()) {
        gameOver(false, '你的将反而被将死了');
        return;
      }
      if (game.moves().length === 0) {
        gameOver(false, '红方被困毙');
        return;
      }
      $status.text(game.in_check() ? '红方被将军！轮到你走' : '轮到你走（红方）');
    }, 60);
  }

  /* ---------- 棋盘 ---------- */
  function initBoard() {
    var w = Math.min($('#boardWrap').width() || 360, 500);
    board = Xiangqiboard('board', {
      draggable: true,
      position: 'start',
      orientation: 'red',
      pieceTheme: 'lib/pieces/{piece}.svg',
      moveSpeed: 180, snapbackSpeed: 80, snapSpeed: 60,
      onDragStart: function (source, piece) {
        if (finished || thinking) return false;
        if (!piece || piece[0] !== 'r') return false;   // 只能拿红子
        if (game.turn() !== 'r') return false;
        return true;
      },
      onDrop: function (source, target) {
        if (source === target || target === 'offboard') return 'snapback';
        var mv = game.move({ from: source, to: target });
        if (!mv) return 'snapback';
        $status.text('…');
        afterRedMove();
      },
      onSnapEnd: function () { board.position(game.fen()); }
    });
    $(window).on('resize', function () {
      var nw = Math.min($('#boardWrap').width() || 360, 500);
      try { board.resize(); } catch (e) {}
    });
  }

  /* ---------- 分类栏 ---------- */
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
  $('#ovAgain').on('click', function () { loadPuzzle(curCat, curIdx); });
  $('#btnUndo').on('click', function () {
    if (finished || thinking) return;
    game.undo();                       // 撤黑方
    game.undo();                       // 撤红方
    board.position(game.fen());
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
