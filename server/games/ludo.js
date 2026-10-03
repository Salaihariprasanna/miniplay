/**
 * Ludo Game Logic (Server)
 * 2 to 4 Players. Fast mini-game rules with 2 tokens per player to ensure snappy gameplay.
 */

// 52 common path tiles, 4 players: 0 (Red), 1 (Green), 2 (Yellow), 3 (Blue)
// Start positions on common path (0..51):
const START_POSITIONS = [0, 13, 26, 39];
const SAFE_TILES = [0, 8, 13, 21, 26, 34, 39, 47];

function initGameState(options = {}) {
  const playerCount = options.playerCount || 2;
  const TOKENS_PER_PLAYER = 2; // Fast mini-game version

  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, tIdx) => ({
        id: tIdx,
        status: 'base', // 'base', 'track', 'home_stretch', 'home'
        step: 0 // steps traveled along player's personal path (0..56)
      })),
      tokensHome: 0
    });
  }

  return {
    playerCount,
    tokensPerPlayer: TOKENS_PER_PLAYER,
    players,
    currentTurn: 0,
    diceValue: null,
    hasRolled: false,
    movableTokens: [], // token IDs that can move with current dice
    winner: null,
    round: 1
  };
}

function getMovableTokens(player, diceValue) {
  const movable = [];
  player.tokens.forEach(tok => {
    if (tok.status === 'base' && diceValue === 6) {
      movable.push(tok.id);
    } else if (tok.status === 'track' || tok.status === 'home_stretch') {
      if (tok.step + diceValue <= 56) {
        movable.push(tok.id);
      }
    }
  });
  return movable;
}

function getGlobalPosition(playerIndex, step) {
  // If step 0..50, it is on the global track of 52 tiles
  if (step < 51) {
    return (START_POSITIONS[playerIndex] + step) % 52;
  }
  // Step 51..55 is home stretch, 56 is home
  return null;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'roll_dice') {
    if (gameState.winner !== null) return { valid: false, error: 'Game is over' };
    if (gameState.currentTurn !== playerIndex) return { valid: false, error: 'Not your turn' };
    if (gameState.hasRolled) return { valid: false, error: 'Already rolled' };

    const diceValue = Math.floor(Math.random() * 6) + 1;
    gameState.diceValue = diceValue;
    gameState.hasRolled = true;

    const player = gameState.players[playerIndex];
    const movable = getMovableTokens(player, diceValue);
    gameState.movableTokens = movable;

    const events = [{ type: 'dice_rolled', diceValue, playerIndex, movable }];

    // If no movable tokens, pass turn automatically
    if (movable.length === 0) {
      events.push({ type: 'no_moves', playerIndex });
      gameState.hasRolled = false;
      gameState.diceValue = null;
      gameState.movableTokens = [];
      gameState.currentTurn = (gameState.currentTurn + 1) % gameState.playerCount;
      events.push({ type: 'turn_passed', nextTurn: gameState.currentTurn });
    } else if (movable.length === 1) {
      // Auto-move single token for faster fluid gameplay
      return handleAction(gameState, playerIndex, { type: 'move_token', tokenId: movable[0] });
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'move_token') {
    const { tokenId } = action;
    if (gameState.winner !== null) return { valid: false, error: 'Game is over' };
    if (gameState.currentTurn !== playerIndex) return { valid: false, error: 'Not your turn' };
    if (!gameState.hasRolled) return { valid: false, error: 'Must roll dice first' };
    if (!gameState.movableTokens.includes(tokenId)) return { valid: false, error: 'Cannot move this token' };

    const player = gameState.players[playerIndex];
    const tok = player.tokens[tokenId];
    const dice = gameState.diceValue;
    const events = [];

    let bonusTurn = dice === 6;

    if (tok.status === 'base') {
      tok.status = 'track';
      tok.step = 0;
      events.push({ type: 'token_spawned', playerIndex, tokenId });
    } else {
      tok.step += dice;
      if (tok.step === 56) {
        tok.status = 'home';
        player.tokensHome += 1;
        bonusTurn = true;
        events.push({ type: 'token_home', playerIndex, tokenId });

        if (player.tokensHome >= gameState.tokensPerPlayer) {
          gameState.winner = playerIndex;
          events.push({ type: 'game_over', winner: playerIndex });
          return { valid: true, stateChanged: true, events };
        }
      } else if (tok.step > 50) {
        tok.status = 'home_stretch';
        events.push({ type: 'token_advanced', playerIndex, tokenId, step: tok.step });
      } else {
        events.push({ type: 'token_advanced', playerIndex, tokenId, step: tok.step });

        // Check capture if on global track
        const myGlobalPos = getGlobalPosition(playerIndex, tok.step);
        if (!SAFE_TILES.includes(myGlobalPos)) {
          // Check other players' tokens
          for (let p = 0; p < gameState.playerCount; p++) {
            if (p === playerIndex) continue;
            for (const otherTok of gameState.players[p].tokens) {
              if (otherTok.status === 'track') {
                const otherPos = getGlobalPosition(p, otherTok.step);
                if (otherPos === myGlobalPos) {
                  // CAPTURE!
                  otherTok.status = 'base';
                  otherTok.step = 0;
                  bonusTurn = true;
                  events.push({ type: 'token_captured', victimPlayer: p, victimToken: otherTok.id, byPlayer: playerIndex });
                }
              }
            }
          }
        }
      }
    }

    // Reset turn flags
    gameState.hasRolled = false;
    gameState.diceValue = null;
    gameState.movableTokens = [];

    if (bonusTurn) {
      events.push({ type: 'bonus_roll', playerIndex });
    } else {
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
  resetGameState,
  START_POSITIONS,
  SAFE_TILES
};
