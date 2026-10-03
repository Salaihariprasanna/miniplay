/**
 * Connect Four Game Logic (Server)
 */

const ROWS = 6;
const COLS = 7;

function initGameState() {
  return {
    rows: ROWS,
    cols: COLS,
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    currentTurn: 0, // 0 (Red), 1 (Yellow)
    winner: null, // null, 0, 1, or 'draw'
    winningCells: null, // array of [r, c]
    scores: [0, 0],
    round: 1
  };
}

function checkConnectFour(board) {
  // Horizontal check
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p !== null && p === board[r][c + 1] && p === board[r][c + 2] && p === board[r][c + 3]) {
        return { winner: p, cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }

  // Vertical check
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p !== null && p === board[r + 1][c] && p === board[r + 2][c] && p === board[r + 3][c]) {
        return { winner: p, cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }

  // Diagonal Down-Right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p !== null && p === board[r + 1][c + 1] && p === board[r + 2][c + 2] && p === board[r + 3][c + 3]) {
        return { winner: p, cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }

  // Diagonal Up-Right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p !== null && p === board[r - 1][c + 1] && p === board[r - 2][c + 2] && p === board[r - 3][c + 3]) {
        return { winner: p, cells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
      }
    }
  }

  // Check draw (top row full)
  let isFull = true;
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === null) {
      isFull = false;
      break;
    }
  }
  if (isFull) {
    return { winner: 'draw', cells: null };
  }

  return null;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'drop') {
    const { col } = action;

    if (gameState.winner !== null) {
      return { valid: false, error: 'Round is already over' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn' };
    }
    if (col < 0 || col >= COLS) {
      return { valid: false, error: 'Invalid column' };
    }
    if (gameState.board[0][col] !== null) {
      return { valid: false, error: 'Column is full' };
    }

    // Find the lowest unoccupied row
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (gameState.board[r][col] === null) {
        targetRow = r;
        break;
      }
    }

    gameState.board[targetRow][col] = playerIndex;
    const events = [{ type: 'token_dropped', row: targetRow, col, playerIndex }];

    const result = checkConnectFour(gameState.board);
    if (result) {
      if (result.winner === 'draw') {
        gameState.winner = 'draw';
        gameState.winningCells = null;
        events.push({ type: 'game_over', result: 'draw' });
      } else {
        gameState.winner = result.winner;
        gameState.winningCells = result.cells;
        gameState.scores[result.winner] += 1;
        events.push({ type: 'game_over', result: 'win', winner: result.winner, cells: result.cells });
      }
    } else {
      gameState.currentTurn = 1 - gameState.currentTurn;
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    gameState.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    gameState.winner = null;
    gameState.winningCells = null;
    gameState.round += 1;
    gameState.currentTurn = (gameState.round - 1) % 2;
    return { valid: true, stateChanged: true, events: [{ type: 'round_restart' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return gameState;
}

function resetGameState(gameState) {
  gameState.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  gameState.winner = null;
  gameState.winningCells = null;
  gameState.currentTurn = 0;
  return gameState;
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
