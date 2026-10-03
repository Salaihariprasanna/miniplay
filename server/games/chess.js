/**
 * Chess Game Logic (Server)
 * Lightweight, self-contained 2-player chess implementation with legal movement and capture validation.
 */

// Initial board: 8x8. Lowercase = black, Uppercase = white
const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

function initGameState() {
  return {
    board: INITIAL_BOARD.map(row => [...row]),
    currentTurn: 0, // 0 = White (uppercase), 1 = Black (lowercase)
    captured: {
      white: [], // Pieces captured by white (black pieces)
      black: []  // Pieces captured by black (white pieces)
    },
    movesCount: 0,
    winner: null, // null, 0 (White wins), 1 (Black wins), 'draw'
    isCheck: false,
    lastMove: null
  };
}

function isPieceColor(piece, playerIndex) {
  if (!piece) return false;
  return playerIndex === 0 ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
}

function getLegalMoves(board, r, c, playerIndex) {
  const piece = board[r][c];
  if (!piece || !isPieceColor(piece, playerIndex)) return [];

  const moves = [];
  const type = piece.toLowerCase();
  const dir = playerIndex === 0 ? -1 : 1; // White moves up (decreasing r), Black moves down

  // Helper
  const addIfValid = (nr, nc) => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
    const dest = board[nr][nc];
    if (!dest) {
      moves.push({ r: nr, c: nc });
      return true; // continue sliding
    } else if (!isPieceColor(dest, playerIndex)) {
      moves.push({ r: nr, c: nc });
      return false; // capture, stop sliding
    }
    return false; // friendly piece, stop
  };

  if (type === 'p') {
    // Pawn forward
    const forwardR = r + dir;
    if (forwardR >= 0 && forwardR <= 7 && !board[forwardR][c]) {
      moves.push({ r: forwardR, c });
      // Initial 2-step move
      const startRank = playerIndex === 0 ? 6 : 1;
      const doubleR = r + dir * 2;
      if (r === startRank && !board[doubleR][c]) {
        moves.push({ r: doubleR, c });
      }
    }
    // Diagonal captures
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (forwardR >= 0 && forwardR <= 7 && nc >= 0 && nc <= 7) {
        const dest = board[forwardR][nc];
        if (dest && !isPieceColor(dest, playerIndex)) {
          moves.push({ r: forwardR, c: nc });
        }
      }
    }
  } else if (type === 'n') {
    // Knight
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      addIfValid(r + dr, c + dc);
    }
  } else if (type === 'b') {
    // Bishop
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'r') {
    // Rook
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'q') {
    // Queen
    const dirs = [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'k') {
    // King (1 square)
    const dirs = [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    for (const [dr, dc] of dirs) {
      addIfValid(r + dr, c + dc);
    }
  }

  return moves;
}

function findKing(board, playerIndex) {
  const target = playerIndex === 0 ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === target) return { r, c };
    }
  }
  return null;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'get_valid_moves') {
    const { fromR, fromC } = action;
    const moves = getLegalMoves(gameState.board, fromR, fromC, playerIndex);
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
    if (!piece || !isPieceColor(piece, playerIndex)) {
      return { valid: false, error: 'Invalid piece selected' };
    }

    const legalMoves = getLegalMoves(gameState.board, fromR, fromC, playerIndex);
    const isLegal = legalMoves.some(m => m.r === toR && m.c === toC);
    if (!isLegal) {
      return { valid: false, error: 'Illegal move' };
    }

    const targetPiece = gameState.board[toR][toC];
    const events = [{ type: 'piece_moved', from: { r: fromR, c: fromC }, to: { r: toR, c: toC }, piece }];

    // Handle capture
    if (targetPiece) {
      if (playerIndex === 0) {
        gameState.captured.white.push(targetPiece);
      } else {
        gameState.captured.black.push(targetPiece);
      }
      events.push({ type: 'piece_captured', piece: targetPiece, capturedBy: playerIndex });

      // If King captured, instant win
      if (targetPiece.toLowerCase() === 'k') {
        gameState.winner = playerIndex;
        events.push({ type: 'game_over', winner: playerIndex, reason: 'king_captured' });
        gameState.board[toR][toC] = piece;
        gameState.board[fromR][fromC] = null;
        gameState.lastMove = { fromR, fromC, toR, toC };
        return { valid: true, stateChanged: true, events };
      }
    }

    // Pawn promotion to Queen on back rank
    let movedPiece = piece;
    if (piece.toLowerCase() === 'p') {
      if ((playerIndex === 0 && toR === 0) || (playerIndex === 1 && toR === 7)) {
        movedPiece = playerIndex === 0 ? 'Q' : 'q';
        events.push({ type: 'pawn_promoted', to: { r: toR, c: toC }, promotedPiece: movedPiece });
      }
    }

    gameState.board[toR][toC] = movedPiece;
    gameState.board[fromR][fromC] = null;
    gameState.lastMove = { fromR, fromC, toR, toC };
    gameState.movesCount += 1;

    // Next turn
    gameState.currentTurn = 1 - gameState.currentTurn;

    // Check if the other player still has their King
    const enemyKing = findKing(gameState.board, gameState.currentTurn);
    if (!enemyKing) {
      gameState.winner = playerIndex;
      events.push({ type: 'game_over', winner: playerIndex, reason: 'king_captured' });
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
  resetGameState,
  getLegalMoves
};
