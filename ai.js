// ai.js - Minimax AI with alpha-beta pruning for Connect 4
// Heuristic (from perspective of the maximizing token):
// - 4 in a row (token)     =>  +Infinity
// - 4 in a row (opponent)  =>  -Infinity
// - 3 token + 1 empty      =>  +120
// - 3 opp   + 1 empty      =>  -120
// - 2 token + 2 empty      =>  +15
// - 2 opp   + 2 empty      =>  -15
// - +3 per token piece in the center column

(function(global){
  'use strict';

  const ROWS = 6, COLS = 7;
  const EMPTY = 0;

  function inBounds(r, c){ return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function getValidMoves(board){
    const moves = [];
    for(let c=0;c<COLS;c++) if(board[0][c] === EMPTY) moves.push(c);
    return moves;
  }

  function applyMove(board, col, piece){
    for(let r = ROWS - 1; r >= 0; r--){
      if(board[r][col] === EMPTY){ board[r][col] = piece; return r; }
    }
    return -1;
  }

  function undoMove(board, col){
    for(let r = 0; r < ROWS; r++){
      if(board[r][col] !== EMPTY){ board[r][col] = EMPTY; return r; }
    }
    return -1;
  }

  function hasFour(board, piece){
    // Horizontal
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS-3;c++){
        if(board[r][c]===piece && board[r][c+1]===piece && board[r][c+2]===piece && board[r][c+3]===piece)
          return true;
      }
    }
    // Vertical
    for(let c=0;c<COLS;c++){
      for(let r=0;r<ROWS-3;r++){
        if(board[r][c]===piece && board[r+1][c]===piece && board[r+2][c]===piece && board[r+3][c]===piece)
          return true;
      }
    }
    // Diagonal down-right
    for(let r=0;r<ROWS-3;r++){
      for(let c=0;c<COLS-3;c++){
        if(board[r][c]===piece && board[r+1][c+1]===piece && board[r+2][c+2]===piece && board[r+3][c+3]===piece)
          return true;
      }
    }
    // Diagonal up-right
    for(let r=3;r<ROWS;r++){
      for(let c=0;c<COLS-3;c++){
        if(board[r][c]===piece && board[r-1][c+1]===piece && board[r-2][c+2]===piece && board[r-3][c+3]===piece)
          return true;
      }
    }
    return false;
  }

  function isTerminal(board){
    return hasFour(board, 1) || hasFour(board, 2) || getValidMoves(board).length === 0;
  }

  function scoreWindow(windowArr, token){
    const opp = token === 1 ? 2 : 1;
    const countToken = windowArr.filter(v => v === token).length;
    const countOpp = windowArr.filter(v => v === opp).length;
    const countEmpty = windowArr.filter(v => v === EMPTY).length;

    // Wins detected here as large magnitudes. Terminal detection will convert to infinities.
    if(countToken === 4) return 1000000; // symbolic big number
    if(countOpp === 4) return -1000000;

    let score = 0;
    if(countToken === 3 && countEmpty === 1) score += 120;
    if(countOpp === 3 && countEmpty === 1) score -= 120;
    if(countToken === 2 && countEmpty === 2) score += 15;
    if(countOpp === 2 && countEmpty === 2) score -= 15;
    return score;
  }

  function evaluateBoard(board, token){
    const opp = token === 1 ? 2 : 1;
    // Immediate terminal checks for infinity
    if(hasFour(board, token)) return Number.POSITIVE_INFINITY;
    if(hasFour(board, opp)) return Number.NEGATIVE_INFINITY;

    let score = 0;

    // Center column bonus: +3 per token piece in center col
    const centerCol = Math.floor(COLS/2);
    let centerCount = 0;
    for(let r=0;r<ROWS;r++) if(board[r][centerCol] === token) centerCount++;
    score += centerCount * 3;

    // Horizontal windows
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS-3;c++){
        const windowArr = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
        score += scoreWindow(windowArr, token);
      }
    }
    // Vertical windows
    for(let c=0;c<COLS;c++){
      for(let r=0;r<ROWS-3;r++){
        const windowArr = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
        score += scoreWindow(windowArr, token);
      }
    }
    // Diagonal down-right
    for(let r=0;r<ROWS-3;r++){
      for(let c=0;c<COLS-3;c++){
        const windowArr = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
        score += scoreWindow(windowArr, token);
      }
    }
    // Diagonal up-right
    for(let r=3;r<ROWS;r++){
      for(let c=0;c<COLS-3;c++){
        const windowArr = [board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]];
        score += scoreWindow(windowArr, token);
      }
    }
    return score;
  }

  function orderedMoves(board){
    const valid = getValidMoves(board);
    const center = 3;
    return valid.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
  }

  function minimax(board, depth, alpha, beta, maximizing, token, stats){
    stats.nodes++;
    stats.maxDepth = Math.max(stats.maxDepth, stats.initialDepth - depth);

    const opp = token === 1 ? 2 : 1;
    if(depth === 0 || isTerminal(board)){
      const evalScore = evaluateBoard(board, token);
      return { score: evalScore, column: null };
    }

    const moves = orderedMoves(board);
    if(maximizing){
      let value = -Infinity; let bestCol = moves[0] ?? 0;
      for(const col of moves){
        const r = applyMove(board, col, token);
        const result = minimax(board, depth - 1, alpha, beta, false, token, stats);
        undoMove(board, col);
        if(result.score > value){ value = result.score; bestCol = col; }
        alpha = Math.max(alpha, value);
        if(alpha >= beta) break; // prune
      }
      return { score: value, column: bestCol };
    } else {
      // Minimizing: opponent plays
      let value = Infinity; let bestCol = moves[0] ?? 0;
      for(const col of moves){
        const r = applyMove(board, col, opp);
        const result = minimax(board, depth - 1, alpha, beta, true, token, stats);
        undoMove(board, col);
        if(result.score < value){ value = result.score; bestCol = col; }
        beta = Math.min(beta, value);
        if(alpha >= beta) break; // prune
      }
      return { score: value, column: bestCol };
    }
  }

  function bestMove(board, depth, token){
    // Work on a clone for safety
    const b = C4Utils.cloneBoard(board);
    const stats = { nodes: 0, maxDepth: 0, initialDepth: depth };
    // If terminal or no moves, return null
    const valid = getValidMoves(b);
    if(valid.length === 0) return { column: null, score: 0, nodes: 0, depthReached: 0 };
    const { column, score } = minimax(b, depth, -Infinity, Infinity, true, token, stats);
    return { column, score, nodes: stats.nodes, depthReached: stats.maxDepth + 1 };
  }

  global.Connect4AI = { bestMove, evaluateBoard };
})(window);

