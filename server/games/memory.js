/**
 * Memory Cards Game Logic (Server)
 * Supports 1 to 4 players.
 */

const CARD_SYMBOLS = ['🐶', '🐱', '🦊', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄', '🐙', '🐝', '🦉'];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initGameState(options = {}) {
  const numPairs = options.numPairs || 8; // 16 cards grid (4x4)
  const symbols = CARD_SYMBOLS.slice(0, numPairs);
  const deckSymbols = shuffle([...symbols, ...symbols]);

  const cards = deckSymbols.map((sym, index) => ({
    id: index,
    symbol: sym,
    matched: false,
    matchedBy: null
  }));

  const playerCount = options.playerCount || 2;

  return {
    cards,
    flippedIndices: [], // Currently flipped cards during this turn [index1, index2]
    currentTurn: 0,
    playerCount,
    scores: Array(playerCount).fill(0),
    isEvaluating: false, // Prevents flipping a 3rd card during evaluation
    gameOver: false,
    winner: null,
    totalPairs: numPairs,
    matchedPairsCount: 0
  };
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'flip') {
    const { cardIndex } = action;

    if (gameState.gameOver) {
      return { valid: false, error: 'Game is already over' };
    }
    if (gameState.currentTurn !== playerIndex && gameState.playerCount > 1) {
      return { valid: false, error: 'Not your turn' };
    }
    if (gameState.isEvaluating) {
      return { valid: false, error: 'Evaluating current pair' };
    }
    if (cardIndex < 0 || cardIndex >= gameState.cards.length) {
      return { valid: false, error: 'Invalid card index' };
    }
    if (gameState.cards[cardIndex].matched) {
      return { valid: false, error: 'Card already matched' };
    }
    if (gameState.flippedIndices.includes(cardIndex)) {
      return { valid: false, error: 'Card already face up' };
    }

    gameState.flippedIndices.push(cardIndex);
    const events = [{
      type: 'card_flipped',
      cardIndex,
      symbol: gameState.cards[cardIndex].symbol,
      playerIndex
    }];

    // When 2 cards are flipped
    if (gameState.flippedIndices.length === 2) {
      const [idx1, idx2] = gameState.flippedIndices;
      const card1 = gameState.cards[idx1];
      const card2 = gameState.cards[idx2];

      gameState.isEvaluating = true;

      if (card1.symbol === card2.symbol) {
        // MATCH!
        card1.matched = true;
        card2.matched = true;
        card1.matchedBy = playerIndex;
        card2.matchedBy = playerIndex;
        gameState.scores[playerIndex] += 1;
        gameState.matchedPairsCount += 1;
        gameState.flippedIndices = [];
        gameState.isEvaluating = false;

        events.push({
          type: 'pair_matched',
          cardIndices: [idx1, idx2],
          playerIndex,
          symbol: card1.symbol
        });

        // Check if all pairs matched
        if (gameState.matchedPairsCount >= gameState.totalPairs) {
          gameState.gameOver = true;
          // Find max score
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
        // MISMATCH - Will need to be flipped back after client display delay
        events.push({
          type: 'mismatch',
          cardIndices: [idx1, idx2],
          nextTurn: (gameState.currentTurn + 1) % gameState.playerCount
        });
      }
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'resolve_mismatch') {
    if (gameState.flippedIndices.length === 2) {
      gameState.flippedIndices = [];
      gameState.isEvaluating = false;
      gameState.currentTurn = (gameState.currentTurn + 1) % gameState.playerCount;
      return {
        valid: true,
        stateChanged: true,
        events: [{ type: 'turn_advanced', currentTurn: gameState.currentTurn }]
      };
    }
    return { valid: false, error: 'No mismatch to resolve' };
  }

  if (action.type === 'restart') {
    const newState = initGameState({
      playerCount: gameState.playerCount,
      numPairs: gameState.totalPairs
    });
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  // Hide symbols for cards that are neither matched nor currently flipped
  const sanitizedCards = gameState.cards.map((c, idx) => ({
    id: c.id,
    matched: c.matched,
    matchedBy: c.matchedBy,
    symbol: (c.matched || gameState.flippedIndices.includes(idx)) ? c.symbol : null
  }));

  return {
    cards: sanitizedCards,
    flippedIndices: gameState.flippedIndices,
    currentTurn: gameState.currentTurn,
    playerCount: gameState.playerCount,
    scores: gameState.scores,
    isEvaluating: gameState.isEvaluating,
    gameOver: gameState.gameOver,
    winner: gameState.winner,
    matchedPairsCount: gameState.matchedPairsCount,
    totalPairs: gameState.totalPairs
  };
}

function resetGameState(gameState) {
  return initGameState({
    playerCount: gameState.playerCount,
    numPairs: gameState.totalPairs
  });
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
