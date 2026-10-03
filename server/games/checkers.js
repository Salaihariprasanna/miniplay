/**
 * Checkers Game Logic (Server)
 * 8x8 Board. Player 0 = Red (bottom, moves up), Player 1 = Black (top, moves down).
 */

function initGameState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Set up Player 1 (Black, moves down) on rows 0, 1, 2
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { player: 1, isKing: false };
      }
    }
  }

  // Set up Player 0 (Red, moves up) on rows 5, 6, 7
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { player: 0, isKing: false };
      }
    }
  }

  return {
    board,
    currentTurn: 0,
    scores: [12, 12], // Remaining piece count
    winner: null,
    lastMove: null
  };
}

function getValidMoves(board, r, c, playerIndex) {
  const piece = board[r]?.[c];
  if (!piece || piece.player !== playerIndex) return [];

  const moves = [];
  const dirs = [];

  if (piece.isKing) {
    dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  } else if (playerIndex === 0) {
    // Moves up
    dirs.push([-1, -1], [-1, 1]);
  } else {
    // Moves down
    dirs.push([1, -1], [1, 1]);
  }

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;

    // Normal step
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
      moves.push({ r: nr, c: nc, isJump: false });
    }

    // Jump capture (can jump forward or backward for kings, or in valid direction)
    const jumpR = r + dr * 2;
    const jumpC = c + dc * 2;
    if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8) {
      const mid = board[nr][nc];
      if (mid && mid.player !== playerIndex && !board[jumpR][jumpC]) {
        moves.push({ r: jumpR, c: jumpC, isJump: true, captured: { r: nr, c: nc } });
      }
    }
  }

  return moves;
}

function countPieces(board) {
  let p0 = 0;
  let p1 = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.player === 0) p0++;
      if (board[r][c]?.player === 1) p1++;
    }
  }
  return [p0, p1];
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'get_valid_moves') {
    const { fromR, fromC } = action;
    const moves = getValidMoves(gameState.board, fromR, fromC, playerIndex);
    return { valid: true, moves };
  }

  if (action.type === 'move') {
    const { fromR, fromC, toR, toC } = action;

    if (gameState.winner !== null) {
      return { valid: false, error: 'Game is already over' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn' };
    }

    const piece = gameState.board[fromR]?.[fromC];
    if (!piece || piece.player !== playerIndex) {
      return { valid: false, error: 'Invalid piece selected' };
    }

    const legalMoves = getValidMoves(gameState.board, fromR, fromC, playerIndex);
    const move = legalMoves.find(m => m.r === toR && m.c === toC);
    if (!move) {
      return { valid: false, error: 'Illegal move' };
    }

    // Execute move
    let isKing = piece.isKing;
    // King promotion check
    if ((playerIndex === 0 && toR === 0) || (playerIndex === 1 && toR === 7)) {
      isKing = true;
    }

    gameState.board[toR][toC] = { player: playerIndex, isKing };
    gameState.board[fromR][fromC] = null;
    gameState.lastMove = { fromR, fromC, toR, toC };

    const events = [{ type: 'piece_moved', from: { r: fromR, c: fromC }, to: { r: toR, c: toC }, isKing }];

    if (move.isJump) {
      gameState.board[move.captured.r][move.captured.c] = null;
      events.push({ type: 'piece_captured', captured: move.captured });
    }

    const [count0, count1] = countPieces(gameState.board);
    gameState.scores = [count0, count1];

    if (count0 === 0) {
      gameState.winner = 1;
      events.push({ type: 'game_over', winner: 1 });
    } else if (count1 === 0) {
      gameState.winner = 0;
      events.push({ type: 'game_over', winner: 0 });
    } else {
      gameState.currentTurn = 1 - gameState.currentTurn;
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    const newState = initGameState();
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return gameState;
}

function resetGameState() {
  return initGameState();
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
