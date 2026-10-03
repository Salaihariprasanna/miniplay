/**
 * Rock Paper Scissors Game Logic (Server)
 */

const CHOICES = ['rock', 'paper', 'scissors'];

function initGameState() {
  return {
    choices: [null, null], // Hidden until both chosen
    revealed: false,
    roundWinner: null, // null, 0, 1, or 'draw'
    scores: [0, 0],
    round: 1,
    history: []
  };
}

function determineWinner(c0, c1) {
  if (c0 === c1) return 'draw';
  if (
    (c0 === 'rock' && c1 === 'scissors') ||
    (c0 === 'scissors' && c1 === 'paper') ||
    (c0 === 'paper' && c1 === 'rock')
  ) {
    return 0;
  }
  return 1;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'choose') {
    const { choice } = action;
    if (!CHOICES.includes(choice)) {
      return { valid: false, error: 'Invalid move' };
    }
    if (gameState.revealed) {
      return { valid: false, error: 'Round already resolved. Start next round.' };
    }
    if (gameState.choices[playerIndex] !== null) {
      return { valid: false, error: 'You have already made your pick' };
    }

    gameState.choices[playerIndex] = choice;
    const events = [{ type: 'player_picked', playerIndex }];

    // If both players have picked, reveal and score!
    if (gameState.choices[0] !== null && gameState.choices[1] !== null) {
      gameState.revealed = true;
      const winner = determineWinner(gameState.choices[0], gameState.choices[1]);
      gameState.roundWinner = winner;

      if (winner === 0) gameState.scores[0]++;
      else if (winner === 1) gameState.scores[1]++;

      gameState.history.push({
        round: gameState.round,
        choices: [...gameState.choices],
        winner
      });

      events.push({
        type: 'round_revealed',
        choices: [...gameState.choices],
        winner,
        scores: [...gameState.scores]
      });
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'next_round') {
    if (!gameState.revealed) {
      return { valid: false, error: 'Current round not finished' };
    }
    gameState.choices = [null, null];
    gameState.revealed = false;
    gameState.roundWinner = null;
    gameState.round += 1;
    return { valid: true, stateChanged: true, events: [{ type: 'new_round_started', round: gameState.round }] };
  }

  if (action.type === 'restart') {
    gameState.choices = [null, null];
    gameState.revealed = false;
    gameState.roundWinner = null;
    gameState.scores = [0, 0];
    gameState.round = 1;
    gameState.history = [];
    return { valid: true, stateChanged: true, events: [{ type: 'match_reset' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState, playerIndex) {
  // If not revealed, player can only see their own choice and whether the opponent has picked
  if (!gameState.revealed) {
    return {
      revealed: false,
      myChoice: playerIndex !== undefined ? gameState.choices[playerIndex] : null,
      opponentPicked: playerIndex !== undefined ? gameState.choices[1 - playerIndex] !== null : false,
      hasPicked: gameState.choices.map(c => c !== null),
      roundWinner: null,
      scores: gameState.scores,
      round: gameState.round,
      history: gameState.history
    };
  }

  return {
    revealed: true,
    choices: gameState.choices,
    roundWinner: gameState.roundWinner,
    scores: gameState.scores,
    round: gameState.round,
    history: gameState.history
  };
}

function resetGameState(gameState) {
  gameState.choices = [null, null];
  gameState.revealed = false;
  gameState.roundWinner = null;
  gameState.scores = [0, 0];
  gameState.round = 1;
  gameState.history = [];
  return gameState;
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
