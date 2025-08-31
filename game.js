// game.js - Board state, rendering, interactions, win detection, animations
(function(){
  'use strict';

  const ROWS = 6, COLS = 7;
  const EMPTY = 0, PLAYER = 1, AI = 2;

  // DOM refs
  const boardEl = document.getElementById('board');
  const topGhostRowEl = document.getElementById('topGhostRow');
  const statusEl = document.getElementById('status');
  const newBtn = document.getElementById('newGameBtn');
  const undoBtn = document.getElementById('undoBtn');
  const hintBtn = document.getElementById('hintBtn');
  const aiFirstToggle = document.getElementById('aiFirstToggle');
  const difficultySelect = document.getElementById('difficulty');
  const overlayEl = document.getElementById('overlay');
  const overlayMsgEl = document.getElementById('overlayMessage');
  const overlayResetBtn = document.getElementById('overlayResetBtn');

  // State
  let board = createEmptyBoard();
  let history = []; // { player, col, row }
  let current = PLAYER;
  let aiFirst = false;
  let gameOver = false;
  let busy = false; // input lock during animations / AI thinking

  // Mobile detection to tweak UX
  const isMobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(isMobile) document.body.classList.add('is-mobile');

  // Cell element references [row][col]
  const cellEls = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  const columnEls = []; // per-column DOM for interactions

  // Build board and ghost row
  buildTopGhostRow();
  buildBoard();
  wireControls();
  updateStatus("Ready. Press 1–7 or click a column.");

  // Start new game initially
  newGame();

  function createEmptyBoard(){
    return Array.from({length: ROWS}, () => Array(COLS).fill(EMPTY));
  }

  function buildBoard(){
    boardEl.innerHTML = '';
    columnEls.length = 0;
    for(let c=0;c<COLS;c++){
      const colEl = document.createElement('div');
      colEl.className = 'column';
      colEl.dataset.col = String(c);
      for(let r=0;r<ROWS;r++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        colEl.appendChild(cell);
        cellEls[r][c] = cell;
      }
      boardEl.appendChild(colEl);
      columnEls.push(colEl);

      // Interactions
      colEl.addEventListener('mouseenter', () => showGhostForColumn(c));
      colEl.addEventListener('mouseleave', () => clearGhostAndTargets());
      colEl.addEventListener('click', () => handleColumnClick(c));
    }
    // On mobile, show ghost as finger moves
    boardEl.addEventListener('pointermove', onPointerMoveGhost, { passive: true });
    boardEl.addEventListener('pointerleave', () => clearGhostAndTargets());
  }

  function buildTopGhostRow(){
    topGhostRowEl.innerHTML = '';
    for(let c=0;c<COLS;c++){
      const slot = document.createElement('div');
      slot.className = 'ghost-slot';
      slot.dataset.col = String(c);
      topGhostRowEl.appendChild(slot);
    }
  }

  function wireControls(){
    newBtn.addEventListener('click', newGame);
    overlayResetBtn.addEventListener('click', newGame);
    undoBtn.addEventListener('click', undoPair);
    hintBtn.addEventListener('click', hint);
    aiFirstToggle.addEventListener('change', () => { /* takes effect on New Game */ });

    // Keyboard input: 1–7
    window.addEventListener('keydown', (e) => {
      if(busy || gameOver) return;
      const key = e.code || e.key;
      const map = {
        Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6,
        Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6
      };
      const col = map[key];
      if(col !== undefined){ handleColumnClick(col); }
    });
  }

  function updateStatus(text){
    statusEl.textContent = text;
  }

  async function newGame(){
    // Clear all state and UI
    board = createEmptyBoard();
    history = [];
    gameOver = false;
    busy = false;
    aiFirst = !!aiFirstToggle.checked;
    clearOverlay();
    boardEl.classList.remove('lose', 'draw');
    // Remove discs
    document.querySelectorAll('.disc').forEach(d => d.remove());
    clearGhostAndTargets();

    // Who starts
    current = aiFirst ? AI : PLAYER;
    setColumnsEnabled(current === PLAYER);

    if(current === AI){
      updateStatus('AI goes first…');
      await C4Utils.sleep(250);
      await aiTurn();
    } else {
      updateStatus('Your turn. Click or press 1–7.');
    }
  }

  function setColumnsEnabled(enabled){
    for(const colEl of columnEls){
      if(enabled) colEl.classList.remove('disabled');
      else colEl.classList.add('disabled');
    }
  }

  function getDropRow(col){
    for(let r=ROWS-1;r>=0;r--) if(board[r][col] === EMPTY) return r;
    return -1;
  }

  function showGhostForColumn(col){
    if(busy || gameOver || current !== PLAYER) return;
    const slot = topGhostRowEl.children[col];
    slot.innerHTML = '';
    const disc = document.createElement('div');
    disc.className = 'ghost-disc';
    disc.style.background = `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0) 55%), ${getColorGradient(PLAYER)}`;
    slot.appendChild(disc);
    // highlight target cell
    const row = getDropRow(col);
    clearTargets();
    if(row >= 0) cellEls[row][col].classList.add('target');
  }

  function clearGhostAndTargets(){
    for(const slot of topGhostRowEl.children) slot.innerHTML = '';
    clearTargets();
  }
  function onPointerMoveGhost(e){
    if(!isMobile) return;
    if(busy || gameOver || current !== PLAYER) return;
    if(e.pointerType === 'mouse') return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const colEl = el && el.closest ? el.closest('.column') : null;
    if(colEl){
      const c = parseInt(colEl.dataset.col, 10);
      if(!Number.isNaN(c)) showGhostForColumn(c);
    }
  }
  function clearTargets(){
    document.querySelectorAll('.cell.target').forEach(el => el.classList.remove('target'));
  }

  async function handleColumnClick(col){
    if(busy || gameOver) return;
    if(current !== PLAYER) return;
    await playerMove(col);
  }

  function getCellSize(){
    const anyCell = boardEl.querySelector('.cell');
    if(!anyCell) return 60; // fallback
    const rect = anyCell.getBoundingClientRect();
    return rect.height || rect.width || 60;
  }

  async function playerMove(col){
    const row = getDropRow(col);
    if(row < 0) {
      updateStatus('That column is full. Pick another.');
      return;
    }
    busy = true; setColumnsEnabled(false);
    placeDisc(row, col, PLAYER, true);
    history.push({ player: PLAYER, col, row });
    const result = checkGameEnd(PLAYER);
    if(result) { busy = false; return; }

    current = AI;
    await C4Utils.sleep(120);
    await aiTurn();
  }

  async function aiTurn(){
    busy = true; setColumnsEnabled(false);
    const depth = parseInt(difficultySelect.value, 10) || 5;
    updateStatus(`AI thinking… depth ${depth}`);
    await C4Utils.sleep(120);
    const res = Connect4AI.bestMove(board, depth, AI);
    let col = res.column;
    if(col == null){
      // fallback to any valid move
      const fallback = [];
      for(let c=0;c<COLS;c++) if(board[0][c]===EMPTY) fallback.push(c);
      col = fallback.length ? fallback[0] : null;
    }

    if(col == null){ // no moves => draw
      endWithDraw();
      busy = false; return;
    }

    const row = getDropRow(col);
    placeDisc(row, col, AI, true);
    history.push({ player: AI, col, row });
    updateStatus(`AI moved in column ${col+1}. Searched ~${res.nodes.toLocaleString()} nodes (depth ${depth}, reached ${res.depthReached}).`);

    const result = checkGameEnd(AI);
    if(result) { busy = false; return; }

    current = PLAYER;
    busy = false; setColumnsEnabled(true);
    updateStatus('Your turn. Click or press 1–7.');
  }

  function placeDisc(row, col, who, animate){
    board[row][col] = who;
    const cell = cellEls[row][col];
    const disc = document.createElement('div');
    disc.className = `disc ${who===PLAYER?'red':'blue'}`;
    if(animate){
      const cellSize = getCellSize();
      disc.style.setProperty('--drop-from', `${-(row+1)*cellSize - 12}px`);
      disc.classList.add('drop');
    }
    cell.appendChild(disc);
  }

  function removeDisc(row, col){
    const cell = cellEls[row][col];
    const disc = cell.querySelector('.disc:last-child');
    if(disc) disc.remove();
    board[row][col] = EMPTY;
  }

  function checkGameEnd(lastPlayer){
    const result = findWinner();
    if(result && result.winner === lastPlayer){
      // highlight winning line
      for(const {r, c} of result.line){
        const d = cellEls[r][c].querySelector('.disc:last-child');
        if(d) d.classList.add('win');
      }
      if(lastPlayer === PLAYER) endWithMessage('You win!');
      else { boardEl.classList.add('lose'); endWithMessage('AI wins!'); }
      return true;
    }
    if(isBoardFull()){
      endWithDraw();
      return true;
    }
    return false;
  }

  function endWithDraw(){
    boardEl.classList.add('draw');
    endWithMessage('Draw');
  }

  function endWithMessage(msg){
    gameOver = true; busy = false; setColumnsEnabled(false);
    overlayMsgEl.textContent = msg;
    overlayEl.classList.add('show');
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  function clearOverlay(){
    overlayEl.classList.remove('show');
    overlayEl.setAttribute('aria-hidden', 'true');
    overlayMsgEl.textContent = '';
  }

  function isBoardFull(){
    for(let c=0;c<COLS;c++) if(board[0][c] === EMPTY) return false;
    return true;
  }

  function findWinner(){
    // returns { winner, line:[{r,c}x4] } or null
    const dirs = [ [0,1], [1,0], [1,1], [-1,1] ];
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const p = board[r][c]; if(p===EMPTY) continue;
        for(const [dr, dc] of dirs){
          const line = [{r, c}];
          let ok = true;
          for(let k=1;k<4;k++){
            const rr = r + dr*k, cc = c + dc*k;
            if(rr<0 || rr>=ROWS || cc<0 || cc>=COLS || board[rr][cc] !== p){ ok = false; break; }
            line.push({r: rr, c: cc});
          }
          if(ok){ return { winner: p, line }; }
        }
      }
    }
    return null;
  }

  function getColorGradient(player){
    // glossy gradient fill for ghost
    const base = player === PLAYER ? 'var(--red)' : 'var(--blue)';
    return `radial-gradient(circle at 70% 70%, rgba(0,0,0,0.25), rgba(0,0,0,0) 60%), ${base}`;
  }

  async function hint(){
    if(busy || gameOver) return;
    // Best move for the Player from the player's perspective
    const depth = parseInt(difficultySelect.value, 10) || 5;
    const res = Connect4AI.bestMove(board, depth, PLAYER);
    if(res.column == null) return;
    const c = res.column;
    // Add hint class to column briefly and show ghost
    const colEl = columnEls[c];
    colEl.classList.add('hint');
    showGhostForColumn(c);
    await C4Utils.sleep(1200);
    colEl.classList.remove('hint');
    clearGhostAndTargets();
  }

  async function undoPair(){
    if(busy) return;
    if(history.length < 2) { updateStatus('Nothing to undo yet.'); return; }
    busy = true; setColumnsEnabled(false);
    clearOverlay();
    boardEl.classList.remove('lose', 'draw');
    gameOver = false;

    for(let i=0;i<2;i++){
      const mv = history.pop();
      if(!mv) break;
      removeDisc(mv.row, mv.col);
    }
    // Determine whose turn it is now by parity
    const movesMade = history.length;
    current = (aiFirst ? (movesMade % 2 === 0 ? AI : PLAYER) : (movesMade % 2 === 0 ? PLAYER : AI));
    if(current === PLAYER){
      updateStatus('Your turn. Click or press 1–7.');
      setColumnsEnabled(true);
      busy = false;
    } else {
      updateStatus('AI thinking…');
      await C4Utils.sleep(120);
      await aiTurn();
    }
  }
})();
