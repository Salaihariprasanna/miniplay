/**
 * Chess Game Logic (Server)
 * Comprehensive, self-contained 2-player chess implementation.
 * Includes legal move validation, check prevention, checkmate & stalemate detection,
 * Castling (O-O and O-O-O), En Passant, and Pawn Promotion.
 */

// Initial board: 8x8. Lowercase = Black, Uppercase = White
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
    currentTurn: 0, // 0 = White, 1 = Black
    captured: {
      white: [], // Pieces captured by white
      black: []  // Pieces captured by black
    },
    movesCount: 0,
    winner: null, // null, 0 (White wins), 1 (Black wins), 'draw'
    isCheck: false,
    lastMove: null,
    enPassantTarget: null, // { r, c } square passed over by 2-step pawn
    hasMoved: {
      whiteKing: false,
      whiteRookK: false, // h1
      whiteRookQ: false, // a1
      blackKing: false,
      blackRookK: false, // h8
      blackRookQ: false  // a8
    }
  };
}

function isPieceColor(piece, playerIndex) {
  if (!piece) return false;
  return playerIndex === 0 ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
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

// Checks if square (r, c) is attacked by opponent of defenderIndex
function isSquareAttacked(board, r, c, defenderIndex) {
  const attackerIndex = 1 - defenderIndex;
  const pawnDir = attackerIndex === 0 ? -1 : 1; // Direction attacker pawns move

  // Attacked by pawn?
  for (const dc of [-1, 1]) {
    const pr = r - pawnDir;
    const pc = c + dc;
    if (pr >= 0 && pr <= 7 && pc >= 0 && pc <= 7) {
      const piece = board[pr][pc];
      if (piece && isPieceColor(piece, attackerIndex) && piece.toLowerCase() === 'p') {
        return true;
      }
    }
  }

  // Attacked by Knight?
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const piece = board[nr][nc];
      if (piece && isPieceColor(piece, attackerIndex) && piece.toLowerCase() === 'n') {
        return true;
      }
    }
  }

  // Attacked by straight lines (Rook / Queen)?
  const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of straightDirs) {
    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
      const piece = board[nr][nc];
      if (piece) {
        if (isPieceColor(piece, attackerIndex)) {
          const t = piece.toLowerCase();
          if (t === 'r' || t === 'q') return true;
        }
        break; // Blocked
      }
      step++;
    }
  }

  // Attacked by diagonal lines (Bishop / Queen)?
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
      const piece = board[nr][nc];
      if (piece) {
        if (isPieceColor(piece, attackerIndex)) {
          const t = piece.toLowerCase();
          if (t === 'b' || t === 'q') return true;
        }
        break; // Blocked
      }
      step++;
    }
  }

  // Attacked by King? (1 square)
  const kingDirs = [
    [-1, -1], [-1, 1], [1, -1], [1, 1],
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];
  for (const [dr, dc] of kingDirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const piece = board[nr][nc];
      if (piece && isPieceColor(piece, attackerIndex) && piece.toLowerCase() === 'k') {
        return true;
      }
    }
  }

  return false;
}

function isKingInCheck(board, playerIndex) {
  const king = findKing(board, playerIndex);
  if (!king) return false;
  return isSquareAttacked(board, king.r, king.c, playerIndex);
}

// Generate pseudo-legal moves for a piece at (r, c)
function getPseudoLegalMoves(board, r, c, playerIndex, enPassantTarget, hasMoved) {
  const piece = board[r][c];
  if (!piece || !isPieceColor(piece, playerIndex)) return [];

  const moves = [];
  const type = piece.toLowerCase();
  const dir = playerIndex === 0 ? -1 : 1; // White moves up (-1), Black moves down (+1)

  const addIfValid = (nr, nc) => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
    const dest = board[nr][nc];
    if (!dest) {
      moves.push({ r: nr, c: nc });
      return true; // continue sliding
    } else if (!isPieceColor(dest, playerIndex)) {
      moves.push({ r: nr, c: nc });
      return false; // capture, stop
    }
    return false; // blocked by friendly
  };

  if (type === 'p') {
    // 1 step forward
    const forwardR = r + dir;
    if (forwardR >= 0 && forwardR <= 7 && !board[forwardR][c]) {
      moves.push({ r: forwardR, c });
      // 2 steps forward from start rank
      const startRank = playerIndex === 0 ? 6 : 1;
      const doubleR = r + dir * 2;
      if (r === startRank && !board[doubleR][c]) {
        moves.push({ r: doubleR, c, isPawnDouble: true });
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
        // En Passant capture
        if (enPassantTarget && enPassantTarget.r === forwardR && enPassantTarget.c === nc) {
          moves.push({ r: forwardR, c: nc, isEnPassant: true });
        }
      }
    }
  } else if (type === 'n') {
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      addIfValid(r + dr, c + dc);
    }
  } else if (type === 'b') {
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'r') {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'q') {
    const dirs = [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    for (const [dr, dc] of dirs) {
      let step = 1;
      while (addIfValid(r + dr * step, c + dc * step)) step++;
    }
  } else if (type === 'k') {
    const dirs = [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    for (const [dr, dc] of dirs) {
      addIfValid(r + dr, c + dc);
    }

    // Castling
    if (hasMoved) {
      const kingMoved = playerIndex === 0 ? hasMoved.whiteKing : hasMoved.blackKing;
      const rookKMoved = playerIndex === 0 ? hasMoved.whiteRookK : hasMoved.blackRookK;
      const rookQMoved = playerIndex === 0 ? hasMoved.whiteRookQ : hasMoved.blackRookQ;
      const homeRank = playerIndex === 0 ? 7 : 0;

      if (!kingMoved && r === homeRank && c === 4 && !isKingInCheck(board, playerIndex)) {
        // Kingside O-O
        if (!rookKMoved && !board[homeRank][5] && !board[homeRank][6]) {
          if (!isSquareAttacked(board, homeRank, 5, playerIndex) && !isSquareAttacked(board, homeRank, 6, playerIndex)) {
            moves.push({ r: homeRank, c: 6, isCastling: 'kingside' });
          }
        }
        // Queenside O-O-O
        if (!rookQMoved && !board[homeRank][1] && !board[homeRank][2] && !board[homeRank][3]) {
          if (!isSquareAttacked(board, homeRank, 3, playerIndex) && !isSquareAttacked(board, homeRank, 2, playerIndex)) {
            moves.push({ r: homeRank, c: 2, isCastling: 'queenside' });
          }
        }
      }
    }
  }

  return moves;
}

// Truly legal moves (must not leave own King in check)
function getLegalMoves(board, r, c, playerIndex, enPassantTarget, hasMoved) {
  const pseudoMoves = getPseudoLegalMoves(board, r, c, playerIndex, enPassantTarget, hasMoved);
  const legalMoves = [];

  for (const move of pseudoMoves) {
    // Simulate move on cloned board
    const tempBoard = board.map(row => [...row]);
    const piece = tempBoard[r][c];

    if (move.isEnPassant) {
      const capturedPawnR = r; // Adjacent on same rank
      const capturedPawnC = move.c;
      tempBoard[capturedPawnR][capturedPawnC] = null;
    }

    tempBoard[move.r][move.c] = piece;
    tempBoard[r][c] = null;

    if (move.isCastling === 'kingside') {
      tempBoard[r][5] = tempBoard[r][7];
      tempBoard[r][7] = null;
    } else if (move.isCastling === 'queenside') {
      tempBoard[r][3] = tempBoard[r][0];
      tempBoard[r][0] = null;
    }

    // Is our King safe?
    if (!isKingInCheck(tempBoard, playerIndex)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}

// Check if playerIndex has any legal moves available
function hasAnyLegalMoves(board, playerIndex, enPassantTarget, hasMoved) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isPieceColor(board[r][c], playerIndex)) {
        const moves = getLegalMoves(board, r, c, playerIndex, enPassantTarget, hasMoved);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'get_valid_moves') {
    const { fromR, fromC } = action;
    const moves = getLegalMoves(gameState.board, fromR, fromC, playerIndex, gameState.enPassantTarget, gameState.hasMoved);
    return { valid: true, moves };
  }

  if (action.type === 'move') {
    const { fromR, fromC, toR, toC, promotionPiece } = action;

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

    const legalMoves = getLegalMoves(gameState.board, fromR, fromC, playerIndex, gameState.enPassantTarget, gameState.hasMoved);
    const chosenMove = legalMoves.find(m => m.r === toR && m.c === toC);
    if (!chosenMove) {
      return { valid: false, error: 'Illegal move' };
    }

    const targetPiece = gameState.board[toR][toC];
    const events = [{ type: 'piece_moved', from: { r: fromR, c: fromC }, to: { r: toR, c: toC }, piece }];

    // Handle En Passant capture
    if (chosenMove.isEnPassant) {
      const epCapturedPiece = gameState.board[fromR][toC];
      gameState.board[fromR][toC] = null;
      if (playerIndex === 0) gameState.captured.white.push(epCapturedPiece);
      else gameState.captured.black.push(epCapturedPiece);
      events.push({ type: 'piece_captured', piece: epCapturedPiece, capturedBy: playerIndex });
    } else if (targetPiece) {
      if (playerIndex === 0) gameState.captured.white.push(targetPiece);
      else gameState.captured.black.push(targetPiece);
      events.push({ type: 'piece_captured', piece: targetPiece, capturedBy: playerIndex });
    }

    // Handle Castling Rook movements
    if (chosenMove.isCastling === 'kingside') {
      gameState.board[fromR][5] = gameState.board[fromR][7];
      gameState.board[fromR][7] = null;
      events.push({ type: 'castled', side: 'kingside', playerIndex });
    } else if (chosenMove.isCastling === 'queenside') {
      gameState.board[fromR][3] = gameState.board[fromR][0];
      gameState.board[fromR][0] = null;
      events.push({ type: 'castled', side: 'queenside', playerIndex });
    }

    // Pawn Promotion
    let movedPiece = piece;
    if (piece.toLowerCase() === 'p') {
      if ((playerIndex === 0 && toR === 0) || (playerIndex === 1 && toR === 7)) {
        const choice = (promotionPiece || 'Q').toUpperCase();
        movedPiece = playerIndex === 0 ? choice : choice.toLowerCase();
        events.push({ type: 'pawn_promoted', to: { r: toR, c: toC }, promotedPiece: movedPiece });
      }
    }

    // Update board
    gameState.board[toR][toC] = movedPiece;
    gameState.board[fromR][fromC] = null;
    gameState.lastMove = { fromR, fromC, toR, toC };
    gameState.movesCount += 1;

    // Update hasMoved flags for castling
    if (piece === 'K') gameState.hasMoved.whiteKing = true;
    if (piece === 'k') gameState.hasMoved.blackKing = true;
    if (piece === 'R' && fromR === 7 && fromC === 7) gameState.hasMoved.whiteRookK = true;
    if (piece === 'R' && fromR === 7 && fromC === 0) gameState.hasMoved.whiteRookQ = true;
    if (piece === 'r' && fromR === 0 && fromC === 7) gameState.hasMoved.blackRookK = true;
    if (piece === 'r' && fromR === 0 && fromC === 0) gameState.hasMoved.blackRookQ = true;

    // Update En Passant target
    if (chosenMove.isPawnDouble) {
      gameState.enPassantTarget = { r: (fromR + toR) / 2, c: fromC };
    } else {
      gameState.enPassantTarget = null;
    }

    // Next turn
    gameState.currentTurn = 1 - gameState.currentTurn;

    // Check if next player's King is in check
    const inCheck = isKingInCheck(gameState.board, gameState.currentTurn);
    gameState.isCheck = inCheck;
    if (inCheck) {
      events.push({ type: 'check', playerIndex: gameState.currentTurn });
    }

    // Checkmate or Stalemate detection
    const canMove = hasAnyLegalMoves(gameState.board, gameState.currentTurn, gameState.enPassantTarget, gameState.hasMoved);
    if (!canMove) {
      if (inCheck) {
        // CHECKMATE!
        gameState.winner = playerIndex;
        events.push({ type: 'game_over', winner: playerIndex, reason: 'checkmate' });
      } else {
        // STALEMATE!
        gameState.winner = 'draw';
        events.push({ type: 'game_over', winner: 'draw', reason: 'stalemate' });
      }
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
  getLegalMoves,
  isKingInCheck
};
