/**
 * Tic Tac Toe Game Logic (Server)
 */

function initGameState(options = {}) {
  return {
    board: Array(9).fill(null),
    currentTurn: 0, // 0 for Player 1 (X), 1 for Player 2 (O)
    symbols: ['X', 'O'],
    winner: null, // null, 0, 1, or 'draw'
    winningLine: null,
    scores: [0, 0],
    round: 1
  };
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winnerSymbol: board[a], winningLine: combo };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { winnerSymbol: 'draw', winningLine: null };
  }
  return null;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'move') {
    const { cellIndex } = action;

    if (gameState.winner !== null) {
      return { valid: false, error: 'Round is already over' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn' };
    }
    if (cellIndex < 0 || cellIndex > 8 || gameState.board[cellIndex] !== null) {
      return { valid: false, error: 'Cell is already occupied or invalid' };
    }

    const symbol = gameState.symbols[playerIndex];
    gameState.board[cellIndex] = symbol;

    const result = checkWinner(gameState.board);
    const events = [{ type: 'cell_marked', cellIndex, symbol, playerIndex }];

    if (result) {
      if (result.winnerSymbol === 'draw') {
        gameState.winner = 'draw';
        gameState.winningLine = null;
        events.push({ type: 'game_over', result: 'draw' });
      } else {
        gameState.winner = playerIndex;
        gameState.winningLine = result.winningLine;
        gameState.scores[playerIndex] += 1;
        events.push({ type: 'game_over', result: 'win', winner: playerIndex, winningLine: result.winningLine });
      }
    } else {
      gameState.currentTurn = 1 - gameState.currentTurn;
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    gameState.board = Array(9).fill(null);
    gameState.winner = null;
    gameState.winningLine = null;
    gameState.round += 1;
    // Alternate who starts each round
    gameState.currentTurn = (gameState.round - 1) % 2;
    return { valid: true, stateChanged: true, events: [{ type: 'round_restart' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return gameState;
}

function resetGameState(gameState) {
  gameState.board = Array(9).fill(null);
  gameState.winner = null;
  gameState.winningLine = null;
  gameState.currentTurn = 0;
  return gameState;
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
