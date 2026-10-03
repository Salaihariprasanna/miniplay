/**
 * Dots and Boxes Game Logic (Server)
 * Supports 2 to 4 players.
 */

const GRID_SIZE = 3; // 3x3 boxes, 4x4 dots

function initGameState(options = {}) {
  const playerCount = options.playerCount || 2;

  // Horizontal lines: (GRID_SIZE + 1) rows, GRID_SIZE cols -> 4 rows of 3
  const hLines = Array.from({ length: GRID_SIZE + 1 }, () => Array(GRID_SIZE).fill(null));

  // Vertical lines: GRID_SIZE rows, (GRID_SIZE + 1) cols -> 3 rows of 4
  const vLines = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE + 1).fill(null));

  // Boxes: GRID_SIZE rows, GRID_SIZE cols
  const boxes = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  return {
    size: GRID_SIZE,
    playerCount,
    hLines,
    vLines,
    boxes,
    currentTurn: 0,
    scores: Array(playerCount).fill(0),
    winner: null,
    totalBoxes: GRID_SIZE * GRID_SIZE,
    completedBoxes: 0
  };
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'draw_line') {
    const { dir, r, c } = action; // dir: 'H' or 'V'

    if (gameState.winner !== null) {
      return { valid: false, error: 'Game already finished' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn' };
    }

    if (dir === 'H') {
      if (r < 0 || r > gameState.size || c < 0 || c >= gameState.size) {
        return { valid: false, error: 'Invalid horizontal line' };
      }
      if (gameState.hLines[r][c] !== null) {
        return { valid: false, error: 'Line already drawn' };
      }
      gameState.hLines[r][c] = playerIndex;
    } else if (dir === 'V') {
      if (r < 0 || r >= gameState.size || c < 0 || c > gameState.size) {
        return { valid: false, error: 'Invalid vertical line' };
      }
      if (gameState.vLines[r][c] !== null) {
        return { valid: false, error: 'Line already drawn' };
      }
      gameState.vLines[r][c] = playerIndex;
    } else {
      return { valid: false, error: 'Invalid direction' };
    }

    // Check newly formed boxes
    let newlyCompleted = [];
    for (let br = 0; br < gameState.size; br++) {
      for (let bc = 0; bc < gameState.size; bc++) {
        if (gameState.boxes[br][bc] === null) {
          const top = gameState.hLines[br][bc] !== null;
          const bottom = gameState.hLines[br + 1][bc] !== null;
          const left = gameState.vLines[br][bc] !== null;
          const right = gameState.vLines[br][bc + 1] !== null;

          if (top && bottom && left && right) {
            gameState.boxes[br][bc] = playerIndex;
            gameState.scores[playerIndex] += 1;
            gameState.completedBoxes += 1;
            newlyCompleted.push({ r: br, c: bc });
          }
        }
      }
    }

    const events = [{ type: 'line_drawn', dir, r, c, playerIndex, completedBoxes: newlyCompleted }];

    if (newlyCompleted.length > 0) {
      // Completed at least one box: Keep turn!
      events.push({ type: 'boxes_captured', count: newlyCompleted.length, playerIndex });

      if (gameState.completedBoxes >= gameState.totalBoxes) {
        // Game complete!
        let maxScore = -1;
        let winners = [];
        gameState.scores.forEach((sc, pIdx) => {
          if (sc > maxScore) {
            maxScore = sc;
            winners = [pIdx];
          } else if (sc === maxScore) {
            winners.push(pIdx);
          }
        });
        gameState.winner = winners.length === 1 ? winners[0] : 'draw';
        events.push({ type: 'game_over', winner: gameState.winner, scores: gameState.scores });
      }
    } else {
      // No box completed: pass turn
      gameState.currentTurn = (gameState.currentTurn + 1) % gameState.playerCount;
      events.push({ type: 'turn_passed', nextTurn: gameState.currentTurn });
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    const newState = initGameState({ playerCount: gameState.playerCount });
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return gameState;
}

function resetGameState(gameState) {
  return initGameState({ playerCount: gameState.playerCount });
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
