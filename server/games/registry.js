/**
 * MiniPlay Game Registry
 * Defines metadata, supported player counts, and categorization for all mini-games.
 */

const GAMES = {
  'tic-tac-toe': {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    icon: '❌⭕',
    tagline: 'Classic 3x3 duel. Get 3 in a row to win!',
    description: 'The timeless classic! Place your symbol on the 3x3 grid and connect three in a row horizontally, vertically, or diagonally.',
    categories: ['all', '2-players', 'board', 'casual'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/tic-tac-toe/game.js',
    howToPlay: [
      'Player 1 is X, Player 2 is O.',
      'Take turns clicking an empty cell on the 3x3 grid.',
      'Align 3 of your marks in a line (horizontal, vertical, diagonal) to win.',
      'If all 9 cells are filled with no 3-in-a-row, it is a draw.'
    ]
  },

  'connect-four': {
    id: 'connect-four',
    name: 'Connect Four',
    icon: '🔴🟡',
    tagline: 'Drop tokens into 7 columns to connect 4 in a line!',
    description: 'A vertical battle of wits! Drop colored discs into seven columns. Form a line of four before your opponent does.',
    categories: ['all', '2-players', 'board', 'puzzle', 'casual'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/connect-four/game.js',
    howToPlay: [
      'Players take turns choosing one of 7 columns to drop a token.',
      'Tokens drop to the lowest available space in that column.',
      'Connect four of your color horizontally, vertically, or diagonally to win.',
      'Think ahead and block your opponent!'
    ]
  },

  'rock-paper-scissors': {
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    icon: '✊✋✌️',
    tagline: 'Simultaneous rapid duel. Rock crushes, Paper covers, Scissors cuts!',
    description: 'Face off in quick rounds of instinct and strategy. Secretly select your move, countdown, and reveal simultaneously!',
    categories: ['all', '2-players', 'casual'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/rock-paper-scissors/game.js',
    howToPlay: [
      'Each player secretly picks Rock, Paper, or Scissors.',
      'Once both players have locked in (or round timer ends), choices reveal.',
      'Rock beats Scissors, Scissors beats Paper, Paper beats Rock.',
      'First to win the target rounds or highest score wins!'
    ]
  },

  'memory': {
    id: 'memory',
    name: 'Memory Cards',
    icon: '🃏🎴',
    tagline: 'Flip cards, match identical pairs, test your recall!',
    description: 'Uncover cards 2 at a time. Match pairs to keep your turn and earn points. High score takes the crown!',
    categories: ['all', 'single-player', '2-players', '3-4-players', 'cards', 'puzzle'],
    minPlayers: 1,
    maxPlayers: 4,
    defaultPlayers: 2,
    clientScript: '/games/memory/game.js',
    howToPlay: [
      'On your turn, flip two cards face up.',
      'If the symbols match, you score a point and get another turn!',
      'If they do not match, they flip back and the next player goes.',
      'Remember card locations to sweep remaining pairs.'
    ]
  },

  'snake-ladder': {
    id: 'snake-ladder',
    name: 'Snake & Ladder',
    icon: '🐍🪜',
    tagline: 'Roll the dice, climb ladders, dodge slippery snakes!',
    description: 'The ancient board adventure! Roll the dice to race to tile 100. Ladders give you huge boosts, but beware of hungry snakes!',
    categories: ['all', '2-players', '3-4-players', 'board', 'casual'],
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayers: 2,
    clientScript: '/games/snake-ladder/game.js',
    howToPlay: [
      'Take turns rolling the virtual 6-sided dice.',
      'Advance your player token across the 100 tiles.',
      'Land on the bottom of a ladder to climb up.',
      'Land on a snake head and slide down to its tail.',
      'First player to reach exactly tile 100 wins!'
    ]
  },

  'dots-and-boxes': {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    icon: '⬛🟦',
    tagline: 'Connect dots with lines to capture boxes and score!',
    description: 'Classic pencil-and-paper strategy! Connect adjacent dots. Complete the 4th wall of a 1x1 box to capture it and take an extra turn.',
    categories: ['all', '2-players', '3-4-players', 'board', 'puzzle'],
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayers: 2,
    clientScript: '/games/dots-and-boxes/game.js',
    howToPlay: [
      'Click between two adjacent dots to draw a connecting line.',
      'Whoever draws the fourth line closing a box claims it.',
      'Claiming a box awards 1 point and gives an extra turn.',
      'Player with the most captured boxes at the end wins!'
    ]
  },

  'chess': {
    id: 'chess',
    name: 'Chess',
    icon: '♟️👑',
    tagline: 'The ultimate strategy game. Checkmate the opposing king!',
    description: 'Full 2-player chess board with legal piece movements, captures, turn management, check detection, and clean piece rendering.',
    categories: ['all', '2-players', 'board'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/chess/game.js',
    howToPlay: [
      'White moves first, then Black.',
      'Click a piece to see its valid highlighted moves, then click the destination.',
      'Protect your King while trapping your opponent\'s King into checkmate.',
      'Captured pieces are displayed in the captured shelf.'
    ]
  },

  'checkers': {
    id: 'checkers',
    name: 'Checkers',
    icon: '⚪🔴',
    tagline: 'Diagonal jumps, king promotions, capture all pieces!',
    description: 'Classic 8x8 checkers (draughts). Move diagonally, hop over enemy pieces to capture them, and promote to King when you reach the back row!',
    categories: ['all', '2-players', 'board'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/checkers/game.js',
    howToPlay: [
      'Pieces move diagonally forward 1 step onto dark squares.',
      'Jump over an adjacent enemy piece into an empty square to capture it.',
      'Reach the opposing back rank to be crowned a King (moves forwards & backwards).',
      'Eliminate all enemy pieces or block all legal moves to win.'
    ]
  },

  'carrom': {
    id: 'carrom',
    name: 'Carrom',
    icon: '🎯⚪',
    tagline: 'Flick the striker, pot white & black coins into 4 corner pockets!',
    description: 'Tabletop disc-flicking board! Aim your striker, adjust flick power, and knock coins into corner pockets with 2D physics.',
    categories: ['all', '2-players', 'board', 'casual'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/carrom/game.js',
    howToPlay: [
      'Place your striker along the baseline.',
      'Drag backward to aim and set strike power, then release to shoot!',
      'Pocket your assigned coin color into any of the 4 corner pockets.',
      'Pot the Queen for bonus points! Potting a striker is a foul.'
    ]
  },

  'tank-battle': {
    id: 'tank-battle',
    name: 'Tank Battle',
    icon: '🛡️💥',
    tagline: 'Top-down arcade tank arena. Aim, maneuver, and blow up rivals!',
    description: 'Real-time 2D tank deathmatch arena! Maneuver around obstacles, aim your turret, fire bouncing shells, and outlast opponents.',
    categories: ['all', '2-players', '3-4-players', 'action'],
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayers: 2,
    clientScript: '/games/tank-battle/game.js',
    howToPlay: [
      'WASD or Arrow Keys to move tank.',
      'Aim with Mouse / Touch, Left Click or Fire button to shoot.',
      'Shells bounce once off walls! Use angles for trick shots.',
      'First to 5 frags or highest score when time runs out wins!'
    ]
  },

  'simple-shooter': {
    id: 'simple-shooter',
    name: 'Simple Shooting',
    icon: '🔫⚡',
    tagline: 'Fast-paced top-down laser duel with quick respawns!',
    description: 'High-energy arena shooter! Strafe, dodge enemy fire, grab shield & speed power-ups, and score points with precision shots.',
    categories: ['all', '2-players', '3-4-players', 'action'],
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayers: 2,
    clientScript: '/games/simple-shooter/game.js',
    howToPlay: [
      'Move: WASD / Arrow Keys (or on-screen virtual joystick on mobile).',
      'Aim & Shoot: Mouse / Touch Aim button.',
      'Pick up glowing health and boost orbs.',
      'First player to reach score target wins the round.'
    ]
  },

  'stickman-fight': {
    id: 'stickman-fight',
    name: 'Stickman Fight',
    icon: '🤺🥊',
    tagline: 'Side-view 2D martial arts duel. Punch, kick, jump, and knock out!',
    description: 'Fast retro stickman arcade fighter! Battle on a 2D stage with quick punches, heavy kicks, jumps, and blocks.',
    categories: ['all', '2-players', 'action'],
    minPlayers: 2,
    maxPlayers: 2,
    defaultPlayers: 2,
    clientScript: '/games/stickman-fight/game.js',
    howToPlay: [
      'Move: A / D (Left / Right).',
      'Jump: W or Space bar.',
      'Punch: J key (fast light attack).',
      'Kick: K key (heavy pushback attack).',
      'Block: S key (reduces incoming damage).',
      'Deplete the opponent\'s health bar to score a KO!'
    ]
  }
};

module.exports = { GAMES };
