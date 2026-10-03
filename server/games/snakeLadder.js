/**
 * Snake & Ladder Game Logic (Server)
 * Supports 2 to 4 players.
 */

const LADDERS = {
  4: 14,
  8: 30,
  21: 42,
  28: 76,
  36: 57,
  50: 67,
  71: 92,
  80: 99
};

const SNAKES = {
  98: 78,
  95: 56,
  92: 73,
  83: 19,
  73: 15,
  69: 33,
  64: 60,
  59: 17,
  52: 11,
  48: 26,
  44: 22
};

function initGameState(options = {}) {
  const playerCount = options.playerCount || 2;
  return {
    playerCount,
    positions: Array(playerCount).fill(1), // All start at tile 1
    currentTurn: 0,
    lastDice: null,
    consecutiveSixes: 0,
    winner: null,
    snakes: SNAKES,
    ladders: LADDERS,
    round: 1
  };
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'roll_dice') {
    if (gameState.winner !== null) {
      return { valid: false, error: 'Game is already over' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn to roll' };
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;
    gameState.lastDice = diceValue;

    const currentPos = gameState.positions[playerIndex];
    let newPos = currentPos + diceValue;
    const events = [{ type: 'dice_rolled', diceValue, playerIndex }];

    if (newPos > 100) {
      // Must reach 100 exactly, so cannot move if overshoot
      events.push({
        type: 'token_stayed',
        reason: 'Overshot 100',
        currentPos,
        playerIndex
      });
    } else {
      let finalPos = newPos;
      let specialEvent = null;

      if (LADDERS[finalPos]) {
        specialEvent = { type: 'ladder_climbed', from: finalPos, to: LADDERS[finalPos] };
        finalPos = LADDERS[finalPos];
      } else if (SNAKES[finalPos]) {
        specialEvent = { type: 'snake_bitten', from: finalPos, to: SNAKES[finalPos] };
        finalPos = SNAKES[finalPos];
      }

      gameState.positions[playerIndex] = finalPos;
      events.push({
        type: 'token_moved',
        from: currentPos,
        to: newPos,
        finalPos,
        playerIndex,
        specialEvent
      });

      if (finalPos === 100) {
        gameState.winner = playerIndex;
        events.push({ type: 'game_over', winner: playerIndex });
        return { valid: true, stateChanged: true, events };
      }
    }

    // Turn passing: rolling a 6 gives another turn (unless 3 consecutive sixes)
    if (diceValue === 6 && gameState.consecutiveSixes < 2) {
      gameState.consecutiveSixes += 1;
      events.push({ type: 'extra_turn', playerIndex });
    } else {
      gameState.consecutiveSixes = 0;
      gameState.currentTurn = (gameState.currentTurn + 1) % gameState.playerCount;
      events.push({ type: 'turn_passed', nextTurn: gameState.currentTurn });
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    gameState.positions = Array(gameState.playerCount).fill(1);
    gameState.currentTurn = 0;
    gameState.lastDice = null;
    gameState.consecutiveSixes = 0;
    gameState.winner = null;
    gameState.round += 1;
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
  resetGameState,
  SNAKES,
  LADDERS
};
